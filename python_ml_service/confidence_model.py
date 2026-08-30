"""
Shared model definitions and audio/transcript feature extraction for the
speech-analysis pipeline (fluency / clarity / confidence scoring).

Used by both train_confidence_head.py (training) and app.py (inference), so
the classifier head architecture can never drift between training and
serving.
"""
import re

import numpy as np
import torch
import torch.nn as nn
import torchaudio

CONFIDENCE_HEAD_PATH = "confidence_head.ckpt"
CONFIDENCE_CLASSES = ["Low", "Neutral", "High"]  # matches generate_dataset.py class_id 0/1/2

_FILLER_WORDS = {
    "um", "uh", "umm", "uhh", "erm", "hmm", "like", "actually", "basically",
    "literally", "you know", "i mean", "sort of", "kind of", "so yeah",
}
_STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be",
    "been", "being", "to", "of", "in", "on", "for", "with", "as", "at", "by",
    "this", "that", "these", "those", "it", "its", "i", "you", "we", "they",
    "he", "she", "my", "your", "our", "their", "have", "has", "had", "do",
    "does", "did", "not", "so", "if", "then", "than", "there", "here",
}


class ConfidenceHead(nn.Module):
    """Classifies a 192-dim ECAPA-TDNN speaker embedding into a communication
    confidence level (0=Low, 1=Neutral, 2=High). Trained on the local
    synthetic_dataset via train_confidence_head.py — the frozen ECAPA-TDNN
    encoder does the heavy lifting; this is just the small trainable head
    on top of it, matching the pattern in train_ecapa.py's ECAPAClassifier.
    """

    def __init__(self, num_classes: int = 3):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(192, 64),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(64, num_classes),
        )

    def forward(self, embeddings: torch.Tensor) -> torch.Tensor:
        return self.net(embeddings)


# ── Basic audio feature extraction (no ML — raw signal processing) ─────────

def extract_basic_audio_features(waveform: torch.Tensor, sample_rate: int = 16000) -> dict:
    """Extracts basic prosodic/acoustic features directly from a mono waveform.

    These are genuine per-sample computations (never a fixed constant) used
    to score fluency/clarity/confidence alongside the ECAPA confidence class.
    """
    wav = waveform.float()
    duration_sec = wav.shape[-1] / float(sample_rate)

    # RMS energy per 25ms frame (loudness + dynamic range)
    frame_len = max(1, int(sample_rate * 0.025))
    hop_len = max(1, int(sample_rate * 0.010))
    frames = wav.unfold(0, frame_len, hop_len) if wav.shape[-1] >= frame_len else wav.unsqueeze(0)
    frame_rms = torch.sqrt(torch.clamp((frames ** 2).mean(dim=-1), min=1e-12))

    rms_mean = frame_rms.mean().item()
    rms_std = frame_rms.std().item() if frame_rms.numel() > 1 else 0.0

    # Silence ratio: fraction of frames below a relative energy threshold
    silence_thresh = max(rms_mean * 0.15, 1e-4)
    silence_ratio = (frame_rms < silence_thresh).float().mean().item()

    # Zero-crossing rate (spectral noisiness / sibilance proxy for clarity)
    signs = torch.sign(wav)
    signs[signs == 0] = 1
    zcr = (signs[1:] != signs[:-1]).float().mean().item() if wav.numel() > 1 else 0.0

    # Pitch (F0) mean/variability — monotone delivery has low pitch_std
    try:
        pitch = torchaudio.functional.detect_pitch_frequency(wav.unsqueeze(0), sample_rate)
        voiced = pitch[pitch > 0]
        pitch_mean = voiced.mean().item() if voiced.numel() > 0 else 0.0
        pitch_std = voiced.std().item() if voiced.numel() > 1 else 0.0
    except Exception:
        pitch_mean, pitch_std = 0.0, 0.0

    return {
        "duration_sec": duration_sec,
        "rms_mean": rms_mean,
        "rms_std": rms_std,
        "silence_ratio": silence_ratio,
        "zero_crossing_rate": zcr,
        "pitch_mean": pitch_mean,
        "pitch_std": pitch_std,
    }


def extract_transcript_features(transcript: str, duration_sec: float) -> dict:
    """Lexical/timing features computed directly from the recognized transcript."""
    text = (transcript or "").strip().lower()
    words = re.findall(r"[a-z']+", text)
    word_count = len(words)

    filler_count = 0
    joined = " " + " ".join(words) + " "
    for phrase in _FILLER_WORDS:
        filler_count += joined.count(f" {phrase} ")

    unique_ratio = (len(set(words)) / word_count) if word_count > 0 else 0.0
    speaking_rate = (word_count / duration_sec) if duration_sec > 0 else 0.0
    filler_ratio = (filler_count / word_count) if word_count > 0 else 0.0

    return {
        "word_count": word_count,
        "speaking_rate": speaking_rate,
        "filler_count": filler_count,
        "filler_ratio": filler_ratio,
        "unique_word_ratio": unique_ratio,
    }


def extract_keywords(transcript: str, top_n: int = 5) -> list:
    """Simple frequency-based keyword extraction (no LLM call, deterministic)."""
    words = re.findall(r"[a-zA-Z']+", transcript or "")
    counts: dict = {}
    for w in words:
        lw = w.lower()
        if len(lw) < 5 or lw in _STOPWORDS or lw in _FILLER_WORDS:
            continue
        counts[lw] = counts.get(lw, 0) + 1
    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    return [w for w, _ in ranked[:top_n]]


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


def compute_speech_scores(audio_features: dict, transcript_features: dict, confidence_probs: list) -> dict:
    """Combines ECAPA confidence-class probabilities with real audio and
    transcript features into fluency / clarity / confidence / overall scores.

    Every input term is a genuine measurement of this specific answer, so the
    output varies with the input — there is no fixed/static fallback here.
    """
    p_low, p_neutral, p_high = (confidence_probs + [0, 0, 0])[:3]
    ecapa_confidence = 0 * p_low + 50 * p_neutral + 100 * p_high

    # Pitch variability normalized against a reasonable spoken-voice range (0-60 Hz std)
    pitch_variety = _clamp((audio_features["pitch_std"] / 60.0) * 100)
    energy_variety = _clamp((audio_features["rms_std"] / max(audio_features["rms_mean"], 1e-6)) * 100)

    confidence = _clamp(
        0.5 * ecapa_confidence
        + 0.3 * pitch_variety
        + 0.2 * energy_variety
    )

    # Ideal conversational speaking rate ~= 2.0-3.0 words/sec; penalize deviation
    rate = transcript_features["speaking_rate"]
    if rate <= 0:
        rate_score = 0.0
    else:
        deviation = min(abs(rate - 2.5) / 2.5, 1.0)
        rate_score = _clamp((1 - deviation) * 100)
    filler_penalty = _clamp(transcript_features["filler_ratio"] * 200)
    silence_penalty = _clamp(audio_features["silence_ratio"] * 100)
    fluency = _clamp(rate_score - 0.5 * filler_penalty - 0.3 * silence_penalty)

    vocabulary_score = _clamp(transcript_features["unique_word_ratio"] * 100)
    # Very high zero-crossing rate indicates noisy/unclear audio
    noise_penalty = _clamp((audio_features["zero_crossing_rate"] - 0.15) * 200) if audio_features["zero_crossing_rate"] > 0.15 else 0
    clarity = _clamp(0.6 * vocabulary_score + 0.4 * ecapa_confidence - 0.3 * noise_penalty)

    overall = _clamp(0.35 * confidence + 0.35 * fluency + 0.3 * clarity)

    return {
        "confidence": round(confidence),
        "fluency": round(fluency),
        "clarity": round(clarity),
        "score": round(overall),
    }


def build_feedback(audio_features: dict, transcript_features: dict, scores: dict, confidence_label: str) -> str:
    bits = [f"Predicted vocal confidence: {confidence_label}."]
    if transcript_features["word_count"] == 0:
        bits.append("No speech was transcribed for this answer.")
    else:
        bits.append(f"Speaking rate: {transcript_features['speaking_rate']:.1f} words/sec.")
        if transcript_features["filler_count"] > 0:
            bits.append(f"{transcript_features['filler_count']} filler word(s) detected.")
        if audio_features["silence_ratio"] > 0.35:
            bits.append("Noticeable pauses detected — consider reducing dead air.")
        if scores["clarity"] >= 75:
            bits.append("Vocabulary and articulation were clear.")
        elif scores["clarity"] < 50:
            bits.append("Consider using more varied and precise vocabulary.")
    return " ".join(bits)

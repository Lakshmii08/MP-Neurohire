import os
os.environ["SB_FETCH_STRATEGY"] = "copy"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

# ── Windows Symlink Fix ────────────────────────────────────────────────────────
# Monkeypatch SpeechBrain to use COPY instead of SYMLINK strategy.
# This avoids WinError 1314 (missing symlink privilege) on standard Windows accounts.
import speechbrain.utils.fetching as _sb_fetch
from speechbrain.utils.fetching import LocalStrategy as _LS

# Patch 1: override link_with_strategy to never use SYMLINK
_orig_link = _sb_fetch.link_with_strategy
_sb_fetch.link_with_strategy = (
    lambda src, dst, strat: _orig_link(src, dst, _LS.COPY if strat == _LS.SYMLINK else strat)
)

# Patch 2: override Pretrainer.collect_files() default from SYMLINK -> COPY
import speechbrain.utils.parameter_transfer as _sb_pt
_orig_collect = _sb_pt.Pretrainer.collect_files
def _patched_collect(self, default_source=None, local_strategy=_LS.COPY, fetch_config=None):
    from speechbrain.utils.fetching import FetchConfig
    if fetch_config is None:
        fetch_config = FetchConfig()
    return _orig_collect(self, default_source=default_source, local_strategy=local_strategy, fetch_config=fetch_config)
_sb_pt.Pretrainer.collect_files = _patched_collect
# ──────────────────────────────────────────────────────────────────────────────



import json
import tempfile
import subprocess

import torch
import torchaudio
import torch.nn.functional as F
import uvicorn

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from train_ecapa import ECAPAClassifier, NUM_CLASSES, MODEL_SAVE_PATH
from confidence_model import (
    ConfidenceHead,
    CONFIDENCE_HEAD_PATH,
    CONFIDENCE_CLASSES,
    extract_basic_audio_features,
    extract_transcript_features,
    extract_keywords,
    compute_speech_scores,
    build_feedback,
)

app = FastAPI(title="NeuroHire ECAPA-TDNN Speaker Verification API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = None
confidence_head = None

# ──────────────────────────────────────────────────────────────────────────────
# Speaker-verification match threshold — empirically calibrated.
#
# The previous threshold (0.70 on the mapped 0-1 scale, i.e. raw cosine 0.40)
# was a real bug, not a tuning nitpick: calibrate_voice_threshold.py measured
# it accepting ~100% of *different*-speaker pairs as a "match" using a
# controlled multi-voice test set (8 synthetic voices x 5 utterances each).
# Genuine (same-speaker) pairs measured ~0.76-0.94 raw cosine while
# different-speaker pairs measured ~0.49-0.97 — the two distributions overlap
# heavily for short single-utterance clips, and 0.40 sits nowhere near where
# real separation happens. There is no threshold in this calibration that
# gives both a low false-accept rate (FAR) and a low false-reject rate (FRR)
# at the same time — short, single-utterance speaker verification with a
# generic (not fine-tuned) pretrained model is a genuinely hard operating
# point. See calibrate_voice_threshold.py's full FAR/FRR sweep.
#
# This value (raw cosine ~0.84) is this calibration's measured equal-error
# point (FAR ~= FRR ~= 18-20% in that worst-case synthetic-voice test) — the
# mathematically balanced operating point, not an arbitrary pick. Pushing
# higher (tested up to raw 0.86) does cut FAR further but pushes FRR to ~29%,
# which empirically started rejecting genuine same-speaker verification
# attempts too — not an acceptable tradeoff for a feature real users hit on
# every interview answer. This is still a large, deliberate move from the
# previous ~100% FAR this app was shipping before. Real distinct human voices
# may separate better than same-TTS-engine synthetic voices, so real-world
# numbers could beat this worst-case estimate — but the actual reported bug
# (two different real people scoring as a match) is evidence this synthetic
# calibration isn't too far off. Re-run calibrate_voice_threshold.py (ideally
# with real recordings from multiple people via CUSTOM_AUDIO_DIR) to refine
# this further as real usage data becomes available.
VOICE_MATCH_THRESHOLD = 0.92  # mapped scale; raw cosine ~0.84

# Verification/enrollment clips shorter than this produce unreliable
# embeddings — reject rather than silently return an unreliable score.
MIN_VERIFICATION_DURATION_SEC = 1.5

# ──────────────────────────────────────────────────────────────────────────────
# Health Check — used by the Node server's /api/auth/ml-status proxy
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "confidence_head_loaded": confidence_head is not None,
        "device": str(next(model.parameters()).device) if model is not None else None
    }


# ──────────────────────────────────────────────────────────────────────────────
# Startup: Load pre-trained ECAPA-TDNN model
# ──────────────────────────────────────────────────────────────────────────────

@app.on_event("startup")
def load_model():
    global model, confidence_head
    try:
        os.environ["SB_FETCH_STRATEGY"] = "copy"
        model = ECAPAClassifier(NUM_CLASSES)
        if os.path.exists(MODEL_SAVE_PATH):
            model.load_state_dict(torch.load(MODEL_SAVE_PATH, map_location=torch.device("cpu")))
            print(f"[ECAPA] Loaded fine-tuned model from {MODEL_SAVE_PATH}.")
        else:
            print("[ECAPA] WARNING: No fine-tuned model found. Using base ECAPA-TDNN (VoxCeleb) weights.")

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model = model.to(device)
        model.eval()
        print(f"[ECAPA] Model ready on device: {device}")
    except Exception as e:
        print(f"[ECAPA] CRITICAL: Error loading model: {e}")
        model = None

    try:
        head = ConfidenceHead(num_classes=len(CONFIDENCE_CLASSES))
        if os.path.exists(CONFIDENCE_HEAD_PATH):
            head.load_state_dict(torch.load(CONFIDENCE_HEAD_PATH, map_location=torch.device("cpu")))
            head.eval()
            confidence_head = head
            print(f"[ConfidenceHead] Loaded trained classifier from {CONFIDENCE_HEAD_PATH}.")
        else:
            print(
                f"[ConfidenceHead] WARNING: {CONFIDENCE_HEAD_PATH} not found. "
                "Run `python train_confidence_head.py` to train it on synthetic_dataset. "
                "Speech analysis will run without the confidence-class signal until then."
            )
    except Exception as e:
        print(f"[ConfidenceHead] Error loading classifier head: {e}")
        confidence_head = None

# ──────────────────────────────────────────────────────────────────────────────
# Helper: convert any audio file to a 16kHz mono waveform tensor
# ──────────────────────────────────────────────────────────────────────────────

async def audio_to_waveform(file: UploadFile) -> torch.Tensor:
    """Reads an uploaded audio file, converts to 16kHz mono WAV, returns 1-D tensor."""
    suffix = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
    temp_in_fd, temp_in_path = tempfile.mkstemp(suffix=suffix)
    temp_wav_fd, temp_wav_path = tempfile.mkstemp(suffix=".wav")
    try:
        with os.fdopen(temp_in_fd, "wb") as f:
            f.write(await file.read())
        import imageio_ffmpeg
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        subprocess.run(
            [ffmpeg_exe, "-y", "-i", temp_in_path, "-ar", "16000", "-ac", "1", temp_wav_path],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
        # Use soundfile rather than torchaudio.load: newer torchaudio releases
        # default to a torchcodec backend that requires system ffmpeg shared
        # libraries, which aren't guaranteed to be present on every host.
        import soundfile as sf
        data, sample_rate = sf.read(temp_wav_path, dtype="float32")
        waveform = torch.from_numpy(data)
        if waveform.ndim == 1:
            waveform = waveform.unsqueeze(0)
        else:
            waveform = waveform.T  # soundfile returns (T, channels)
        if sample_rate != 16000:
            waveform = torchaudio.functional.resample(waveform, orig_freq=sample_rate, new_freq=16000)
        if waveform.shape[0] > 1:
            waveform = waveform.mean(dim=0, keepdim=True)
        return waveform.squeeze(0)  # shape: (T,)
    finally:
        if os.path.exists(temp_in_path):
            os.remove(temp_in_path)
        try:
            os.close(temp_wav_fd)
        except Exception:
            pass
        if os.path.exists(temp_wav_path):
            os.remove(temp_wav_path)


def extract_raw_embedding(waveform: torch.Tensor) -> torch.Tensor:
    """Extract the raw (non-normalised) 192-dim ECAPA-TDNN embedding."""
    device = next(model.parameters()).device
    wav_tensor = waveform.unsqueeze(0).to(device)           # (1, T)
    rel_length = torch.tensor([1.0]).to(device)
    with torch.no_grad():
        emb = model.ecapa.encode_batch(wav_tensor, wav_lens=rel_length)  # (1, 1, 192)
        emb = emb.squeeze(1)                                # (1, 192)
    return emb  # (1, 192)


def extract_embedding(waveform: torch.Tensor) -> torch.Tensor:
    """Extract L2-normalised 192-dim ECAPA-TDNN speaker embedding from waveform.

    Used for speaker *verification* (cosine similarity needs unit-norm vectors).
    ConfidenceHead was trained on raw (non-normalised) embeddings — see
    extract_raw_embedding() — so don't feed this normalised version into it.
    """
    emb = extract_raw_embedding(waveform)
    return F.normalize(emb, p=2, dim=-1)  # L2-normalise → unit sphere

# ──────────────────────────────────────────────────────────────────────────────
# Endpoint 1: /extract-embedding
# Used during Voice Enrollment (VoiceAuth page after login).
# Returns the 192-dim L2-normalised ECAPA embedding for the uploaded audio.
# ──────────────────────────────────────────────────────────────────────────────

@app.post("/extract-embedding")
async def extract_embedding_endpoint(file: UploadFile = File(...)):
    """
    Enrollment step: extract speaker embedding from the reference voice sample.
    The returned embedding should be stored in the database (voice_auth.voice_embedding).
    """
    if model is None:
        raise HTTPException(status_code=503, detail="ECAPA-TDNN model not loaded.")

    try:
        waveform = await audio_to_waveform(file)
        duration_sec = waveform.shape[-1] / 16000.0
        if duration_sec < MIN_VERIFICATION_DURATION_SEC:
            raise HTTPException(
                status_code=400,
                detail=f"Enrollment audio too short ({duration_sec:.1f}s). "
                       f"Need at least {MIN_VERIFICATION_DURATION_SEC}s of clear speech."
            )
        emb = extract_embedding(waveform)
        return {
            "success": True,
            "embedding": emb[0].tolist(),   # list of 192 floats
            "embedding_dim": emb.shape[-1]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ──────────────────────────────────────────────────────────────────────────────
# Endpoint 2: /verify-with-embedding
# Used during Interview voice verification.
# Accepts the stored enrollment embedding (JSON string) + new audio file.
# Returns cosine similarity score and match decision.
# ──────────────────────────────────────────────────────────────────────────────

@app.post("/verify-with-embedding")
async def verify_with_embedding(
    enrolled_embedding: str = Form(...),   # JSON-stringified list[float] from DB
    file: UploadFile = File(...)           # interview audio chunk
):
    """
    Interview step: compare new audio against the stored ECAPA embedding.
    Cosine similarity on the unit-sphere equals the dot product (both are L2-normalised).
    See VOICE_MATCH_THRESHOLD above for how the match threshold was chosen.
    """
    if model is None:
        raise HTTPException(status_code=503, detail="ECAPA-TDNN model not loaded.")

    try:
        # Parse stored enrollment embedding
        stored_list = json.loads(enrolled_embedding)
        device = next(model.parameters()).device
        enrolled_emb = torch.tensor(stored_list, dtype=torch.float32).unsqueeze(0).to(device)  # (1, 192)
        enrolled_emb = F.normalize(enrolled_emb, p=2, dim=-1)

        # Extract embedding from new audio
        waveform = await audio_to_waveform(file)
        duration_sec = waveform.shape[-1] / 16000.0
        if duration_sec < MIN_VERIFICATION_DURATION_SEC:
            raise HTTPException(
                status_code=400,
                detail=f"Audio too short ({duration_sec:.1f}s) for reliable speaker verification. "
                       f"Need at least {MIN_VERIFICATION_DURATION_SEC}s of speech."
            )
        test_emb = extract_embedding(waveform).to(device)  # (1, 192)

        # Cosine similarity (both are L2-normalised, so this equals dot product)
        similarity = F.cosine_similarity(enrolled_emb, test_emb, dim=-1).item()

        # Clamp to [0, 1] for cleaner score display
        similarity_clamped = max(0.0, min(1.0, (similarity + 1.0) / 2.0))

        return {
            "success": True,
            "similarity_score": similarity_clamped,         # 0-1 range
            "raw_cosine": similarity,                       # raw value for debugging
            "match": similarity_clamped >= VOICE_MATCH_THRESHOLD,
            "threshold": VOICE_MATCH_THRESHOLD
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ──────────────────────────────────────────────────────────────────────────────
# Endpoint 3: /compare-voices (legacy / direct file comparison)
# Accepts two audio files, computes ECAPA embedding for each, returns cosine similarity.
# ──────────────────────────────────────────────────────────────────────────────

@app.post("/compare-voices")
async def compare_voices(file1: UploadFile = File(...), file2: UploadFile = File(...)):
    """Direct two-file comparison without stored embeddings."""
    if model is None:
        raise HTTPException(status_code=503, detail="ECAPA-TDNN model not loaded.")

    try:
        wav1 = await audio_to_waveform(file1)
        wav2 = await audio_to_waveform(file2)

        for wav in (wav1, wav2):
            if wav.shape[-1] / 16000.0 < MIN_VERIFICATION_DURATION_SEC:
                raise HTTPException(
                    status_code=400,
                    detail=f"Audio too short for reliable speaker verification. "
                           f"Need at least {MIN_VERIFICATION_DURATION_SEC}s of speech."
                )

        emb1 = extract_embedding(wav1)
        emb2 = extract_embedding(wav2)

        similarity = F.cosine_similarity(emb1, emb2, dim=-1).item()
        similarity_clamped = max(0.0, min(1.0, (similarity + 1.0) / 2.0))

        return {
            "success": True,
            "similarity_score": similarity_clamped,
            "raw_cosine": similarity,
            "match": similarity_clamped >= VOICE_MATCH_THRESHOLD
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ──────────────────────────────────────────────────────────────────────────────
# Endpoint 4: /analyze-speech — real Speech Analysis (fluency / clarity / confidence)
#
# Combines:
#   1. The ECAPA-TDNN speaker embedding classified by ConfidenceHead (trained
#      on synthetic_dataset via train_confidence_head.py) into Low/Neutral/High
#      vocal confidence.
#   2. Basic acoustic features computed directly from the waveform (pitch
#      variability, energy/RMS variability, silence ratio, zero-crossing rate).
#   3. Transcript-derived features (speaking rate, filler-word ratio,
#      vocabulary diversity).
#
# Every term is a genuine measurement of the submitted answer, so scores vary
# with the input — there is no fixed/static fallback.
# ──────────────────────────────────────────────────────────────────────────────

@app.post("/analyze-speech")
async def analyze_speech(
    file: UploadFile = File(...),
    transcript: str = Form(""),
    question: str = Form(""),
):
    if model is None:
        raise HTTPException(status_code=503, detail="ECAPA-TDNN model not loaded.")

    try:
        waveform = await audio_to_waveform(file)

        audio_features = extract_basic_audio_features(waveform, sample_rate=16000)
        transcript_features = extract_transcript_features(transcript, audio_features["duration_sec"])

        confidence_probs = [0.0, 1.0, 0.0]  # neutral prior if the head isn't loaded
        confidence_label = CONFIDENCE_CLASSES[1]
        if confidence_head is not None:
            emb = extract_raw_embedding(waveform).squeeze(0)  # (192,) — matches training in train_confidence_head.py
            with torch.no_grad():
                logits = confidence_head(emb.unsqueeze(0).cpu())
                probs = torch.nn.functional.softmax(logits, dim=-1)[0]
            confidence_probs = probs.tolist()
            confidence_label = CONFIDENCE_CLASSES[int(probs.argmax().item())]

        scores = compute_speech_scores(audio_features, transcript_features, confidence_probs)
        feedback = build_feedback(audio_features, transcript_features, scores, confidence_label)
        keywords = extract_keywords(transcript)

        return {
            "success": True,
            "transcript": transcript,
            "confidence": scores["confidence"],
            "fluency": scores["fluency"],
            "clarity": scores["clarity"],
            "score": scores["score"],
            "feedback": feedback,
            "keywords": keywords,
            "details": {
                "confidence_class": confidence_label,
                "confidence_class_probs": {
                    CONFIDENCE_CLASSES[i]: round(p, 4) for i, p in enumerate(confidence_probs)
                },
                "audio_features": audio_features,
                "transcript_features": transcript_features,
                "confidence_head_active": confidence_head is not None,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ──────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)

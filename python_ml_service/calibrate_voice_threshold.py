"""
Empirically calibrates the ECAPA-TDNN speaker-verification match threshold
(VOICE_MATCH_THRESHOLD in app.py) by measuring genuine (same-speaker) vs.
impostor (different-speaker) cosine-similarity distributions and reporting
false-accept-rate (FAR) / false-reject-rate (FRR) at a sweep of candidate
thresholds.

Why this exists: the previous fixed threshold (0.70 on app.py's mapped 0-1
scale) was never measured against anything — it accepted ~100% of different-
speaker pairs as a match in the test this script runs. This script makes the
threshold a *measured* choice instead of a guess, and gives a repeatable way
to re-check it.

IMPORTANT CAVEAT: with no real multi-speaker human voice corpus available in
this environment (no network access to speech datasets), this script
generates its "different speakers" using several distinct espeak-ng TTS
voices/pitches/speeds as a *proxy*. Real distinct human voices should be
easier to separate than same-synthesis-engine TTS voices, so treat the
FAR/FRR numbers here as a pessimistic (worst-case) estimate, not a precise
real-world figure. If you have real recordings from multiple people, replace
generate_synthetic_speakers() with loading those instead — the FAR/FRR sweep
logic works unchanged.

Usage:
    python calibrate_voice_threshold.py
Requires `espeak-ng` on PATH for the synthetic fallback (apt/brew install
espeak-ng). If it's unavailable, point CUSTOM_AUDIO_DIR at real audio
instead (see load_custom_speakers()).
"""
import glob
import os
import re
import shutil
import subprocess
import tempfile

os.environ["SB_FETCH_STRATEGY"] = "copy"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

import soundfile as sf
import torch
import torch.nn.functional as F
from speechbrain.inference.speaker import EncoderClassifier

# Point this at a directory of real recordings to calibrate against real
# voices instead of the synthetic proxy. Expected filename pattern:
# <speaker_id>_<utterance_index>.wav (mono, any sample rate — resampled below).
CUSTOM_AUDIO_DIR = None

PHRASES = [
    "The quick brown fox jumps over the lazy dog for NeuroHire assessment",
    "I am excited to discuss my experience with software engineering",
    "Please verify my identity using this voice sample recording",
    "Machine learning models require careful validation before deployment",
    "Tell me about a challenging project you completed recently",
]
# (speaker_id, espeak voice, pitch, speed) — deliberately varied to act as
# distinct "speakers" for calibration purposes. See caveat above.
SYNTHETIC_SPEAKERS = [
    ("spk1", "en-us", 35, 150),
    ("spk2", "en-us", 75, 170),
    ("spk3", "en-gb", 45, 140),
    ("spk4", "en-gb", 85, 190),
    ("spk5", "en-gb-x-rp", 55, 160),
    ("spk6", "en-gb-scotland", 65, 150),
    ("spk7", "en-029", 40, 145),
    ("spk8", "en-gb-x-gbclan", 90, 200),
]


def generate_synthetic_speakers(out_dir: str) -> list:
    if shutil.which("espeak-ng") is None:
        raise RuntimeError(
            "espeak-ng not found on PATH. Install it (e.g. `apt install espeak-ng`) "
            "or set CUSTOM_AUDIO_DIR to a directory of real multi-speaker recordings."
        )
    import imageio_ffmpeg
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

    files = []
    for spk_id, voice, pitch, speed in SYNTHETIC_SPEAKERS:
        for i, phrase in enumerate(PHRASES):
            raw_path = os.path.join(out_dir, f"raw_{spk_id}_{i}.wav")
            subprocess.run(
                ["espeak-ng", "-v", voice, "-p", str(pitch), "-s", str(speed), "-w", raw_path, phrase],
                check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
            wav_path = os.path.join(out_dir, f"{spk_id}_{i}.wav")
            subprocess.run(
                [ffmpeg_exe, "-y", "-i", raw_path, "-ar", "16000", "-ac", "1", wav_path],
                check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
            files.append(wav_path)
    return files


def load_custom_speakers(audio_dir: str) -> list:
    return sorted(glob.glob(os.path.join(audio_dir, "*.wav")))


def extract_embeddings(files: list, encoder: EncoderClassifier) -> dict:
    embeddings = {}
    for f in files:
        base = os.path.splitext(os.path.basename(f))[0]
        m = re.match(r"(.+)_(\d+)$", base)
        spk = m.group(1) if m else base
        data, sr = sf.read(f, dtype="float32")
        wav = torch.from_numpy(data)
        if wav.ndim > 1:
            wav = wav.mean(dim=-1)
        if sr != 16000:
            import torchaudio
            wav = torchaudio.functional.resample(wav.unsqueeze(0), sr, 16000).squeeze(0)
        with torch.no_grad():
            emb = encoder.encode_batch(wav.unsqueeze(0)).squeeze(0).squeeze(0)
        embeddings.setdefault(spk, []).append(emb)
    return embeddings


def pairwise_scores(embeddings: dict):
    genuine, impostor = [], []
    flat = [(spk, emb) for spk, embs in embeddings.items() for emb in embs]
    for i in range(len(flat)):
        for j in range(i + 1, len(flat)):
            spk_i, emb_i = flat[i]
            spk_j, emb_j = flat[j]
            cos = F.cosine_similarity(emb_i.unsqueeze(0), emb_j.unsqueeze(0), dim=-1).item()
            (genuine if spk_i == spk_j else impostor).append(cos)
    return genuine, impostor


def sweep_thresholds(genuine: list, impostor: list):
    print(f"\n{'raw cosine':>10} | {'mapped':>7} | {'FAR':>7} | {'FRR':>7}")
    print("-" * 42)
    best_t, best_gap = None, float("inf")
    for t100 in range(50, 100, 2):
        t = t100 / 100.0
        far = sum(1 for c in impostor if c >= t) / len(impostor)
        frr = sum(1 for c in genuine if c < t) / len(genuine)
        mapped = (t + 1) / 2
        print(f"{t:>10.2f} | {mapped:>7.3f} | {far:>6.1%} | {frr:>6.1%}")
        if abs(far - frr) < best_gap:
            best_gap, best_t = abs(far - frr), t
    print(f"\nEqual-error-rate threshold ~= {best_t:.2f} raw cosine ({(best_t+1)/2:.3f} mapped)")
    print(
        "Recommendation: pick a threshold at or a little above the EER point to favor "
        "rejecting impostors over occasionally re-prompting a genuine user."
    )


def main():
    if CUSTOM_AUDIO_DIR:
        files = load_custom_speakers(CUSTOM_AUDIO_DIR)
        print(f"Loaded {len(files)} real audio files from {CUSTOM_AUDIO_DIR}")
    else:
        print("No CUSTOM_AUDIO_DIR set — generating synthetic multi-voice proxy data with espeak-ng.")
        print("(See module docstring: this is a pessimistic proxy, not real human speech.)")
        tmp_dir = tempfile.mkdtemp(prefix="voice_calibration_")
        try:
            files = generate_synthetic_speakers(tmp_dir)
            _run_with_files(files)
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        return

    _run_with_files(files)


def _run_with_files(files):
    print(f"Loading pretrained ECAPA-TDNN encoder...")
    encoder = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb", savedir="tmpdir_ecapa")

    print(f"Extracting embeddings for {len(files)} files...")
    embeddings = extract_embeddings(files, encoder)
    print(f"Found {len(embeddings)} distinct speaker IDs.")

    genuine, impostor = pairwise_scores(embeddings)
    import statistics as st
    print(f"\nGENUINE (same speaker):      n={len(genuine)}  mean={st.mean(genuine):.3f}  min={min(genuine):.3f}  max={max(genuine):.3f}")
    print(f"IMPOSTOR (different speaker): n={len(impostor)}  mean={st.mean(impostor):.3f}  min={min(impostor):.3f}  max={max(impostor):.3f}")

    sweep_thresholds(genuine, impostor)


if __name__ == "__main__":
    main()

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

app = FastAPI(title="NeuroHire ECAPA-TDNN Speaker Verification API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = None

# ──────────────────────────────────────────────────────────────────────────────
# Health Check — used by the Node server's /api/auth/ml-status proxy
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "device": str(next(model.parameters()).device) if model is not None else None
    }


# ──────────────────────────────────────────────────────────────────────────────
# Startup: Load pre-trained ECAPA-TDNN model
# ──────────────────────────────────────────────────────────────────────────────

@app.on_event("startup")
def load_model():
    global model
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
        waveform, sample_rate = torchaudio.load(temp_wav_path)
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


def extract_embedding(waveform: torch.Tensor) -> torch.Tensor:
    """Extract L2-normalised 192-dim ECAPA-TDNN speaker embedding from waveform."""
    device = next(model.parameters()).device
    wav_tensor = waveform.unsqueeze(0).to(device)           # (1, T)
    rel_length = torch.tensor([1.0]).to(device)
    with torch.no_grad():
        emb = model.ecapa.encode_batch(wav_tensor, wav_lens=rel_length)  # (1, 1, 192)
        emb = emb.squeeze(1)                                # (1, 192)
        emb = F.normalize(emb, p=2, dim=-1)                # L2-normalise → unit sphere
    return emb  # (1, 192)

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
        emb = extract_embedding(waveform)
        return {
            "success": True,
            "embedding": emb[0].tolist(),   # list of 192 floats
            "embedding_dim": emb.shape[-1]
        }
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
    Threshold: similarity >= 0.70 is considered a match.
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
        test_emb = extract_embedding(waveform).to(device)  # (1, 192)

        # Cosine similarity (both are L2-normalised, so this equals dot product)
        similarity = F.cosine_similarity(enrolled_emb, test_emb, dim=-1).item()

        # Clamp to [0, 1] for cleaner score display
        similarity_clamped = max(0.0, min(1.0, (similarity + 1.0) / 2.0))

        THRESHOLD = 0.70
        return {
            "success": True,
            "similarity_score": similarity_clamped,         # 0-1 range
            "raw_cosine": similarity,                       # raw value for debugging
            "match": similarity_clamped >= THRESHOLD,
            "threshold": THRESHOLD
        }
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

        emb1 = extract_embedding(wav1)
        emb2 = extract_embedding(wav2)

        similarity = F.cosine_similarity(emb1, emb2, dim=-1).item()
        similarity_clamped = max(0.0, min(1.0, (similarity + 1.0) / 2.0))

        return {
            "success": True,
            "similarity_score": similarity_clamped,
            "raw_cosine": similarity,
            "match": similarity_clamped >= 0.70
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ──────────────────────────────────────────────────────────────────────────────
# Endpoint 4: /analyze-speech (intent classification — kept for compatibility)
# ──────────────────────────────────────────────────────────────────────────────

@app.post("/analyze-speech")
async def analyze_speech(file: UploadFile = File(...)):
    """Legacy: intent classification with softmax confidence (not speaker verification)."""
    if model is None:
        raise HTTPException(status_code=503, detail="ML model not loaded.")

    try:
        waveform = await audio_to_waveform(file)
        device = next(model.parameters()).device
        wav_tensor = waveform.unsqueeze(0).to(device)
        rel_length = torch.tensor([1.0]).to(device)

        with torch.no_grad():
            outputs = model(wav_tensor, wav_lens=rel_length)
            probs = torch.nn.functional.softmax(outputs, dim=-1)
            predicted_class = torch.argmax(probs, dim=-1).item()
            confidence = probs[0][predicted_class].item()

        return {
            "success": True,
            "prediction": predicted_class,
            "confidence": confidence,
            "all_probabilities": probs[0].tolist()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ──────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)

"""
Trains the ConfidenceHead classifier on top of frozen ECAPA-TDNN speaker
embeddings, using the local synthetic_dataset (see generate_dataset.py) and
its dataset_labels.csv (60 samples, 3 classes: 0=Low, 1=Neutral, 2=High
confidence).

This produces confidence_head.ckpt, loaded by app.py at startup to classify
a candidate's spoken interview answers into a confidence level as part of
the real (non-static) Speech Analysis pipeline.

Run from the python_ml_service/ directory:
    python train_confidence_head.py
"""
import csv
import os

os.environ["SB_FETCH_STRATEGY"] = "copy"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

# Windows symlink fix — see train_ecapa.py for details. Kept identical so this
# script also works out of the box on a Windows dev machine without admin rights.
import speechbrain.utils.fetching as _sb_fetch
from speechbrain.utils.fetching import LocalStrategy as _LS

_orig_link = _sb_fetch.link_with_strategy
_sb_fetch.link_with_strategy = (
    lambda src, dst, strat: _orig_link(src, dst, _LS.COPY if strat == _LS.SYMLINK else strat)
)
import speechbrain.utils.parameter_transfer as _sb_pt
_orig_collect = _sb_pt.Pretrainer.collect_files
def _patched_collect(self, default_source=None, local_strategy=_LS.COPY, fetch_config=None):
    from speechbrain.utils.fetching import FetchConfig
    if fetch_config is None:
        fetch_config = FetchConfig()
    return _orig_collect(self, default_source=default_source, local_strategy=local_strategy, fetch_config=fetch_config)
_sb_pt.Pretrainer.collect_files = _patched_collect

import numpy as np
import soundfile as sf
import torch
import torch.nn as nn
from speechbrain.inference.speaker import EncoderClassifier

from confidence_model import ConfidenceHead, CONFIDENCE_HEAD_PATH, CONFIDENCE_CLASSES

LABELS_CSV = "dataset_labels.csv"
EPOCHS = 60
LEARNING_RATE = 1e-3
VAL_FRACTION = 0.2
SEED = 42


def load_labels(csv_path: str):
    rows = []
    with open(csv_path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # dataset_labels.csv was generated with Windows-style paths — normalize.
            filepath = row["filepath"].replace("\\", os.sep).replace("/", os.sep)
            rows.append((filepath, int(row["label"])))
    return rows


def extract_all_embeddings(rows, encoder: EncoderClassifier):
    embeddings, labels = [], []
    for filepath, label in rows:
        data, sr = sf.read(filepath, dtype="float32")
        wav = torch.from_numpy(data)
        if wav.ndim > 1:
            wav = wav.mean(dim=-1)
        if sr != 16000:
            import torchaudio
            wav = torchaudio.functional.resample(wav.unsqueeze(0), sr, 16000).squeeze(0)
        with torch.no_grad():
            emb = encoder.encode_batch(wav.unsqueeze(0)).squeeze(0).squeeze(0)  # (192,)
        embeddings.append(emb)
        labels.append(label)
    return torch.stack(embeddings), torch.tensor(labels, dtype=torch.long)


def stratified_split(labels: torch.Tensor, val_fraction: float, seed: int):
    rng = np.random.RandomState(seed)
    train_idx, val_idx = [], []
    for cls in torch.unique(labels).tolist():
        cls_idx = (labels == cls).nonzero(as_tuple=True)[0].tolist()
        rng.shuffle(cls_idx)
        n_val = max(1, int(len(cls_idx) * val_fraction))
        val_idx.extend(cls_idx[:n_val])
        train_idx.extend(cls_idx[n_val:])
    return train_idx, val_idx


def train():
    print("Loading dataset labels...")
    rows = load_labels(LABELS_CSV)
    print(f"Found {len(rows)} labeled samples across {len(set(l for _, l in rows))} classes.")

    print("Loading pretrained ECAPA-TDNN encoder (frozen feature extractor)...")
    encoder = EncoderClassifier.from_hparams(
        source="speechbrain/spkrec-ecapa-voxceleb", savedir="tmpdir_ecapa"
    )
    for p in encoder.mods.parameters():
        p.requires_grad = False

    print("Extracting 192-dim ECAPA embeddings for every sample...")
    embeddings, labels = extract_all_embeddings(rows, encoder)
    print(f"Embeddings shape: {tuple(embeddings.shape)}")

    train_idx, val_idx = stratified_split(labels, VAL_FRACTION, SEED)
    x_train, y_train = embeddings[train_idx], labels[train_idx]
    x_val, y_val = embeddings[val_idx], labels[val_idx]
    print(f"Train samples: {len(train_idx)}, Val samples: {len(val_idx)}")

    head = ConfidenceHead(num_classes=len(CONFIDENCE_CLASSES))
    optimizer = torch.optim.Adam(head.parameters(), lr=LEARNING_RATE)
    criterion = nn.CrossEntropyLoss()

    print("Training ConfidenceHead classifier on frozen ECAPA embeddings...")
    head.train()
    for epoch in range(1, EPOCHS + 1):
        optimizer.zero_grad()
        logits = head(x_train)
        loss = criterion(logits, y_train)
        loss.backward()
        optimizer.step()

        if epoch % 10 == 0 or epoch == 1:
            head.eval()
            with torch.no_grad():
                val_logits = head(x_val)
                val_loss = criterion(val_logits, y_val).item()
                val_acc = (val_logits.argmax(dim=-1) == y_val).float().mean().item()
            head.train()
            print(f"Epoch {epoch:3d}/{EPOCHS} | train_loss={loss.item():.4f} | val_loss={val_loss:.4f} | val_acc={val_acc*100:.1f}%")

    head.eval()
    with torch.no_grad():
        final_val_acc = (head(x_val).argmax(dim=-1) == y_val).float().mean().item()
    print(f"Final validation accuracy: {final_val_acc*100:.1f}%")

    torch.save(head.state_dict(), CONFIDENCE_HEAD_PATH)
    print(f"Saved trained confidence classifier head to {CONFIDENCE_HEAD_PATH}")


if __name__ == "__main__":
    train()

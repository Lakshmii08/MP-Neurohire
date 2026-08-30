import os
os.environ["SB_FETCH_STRATEGY"] = "copy"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

# ── Windows Symlink Fix ────────────────────────────────────────────────────────
# SpeechBrain defaults to SYMLINK strategy which requires elevated privileges
# on Windows (WinError 1314). We monkeypatch it to use COPY instead so the
# ECAPA-TDNN model loads without needing Developer Mode or Admin rights.
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


# pyrefly: ignore [missing-import]
import torch
# pyrefly: ignore [missing-import]
import torchaudio
# pyrefly: ignore [missing-import]
import torch.nn as nn
# pyrefly: ignore [missing-import]
from torch.utils.data import DataLoader, Dataset
# pyrefly: ignore [missing-import]
import speechbrain as sb
# pyrefly: ignore [missing-import]
from speechbrain.inference.speaker import EncoderClassifier
# pyrefly: ignore [missing-import]
# datasets is imported inside train() to avoid import errors when this module
# is loaded by app.py (which only needs ECAPAClassifier for inference)
# pyrefly: ignore [missing-import]
import numpy as np

# Hyperparameters
EPOCHS = 3 # Keep low for quick demonstration
BATCH_SIZE = 4
LEARNING_RATE = 1e-4
# PolyAI/minds14 has 14 intent classes. 
NUM_CLASSES = 14
MODEL_SAVE_PATH = "ecapa_finetuned.ckpt"

# HuggingFace Dataset wrapper
class HFDatasetWrapper(Dataset):
    def __init__(self, hf_dataset):
        self.dataset = hf_dataset

    def __len__(self):
        return len(self.dataset)

    def __getitem__(self, idx):
        item = self.dataset[idx]
        
        # HuggingFace audio features are decoded as numpy arrays
        audio_array = item['audio']['array']
        sample_rate = item['audio']['sampling_rate']
        label = item['intent_class']
        
        # Convert to torch tensor
        waveform = torch.tensor(audio_array, dtype=torch.float32).unsqueeze(0) # (1, length)
        
        # Resample to 16kHz (SpeechBrain ECAPA expects 16kHz)
        if sample_rate != 16000:
            resampler = torchaudio.transforms.Resample(orig_freq=sample_rate, new_freq=16000)
            waveform = resampler(waveform)

        return waveform.squeeze(0), label

class ECAPAClassifier(nn.Module):
    def __init__(self, num_classes):
        super(ECAPAClassifier, self).__init__()
        # Load pre-trained ECAPA-TDNN from HuggingFace
        self.ecapa = EncoderClassifier.from_hparams(
            source="speechbrain/spkrec-ecapa-voxceleb", 
            savedir="tmpdir_ecapa"
        )
        
        # Freeze ECAPA extractor to speed up initial training and prevent overfitting
        for param in self.ecapa.parameters():
            param.requires_grad = False
            
        # Add a custom classification head
        self.classifier = nn.Sequential(
            nn.Linear(192, 64), # ECAPA-TDNN outputs 192-dimensional embeddings
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(64, num_classes)
        )

    def forward(self, wavs, wav_lens=None):
        # Extract embeddings
        embeddings = self.ecapa.encode_batch(wavs, wav_lens=wav_lens) # shape: (batch, 1, 192)
        embeddings = embeddings.squeeze(1) # shape: (batch, 192)
        
        # Classify
        out = self.classifier(embeddings)
        return out

def pad_collate(batch):
    # Padding sequences to the same length in the batch
    wavs = [item[0] for item in batch]
    labels = torch.tensor([item[1] for item in batch])
    
    lengths = torch.tensor([len(w) for w in wavs])
    wavs_padded = torch.nn.utils.rnn.pad_sequence(wavs, batch_first=True)
    
    # Calculate relative lengths for SpeechBrain
    rel_lengths = lengths / lengths.max()
    
    return wavs_padded, rel_lengths, labels

def train():
    from datasets import load_dataset  # Only needed during training, not inference
    print("Downloading/Loading PolyAI/minds14 dataset from HuggingFace...")
    # Loading just the en-US subset for speed
    hf_ds = load_dataset("PolyAI/minds14", "en-US", split="train")
    
    print(f"Dataset loaded. Number of samples: {len(hf_ds)}")
    
    print("Initializing Model...")
    model = ECAPAClassifier(NUM_CLASSES)
    
    optimizer = torch.optim.Adam(model.classifier.parameters(), lr=LEARNING_RATE)
    criterion = nn.CrossEntropyLoss()
        
    dataset = HFDatasetWrapper(hf_ds)
    dataloader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True, collate_fn=pad_collate)
    
    model.train()
    print("Starting Training...")
    
    for epoch in range(EPOCHS):
        total_loss = 0
        for i, (wavs, rel_lens, labels) in enumerate(dataloader):
            optimizer.zero_grad()
            
            outputs = model(wavs, wav_lens=rel_lens)
            loss = criterion(outputs, labels)
            
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
            
            if (i+1) % 10 == 0:
                print(f"Epoch {epoch+1}/{EPOCHS}, Step {i+1}/{len(dataloader)}, Loss: {loss.item():.4f}")
                
        print(f"Epoch {epoch+1}/{EPOCHS} Summary -> Avg Loss: {total_loss/len(dataloader):.4f}")
        
    # Save the model
    torch.save(model.state_dict(), MODEL_SAVE_PATH)
    print(f"Training complete. Model saved to {MODEL_SAVE_PATH}")

if __name__ == "__main__":
    train()

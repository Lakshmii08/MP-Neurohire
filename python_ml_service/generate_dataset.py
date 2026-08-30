import os
# pyrefly: ignore [missing-import]
import torch
# pyrefly: ignore [missing-import]
import torchaudio

def generate_dataset():
    output_dir = "synthetic_dataset"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    print(f"Generating synthetic audio dataset in {output_dir}...")
    
    # 3 classes: 0 = Low, 1 = Neutral, 2 = High Confidence
    num_samples_per_class = 20
    
    labels = []
    
    for class_id in range(3):
        for i in range(num_samples_per_class):
            filename = f"sample_class{class_id}_{i}.wav"
            filepath = os.path.join(output_dir, filename)
            
            # Generate 1 second of audio at 16000 Hz
            sample_rate = 16000
            duration = 1.0
            t = torch.linspace(0, duration, int(sample_rate * duration))
            
            # Create distinguishable synthetic audio patterns for the 3 classes
            if class_id == 0:
                # Low confidence (low freq sine wave + noise)
                waveform = 0.2 * torch.sin(2 * 3.1415 * 100 * t) + 0.05 * torch.randn(1, int(sample_rate * duration))
            elif class_id == 1:
                # Neutral (mid freq sine wave + noise)
                waveform = 0.5 * torch.sin(2 * 3.1415 * 400 * t) + 0.1 * torch.randn(1, int(sample_rate * duration))
            else:
                # High confidence (high freq sine wave + noise)
                waveform = 0.8 * torch.sin(2 * 3.1415 * 800 * t) + 0.2 * torch.randn(1, int(sample_rate * duration))
                
            torchaudio.save(filepath, waveform, sample_rate)
            labels.append(f"{filepath},{class_id}")
            
    # Save a CSV with labels
    with open("dataset_labels.csv", "w") as f:
        f.write("filepath,label\n")
        for label in labels:
            f.write(f"{label}\n")
            
    print("Dataset generation complete. Labels saved to dataset_labels.csv")

if __name__ == "__main__":
    generate_dataset()

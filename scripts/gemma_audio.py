"""Offline, bounded Gemma4 ASR evaluation helper; not a production replacement."""
import math
import time

PROMPT = ("Transcribe the following speech segment in its original language. "
          "Only output the transcription, with no newlines. When transcribing numbers, write digits.")


def load_model(snapshot):
    import torch
    from transformers import AutoModelForImageTextToText, AutoProcessor
    torch.set_num_threads(4)
    processor = AutoProcessor.from_pretrained(snapshot, local_files_only=True, trust_remote_code=False)
    model = AutoModelForImageTextToText.from_pretrained(snapshot, local_files_only=True,
                                                     trust_remote_code=False, dtype=torch.float32)
    model.eval()
    return model, processor


def transcribe(model, processor, samples):
    import numpy as np
    import torch
    pcm = np.asarray(samples, dtype=np.float32)
    if pcm.ndim != 1 or not 0 < len(pcm) <= 30 * 16000 or not np.isfinite(pcm).all() or np.abs(pcm).max() > 1.0001:
        raise ValueError("Gemma ASR evaluation requires finite mono16kHz PCM, at most30 seconds, normalized to[-1,1].")
    messages = [{"role": "user", "content": [{"type": "text", "text": PROMPT}, {"type": "audio"}]}]
    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True, enable_thinking=False)
    inputs = processor(text=text, audio=[pcm], sampling_rate=16000, return_tensors="pt")
    started = time.perf_counter()
    with torch.inference_mode():
        output = model.generate(**inputs, max_new_tokens=192, max_time=120, do_sample=False)
    tokens = output[0, inputs["input_ids"].shape[-1]:]
    transcript = processor.decode(tokens, skip_special_tokens=True).strip()
    return {"text": transcript, "generationSeconds": round(time.perf_counter() - started, 3),
            "generatedTokens": len(tokens), "hitTokenLimit": len(tokens) >= 192,
            "hitTimeLimit": time.perf_counter() - started >= 120,
            "wordTimestamps": False}

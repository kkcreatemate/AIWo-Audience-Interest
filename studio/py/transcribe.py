#!/usr/bin/env python3
"""KK Verse Studio · speech → word timings.

Usage: transcribe.py <audio.wav> <out.json> [--model small] [--lang auto|en|hi|...] [--prompt "names, brands"]

Writes {"language": "..", "duration": .., "model": "..", "words": [{"w": "word", "s": 0.12, "e": 0.40}, ...]}.
Runs fully on this machine with faster-whisper; the model is downloaded once on first use.
"""
import argparse
import json
import sys


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("out")
    ap.add_argument("--model", default="small")
    ap.add_argument("--lang", default="auto")
    ap.add_argument("--prompt", default="")
    a = ap.parse_args()

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.exit("faster-whisper is not installed. Run the one-time setup: bash studio/setup.sh")

    try:
        model = WhisperModel(a.model, device="cpu", compute_type="int8")
    except Exception as e:  # most often: the model could not be downloaded
        sys.exit(
            f"Could not load the speech model '{a.model}': {e}\n"
            "It is downloaded from huggingface.co the first time. Check the connection (or that the host is allowed) and try again."
        )

    segments, info = model.transcribe(
        a.audio,
        language=None if a.lang in ("auto", "") else a.lang,
        word_timestamps=True,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 400},
        initial_prompt=a.prompt or None,
        condition_on_previous_text=False,
        beam_size=5,
    )
    words = []
    for seg in segments:
        for w in seg.words or []:
            text = w.word.strip()
            if not text:
                continue
            s, e = float(w.start), float(w.end)
            if words and s < words[-1]["e"]:
                s = words[-1]["e"]
            words.append({"w": text, "s": round(s, 3), "e": round(max(e, s + 0.02), 3)})
        print(f"  … {seg.end:6.1f}s  {seg.text.strip()[:70]}", file=sys.stderr, flush=True)

    out = {"language": info.language, "duration": round(float(info.duration), 3), "model": a.model, "words": words}
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(json.dumps({"language": info.language, "words": len(words)}))


if __name__ == "__main__":
    main()

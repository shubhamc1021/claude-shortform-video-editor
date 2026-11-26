#!/usr/bin/env python3
"""Word-level captions built take by take:  python tools/take_captions.py <slug>

Transcribes each picked take from source.mp4 on its own (with word timings) and maps the words onto
the cut timeline using cut_map.json. More accurate than transcribing the whole cut: cut-in clips with
their own sound (TV audio, music) can't throw Whisper off, and short takes keep their last word.
If insert.json exists ({"insert_at": seconds, "insert_dur": seconds}), words after the insert point
are shifted by its length. Prints each take's text so clipped endings are easy to spot.
Writes words.json (same shape as ./edit captions).
"""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import whisper

ROOT = Path(__file__).resolve().parent.parent
slug = sys.argv[1]
P = ROOT / "projects" / slug
cut_map = json.loads((P / "cut_map.json").read_text())
ins = json.loads((P / "insert.json").read_text()) if (P / "insert.json").exists() else None
model = whisper.load_model("medium")
out = []
with tempfile.TemporaryDirectory() as tmp:
    for k, sg in enumerate(cut_map["segments"]):
        wav = Path(tmp) / f"p{k}.wav"
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", str(sg["s"]), "-to", str(sg["e"]), "-i", str(P / "source.mp4"),
                        "-ac", "1", "-ar", "16000", "-af", "apad=pad_dur=0.6", str(wav)], check=True)
        # the take's own note (minus labels like "L3" and arrows) hints the expected words
        hint = re.sub(r"\bL\d+\b|->.*|\(.*?\)", "", sg.get("note", "")).strip()
        r = model.transcribe(str(wav), language="en", fp16=False, word_timestamps=True, initial_prompt=hint or None,
                             condition_on_previous_text=False)
        off = sg["cut_s"] + (ins["insert_dur"] if ins and sg["cut_s"] >= ins["insert_at"] - 0.01 else 0)
        dur = sg["e"] - sg["s"]
        words = [w for s in r["segments"] for w in s["words"] if w["start"] < dur]
        for w in words:
            out.append({"text": w["word"].strip(), "s": round(off + w["start"], 2), "e": round(off + min(w["end"], dur), 2)})
        print(f"#{k + 1:<3} {off:6.2f}s  {' '.join(w['word'].strip() for w in words)}")
for a, b in zip(out, out[1:]):
    a["e"] = min(a["e"], b["s"])
dur = cut_map["duration"] + (ins["insert_dur"] if ins else 0)
(P / "words.json").write_text(json.dumps({"duration": round(dur, 3), "words": out}))
print(f"{len(out)} words -> words.json ({dur:.1f}s)")

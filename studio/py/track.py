#!/usr/bin/env python3
"""KK Verse Studio · person cut-out + face track.

Usage: track.py <video> --matte out.mp4 --track out.json --fps 30 --width 432 --height 768 [--pre "<ffmpeg filters>"]

For every frame it writes
  * a grey "matte" video (white = the speaker, black = the room) so graphics can sit BEHIND the person
  * the face box and the top of the head, so effects know where the head is.
Runs fully on this machine with MediaPipe; two small models are downloaded once on first use.
"""
import argparse
import json
import os
import subprocess
import sys
import urllib.request

MODELS = {
    "selfie_multiclass_256x256.tflite": "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite",
    "blaze_face_short_range.tflite": "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite",
}


def model_path(name):
    d = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "models")
    os.makedirs(d, exist_ok=True)
    p = os.path.join(d, name)
    if not os.path.exists(p) or os.path.getsize(p) < 10000:
        print(f"  downloading {name} (one time)…", file=sys.stderr, flush=True)
        tmp = p + ".part"
        try:
            urllib.request.urlretrieve(MODELS[name], tmp)
        except Exception as e:
            sys.exit(f"Could not download {name}: {e}\nCheck the connection (storage.googleapis.com) and try again.")
        os.replace(tmp, p)
    return p


def smooth(vals, win):
    """Fill gaps by interpolation, then moving-average. vals: list of float|None."""
    import numpy as np

    n = len(vals)
    idx = [i for i, v in enumerate(vals) if v is not None]
    if not idx:
        return [None] * n
    arr = np.interp(np.arange(n), idx, [vals[i] for i in idx])
    if win > 1 and n > 1:
        k = min(win, n if n % 2 else n - 1)
        if k > 1:
            pad = k // 2
            padded = np.pad(arr, pad, mode="edge")
            arr = np.convolve(padded, np.ones(k) / k, mode="valid")
    return [round(float(v), 4) for v in arr]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--matte", required=True)
    ap.add_argument("--track", required=True)
    ap.add_argument("--fps", type=float, default=30)
    ap.add_argument("--width", type=int, required=True)
    ap.add_argument("--height", type=int, required=True)
    ap.add_argument("--pre", default="", help="ffmpeg filters applied before sampling (e.g. HDR tone-mapping)")
    ap.add_argument("--ranges", default="", help='only analyse these seconds, e.g. "2.5-6,11-14.2" (the rest of the matte is left empty)')
    a = ap.parse_args()
    ranges = []
    for part in [r for r in a.ranges.split(",") if r.strip()]:
        lo, hi = part.split("-", 1)
        ranges.append((float(lo), float(hi)))

    try:
        import numpy as np
        import mediapipe as mp
        from mediapipe.tasks.python import vision
        from mediapipe.tasks.python.core.base_options import BaseOptions
    except ImportError as e:
        sys.exit(f"MediaPipe is not installed ({e}). Run the one-time setup: bash studio/setup.sh")

    W, H = a.width, a.height
    seg = vision.ImageSegmenter.create_from_options(
        vision.ImageSegmenterOptions(
            base_options=BaseOptions(model_asset_path=model_path("selfie_multiclass_256x256.tflite")),
            running_mode=vision.RunningMode.VIDEO,
            output_confidence_masks=True,
            output_category_mask=False,
        )
    )
    det = vision.FaceDetector.create_from_options(
        vision.FaceDetectorOptions(
            base_options=BaseOptions(model_asset_path=model_path("blaze_face_short_range.tflite")),
            running_mode=vision.RunningMode.VIDEO,
            min_detection_confidence=0.45,
        )
    )

    vf = ",".join([f for f in [a.pre, f"fps={a.fps:g}", f"scale={W}:{H}:flags=bilinear", "format=rgb24"] if f])
    reader = subprocess.Popen(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", a.video, "-an", "-vf", vf, "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"],
        stdout=subprocess.PIPE,
    )
    writer = subprocess.Popen(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{W}x{H}", "-r", f"{a.fps:g}", "-i", "pipe:0",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "14", "-pix_fmt", "yuv420p", "-color_range", "pc", "-g", "30", a.matte],
        stdin=subprocess.PIPE,
    )

    size = W * H * 3
    blank = bytes(W * H)
    done = 0
    faces, tops = [], []
    prev = None
    n = 0
    guessed = 0
    while True:
        raw = reader.stdout.read(size)
        if len(raw) < size:
            break
        if ranges and not any(lo <= n / a.fps <= hi for lo, hi in ranges):
            writer.stdin.write(blank)  # not needed here: skip the heavy work, keep the frame count aligned
            faces.append(None)
            tops.append(None)
            prev = None
            n += 1
            continue
        frame = np.frombuffer(raw, dtype=np.uint8).reshape(H, W, 3)
        image = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(frame))
        ts = int(round(n * 1000.0 / a.fps))

        res = seg.segment_for_video(image, ts)
        bg = res.confidence_masks[0].numpy_view()
        bg = np.squeeze(np.asarray(bg, dtype=np.float32))
        person = 1.0 - bg
        if prev is not None:
            person = 0.72 * person + 0.28 * prev  # calm frame-to-frame flicker
        prev = person
        writer.stdin.write((np.clip(person, 0, 1) * 255).astype(np.uint8).tobytes())

        fd = det.detect_for_video(image, ts)
        best = None
        for d in fd.detections:
            b = d.bounding_box
            if best is None or b.width * b.height > best.width * best.height:
                best = b
        solid = person > 0.5
        if best is not None:
            cx, cy = (best.origin_x + best.width / 2) / W, (best.origin_y + best.height / 2) / H
            faces.append([cx, cy, best.width / W, best.height / H])
            x0, x1 = max(0, int(best.origin_x)), min(W, int(best.origin_x + best.width))
            col = solid[:, x0:x1].any(axis=1) if x1 > x0 else solid.any(axis=1)
            rows = np.flatnonzero(col)
            tops.append(float(rows[0]) / H if rows.size else None)
        else:
            rows = np.flatnonzero(solid.any(axis=1))
            if rows.size:  # no face found: estimate the head from the top of the cut-out
                top = int(rows[0])
                band = solid[top : top + max(4, int(H * 0.08))]
                cols = np.flatnonzero(band.any(axis=0))
                hw = (cols[-1] - cols[0]) / W if cols.size else 0.3
                cxm = (cols[0] + cols[-1]) / 2 / W if cols.size else 0.5
                hh = hw * W / H * 1.25
                faces.append([cxm, top / H + hh * 0.62, hw * 0.8, hh * 0.8])
                tops.append(top / H)
                guessed += 1
            else:
                faces.append(None)
                tops.append(None)
        n += 1
        done += 1
        if done % 150 == 0:
            print(f"  … tracked {done} frames", file=sys.stderr, flush=True)

    writer.stdin.close()
    writer.wait()
    reader.wait()
    if n == 0:
        sys.exit("No frames could be read from the video.")
    if writer.returncode != 0:
        sys.exit("ffmpeg could not write the matte video.")

    win = max(3, int(round(a.fps * 0.3)) | 1)
    found = sum(1 for f in faces if f is not None) - guessed
    have = found + guessed
    cols = [smooth([f[k] if f is not None else None for f in faces], win) for k in range(4)]
    face = [[cols[0][i], cols[1][i], cols[2][i], cols[3][i]] for i in range(n)] if have else []
    top = smooth(tops, win)
    out = {"fps": a.fps, "frames": n, "analysed": done, "ranges": [[lo, hi] for lo, hi in ranges] or None, "width": W, "height": H, "faceFrames": found, "face": face, "top": top if any(t is not None for t in top) else []}
    with open(a.track, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(json.dumps({"frames": n, "analysed": done, "faceFrames": found}))


if __name__ == "__main__":
    main()

"""Simulate a phone video sliding slowly down a receipt.
usage: python3 film.py receipt.png out.mp4 [secs=10] [W=720] [blur=1.2] [rot=1.5] [seed=1] [jitter=0]
Thermal-paper contrast, lighting gradient, slight tilt, motion blur from the pan, sensor noise,
H.264 compression. Deliberately worse than a real iPhone at 1080p."""
import sys, subprocess, numpy as np
from PIL import Image, ImageFilter
src, out = sys.argv[1], sys.argv[2]
secs = float(sys.argv[3]) if len(sys.argv) > 3 else 10
W = int(sys.argv[4]) if len(sys.argv) > 4 else 720
blur = float(sys.argv[5]) if len(sys.argv) > 5 else 1.2
rot = float(sys.argv[6]) if len(sys.argv) > 6 else 1.5
seed = int(sys.argv[7]) if len(sys.argv) > 7 else 1
jitter = float(sys.argv[8]) if len(sys.argv) > 8 else 0
H = W * 16 // 9; fps = 30
rng = np.random.default_rng(seed)
r = Image.open(src).convert("L")
scale = (W * 0.88) / r.width
r = r.resize((int(r.width * scale), int(r.height * scale)), Image.LANCZOS)
a = np.asarray(r).astype(np.float32)
a = 225 - (255 - a) * (225 - 75) / 255          # thermal: grey ink on off-white paper
paper = Image.fromarray(a.clip(0, 255).astype(np.uint8))
pad = 260
canvas = Image.new("L", (paper.width + 2 * pad, paper.height + 2 * pad), 55)   # dark table
canvas.paste(paper, (pad, pad))
canvas = canvas.rotate(rot, resample=Image.BICUBIC, fillcolor=55)
C = np.asarray(canvas).astype(np.float32)
x0 = (canvas.width - W) // 2
y_start, y_end = pad - 120, pad + paper.height - H + 120
n = int(secs * fps)
p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{W}x{H}",
                      "-r", str(fps), "-i", "-"] + (["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36", "-row-mt", "1", "-deadline", "realtime", "-cpu-used", "8"] if out.endswith(".webm") else ["-c:v", "libx264", "-crf", "26"]) + ["-pix_fmt", "yuv420p", out], stdin=subprocess.PIPE)
gx = np.linspace(0.85, 1.08, W)[None, :]; gy = np.linspace(1.05, 0.9, H)[:, None]
prev = y_start
for i in range(n):
    t = i / (n - 1)
    y = y_start + (y_end - y_start) * t + jitter * np.sin(i / 7.0) * 40
    y = int(max(0, min(C.shape[0] - H, y)))
    xx = int(x0 + jitter * np.sin(i / 11.0) * 15)
    f = C[y:y + H, xx:xx + W]
    speed = abs(y - prev); prev = y
    im = Image.fromarray(f.clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(blur))
    if speed > 2:                                          # vertical motion blur from the pan
        k = int(min(9, speed * 0.6)) | 1
        arr = np.asarray(im).astype(np.float32)
        arr = sum(np.roll(arr, s, axis=0) for s in range(-(k // 2), k // 2 + 1)) / k
        im = Image.fromarray(arr.clip(0, 255).astype(np.uint8))
    f = np.asarray(im).astype(np.float32) * gx * gy + rng.normal(0, 6, (H, W))
    p.stdin.write(f.clip(0, 255).astype(np.uint8).tobytes())
p.stdin.close(); p.wait()

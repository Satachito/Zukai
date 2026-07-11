#!/usr/bin/env python3
"""Build the API-free Zukai promo video from captured before/after frames."""

from pathlib import Path
import argparse
import json
import shutil
import subprocess

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "promo" / "api-free-demo"
OUT = ROOT / "promo" / "zukai-ai-demo-api-free.mp4"
GIF_OUT = ROOT / "Web" / "zukai-demo.gif"
W, H = 1280, 720


def font(size, bold=False):
    names = [
        "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc" if bold else "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for name in names:
        if Path(name).exists():
            return ImageFont.truetype(name, size)
    return ImageFont.load_default()


def prepare_variant():
    source = ROOT / "Samples" / "MultiCloud.zu"
    target = ROOT / "Samples" / "MultiCloudPromoAfter.zu"
    data = json.loads(source.read_text())
    for node in data["model"]["nodes"]:
        if node[0] == "VPN":
            node[1]["rV"] = round(node[1]["rV"] * 1.2, 1)
            break
    target.write_text(json.dumps(data, ensure_ascii=False, indent="\t") + "\n")
    print(target)


def fit_capture(path):
    im = Image.open(path).convert("RGB")
    im.thumbnail((1180, 560), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (W, H), "#080b12")
    canvas.paste(im, ((W - im.width) // 2, 102))
    return canvas


def text_center(draw, text, y, fnt, fill="#ffffff"):
    box = draw.textbbox((0, 0), text, font=fnt)
    draw.text(((W - box[2]) / 2, y), text, font=fnt, fill=fill)


def title_frame():
    im = Image.new("RGB", (W, H), "#080b12")
    d = ImageDraw.Draw(im)
    text_center(d, "Build cloud diagrams with AI.", 238, font(43, True))
    text_center(d, "クラウド構成図を、AIと一緒に。", 315, font(23), "#b6c2d9")
    text_center(d, "Zukai", 375, font(27, True), "#a78bfa")
    return im


def diagram_frame(path, label, accent):
    im = fit_capture(path)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((40, 28, 218, 82), radius=15, fill=accent)
    d.text((70, 40), label, font=font(23, True), fill="#ffffff")
    return im


def prompt_frame():
    im = Image.new("RGB", (W, H), "#080b12")
    d = ImageDraw.Draw(im)
    text_center(d, "PROMPT", 125, font(22, True), "#a78bfa")
    d.rounded_rectangle((125, 205, 1155, 425), radius=25, fill="#141927", outline="#5b6477", width=2)
    text_center(d, '“Make the VPN band 1.2× taller.”', 260, font(36, True))
    text_center(d, "「VPNの帯を1.2倍高くして」", 335, font(23), "#b6c2d9")
    text_center(d, "Edit diagrams in natural language.", 475, font(27, True), "#ffffff")
    text_center(d, "自然言語で図を編集", 525, font(19), "#9aa7bd")
    return im


def end_frame():
    im = Image.new("RGB", (W, H), "#080b12")
    d = ImageDraw.Draw(im)
    text_center(d, "Zukai", 155, font(56, True))
    text_center(d, "Diagram as JSON. Edit with AI.", 250, font(34, True), "#a78bfa")
    text_center(d, "JSONで保存。AIで編集。", 310, font(21), "#b6c2d9")
    text_center(d, "Free  •  Open source  •  No sign-up", 385, font(23, True), "#ffffff")
    text_center(d, "無料・オープンソース・登録不要", 430, font(18), "#9aa7bd")
    text_center(d, "satachito.github.io/Zukai/", 505, font(26, True), "#ffffff")
    return im


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--prepare", action="store_true")
    args = parser.parse_args()
    if args.prepare:
        prepare_variant()
        return
    import imageio_ffmpeg
    before = ASSETS / "before.png"
    after = ASSETS / "after.png"
    if not before.exists() or not after.exists():
        raise SystemExit("Capture promo/api-free-demo/before.png and after.png first")

    frames = ASSETS / "frames"
    if frames.exists():
        shutil.rmtree(frames)
    frames.mkdir(parents=True)

    segments = [
        (title_frame(), 75),
        (diagram_frame(before, "BEFORE", "#475569"), 90),
        (prompt_frame(), 105),
        (diagram_frame(after, "AFTER", "#7c3aed"), 120),
        (end_frame(), 120),
    ]
    # Lightweight README animation: 10 fps at 960x540.
    gif_frames = []
    for image, count in segments:
        resized = image.resize((960, 540), Image.Resampling.LANCZOS)
        gif_frames.extend([resized] * max(1, count // 3))
    gif_frames[0].save(
        GIF_OUT,
        save_all=True,
        append_images=gif_frames[1:],
        duration=100,
        loop=0,
        optimize=True,
    )
    idx = 0
    previous = None
    for image, count in segments:
        for n in range(count):
            frame = image.copy()
            # Short cross-fade from the preceding segment.
            if previous is not None and n < 12:
                frame = Image.blend(previous, frame, n / 12)
            frame.save(frames / f"frame-{idx:05d}.jpg", quality=91)
            idx += 1
        previous = image

    OUT.parent.mkdir(parents=True, exist_ok=True)
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run([
        ffmpeg, "-y", "-framerate", "30", "-i", str(frames / "frame-%05d.jpg"),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        "-crf", "22", str(OUT),
    ], check=True)
    print(OUT)


if __name__ == "__main__":
    main()

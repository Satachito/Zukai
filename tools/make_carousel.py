#!/usr/bin/env python3
"""Generate the three bilingual Zukai social carousel cards."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "promo" / "carousel"
BEFORE = ROOT / "promo" / "api-free-demo" / "before.png"
AFTER = ROOT / "promo" / "api-free-demo" / "after.png"
SIZE = 1080


def font(size, bold=False):
    choices = [
        "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc" if bold else "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for choice in choices:
        if Path(choice).exists():
            return ImageFont.truetype(choice, size)
    return ImageFont.load_default()


def base(number):
    im = Image.new("RGBA", (SIZE, SIZE), "#080b12")
    glow = Image.new("RGBA", im.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-300, 600, 500, 1400), fill=(85, 43, 170, 110))
    gd.ellipse((680, -320, 1450, 420), fill=(26, 93, 170, 75))
    glow = glow.filter(ImageFilter.GaussianBlur(130))
    im = Image.alpha_composite(im, glow)
    d = ImageDraw.Draw(im)
    d.text((58, 46), "Zukai", font=font(31, True), fill="#ffffff")
    d.text((935, 53), f"{number}/3", font=font(22, True), fill="#a78bfa")
    return im


def add_diagram(im, source, box):
    shot = Image.open(source).convert("RGB").crop((130, 85, 1278, 690))
    shot.thumbnail((box[2] - box[0], box[3] - box[1]), Image.Resampling.LANCZOS)
    x = box[0] + (box[2] - box[0] - shot.width) // 2
    y = box[1] + (box[3] - box[1] - shot.height) // 2
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((x - 3, y - 3, x + shot.width + 3, y + shot.height + 3), radius=12, fill="#a78bfa")
    im.paste(shot, (x, y))


def card1():
    im = base(1)
    d = ImageDraw.Draw(im)
    d.text((58, 135), "Build cloud diagrams", font=font(53, True), fill="#ffffff")
    d.text((58, 203), "with AI.", font=font(53, True), fill="#a78bfa")
    d.text((60, 280), "クラウド構成図を、AIと一緒に。", font=font(24), fill="#c2cada")
    add_diagram(im, AFTER, (55, 360, 1025, 875))
    d.rounded_rectangle((58, 925, 450, 980), radius=17, fill="#7c3aed")
    d.text((87, 938), "AWS  •  Azure  •  GCP", font=font(21, True), fill="#ffffff")
    return im


def card2():
    im = base(2)
    d = ImageDraw.Draw(im)
    d.text((58, 130), "Edit diagrams in", font=font(50, True), fill="#ffffff")
    d.text((58, 195), "natural language.", font=font(50, True), fill="#a78bfa")
    d.text((60, 270), "自然言語で図を編集", font=font(24), fill="#c2cada")
    d.rounded_rectangle((58, 340, 1022, 505), radius=24, fill="#151b28", outline="#4c5870", width=2)
    d.text((100, 385), '“Make the VPN band 1.2× taller.”', font=font(34, True), fill="#ffffff")
    d.text((102, 448), "「VPNの帯を1.2倍高くして」", font=font(21), fill="#aeb8ca")
    add_diagram(im, BEFORE, (55, 555, 522, 875))
    add_diagram(im, AFTER, (558, 555, 1025, 875))
    d.text((205, 895), "BEFORE", font=font(19, True), fill="#94a3b8")
    d.text((730, 895), "AFTER", font=font(19, True), fill="#a78bfa")
    # Redraw the corner branding above all content for reliable social previews.
    d.text((58, 46), "Zukai", font=font(31, True), fill="#ffffff")
    d.rectangle((900, 38, 1035, 92), fill="#080b12")
    d.text((935, 53), "2/3", font=font(22, True), fill="#a78bfa")
    return im


def card3():
    im = base(3)
    d = ImageDraw.Draw(im)
    d.text((58, 145), "Diagram as JSON.", font=font(53, True), fill="#ffffff")
    d.text((58, 213), "Edit with AI.", font=font(53, True), fill="#a78bfa")
    d.text((60, 291), "JSONで保存。AIで編集。", font=font(24), fill="#c2cada")
    features = [
        ("AWS  •  Azure  •  Google Cloud", "クラウド構成図に対応"),
        ("Open source", "オープンソース"),
        ("No installation. No sign-up.", "インストール・登録不要"),
        ("SVG  •  PDF  •  .zu", "複数形式で保存"),
    ]
    y = 390
    for english, japanese in features:
        d.rounded_rectangle((58, y, 1022, y + 105), radius=19, fill="#141a27", outline="#30394c", width=1)
        d.ellipse((88, y + 32, 112, y + 56), fill="#8b5cf6")
        d.text((140, y + 19), english, font=font(28, True), fill="#ffffff")
        d.text((140, y + 61), japanese, font=font(18), fill="#9eabc0")
        y += 123
    d.rounded_rectangle((58, 912, 725, 988), radius=18, fill="#7c3aed")
    d.text((89, 931), "satachito.github.io/Zukai/", font=font(26, True), fill="#ffffff")
    return im


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for index, image in enumerate((card1(), card2(), card3()), start=1):
        path = OUT / f"zukai-carousel-{index}.png"
        image.convert("RGB").save(path, "PNG", optimize=True)
        print(path)


if __name__ == "__main__":
    main()

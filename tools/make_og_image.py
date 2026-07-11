#!/usr/bin/env python3
"""Generate Zukai's bilingual 1200x630 Open Graph image."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "promo" / "api-free-demo" / "after.png"
OUTPUT = ROOT / "promo" / "zukai-og-en-ja.png"
PUBLIC_OUTPUT = ROOT / "Web" / "og-image.png"
W, H = 1200, 630


def font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc" if bold else "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def main():
    canvas = Image.new("RGB", (W, H), "#080b12")

    # Subtle violet/blue ambient glow matching the diagram palette.
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-220, 250, 560, 1010), fill=(74, 45, 160, 95))
    gd.ellipse((730, -300, 1480, 470), fill=(30, 92, 160, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), glow)

    # Product screenshot on the right, cropped to favor the diagram itself.
    shot = Image.open(SOURCE).convert("RGB")
    shot = shot.crop((130, 85, 1278, 690))
    shot.thumbnail((700, 510), Image.Resampling.LANCZOS)
    card = Image.new("RGBA", (shot.width + 4, shot.height + 4), "#a78bfa")
    card.paste(shot, (2, 2))
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    box = (530, 70, 530 + card.width, 70 + card.height)
    sd.rounded_rectangle(box, radius=18, fill=(0, 0, 0, 170))
    shadow = shadow.filter(ImageFilter.GaussianBlur(24))
    canvas = Image.alpha_composite(canvas, shadow)
    canvas.alpha_composite(card, (545, 55))

    d = ImageDraw.Draw(canvas)
    d.text((58, 49), "Zukai", font=font(33, True), fill="#ffffff")
    d.rounded_rectangle((58, 107, 274, 145), radius=19, fill="#7c3aed")
    d.text((80, 114), "OPEN SOURCE", font=font(16, True), fill="#ffffff")

    d.text((58, 187), "Build cloud", font=font(51, True), fill="#ffffff")
    d.text((58, 250), "diagrams", font=font(51, True), fill="#ffffff")
    d.text((58, 313), "with AI.", font=font(51, True), fill="#a78bfa")

    d.text((60, 398), "クラウド構成図を、AIと一緒に。", font=font(21), fill="#c2cada")
    d.text((60, 454), "AWS  •  Azure  •  Google Cloud", font=font(18, True), fill="#ffffff")
    d.text((60, 488), "JSON-native  •  No sign-up", font=font(18, True), fill="#ffffff")

    d.rounded_rectangle((58, 548, 472, 595), radius=13, fill="#151b28", outline="#414b60", width=1)
    d.text((80, 558), "satachito.github.io/Zukai/", font=font(18, True), fill="#ffffff")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(OUTPUT, "PNG", optimize=True)
    canvas.convert("RGB").save(PUBLIC_OUTPUT, "PNG", optimize=True)
    print(OUTPUT)
    print(PUBLIC_OUTPUT)


if __name__ == "__main__":
    main()

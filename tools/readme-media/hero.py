"""The README's hero: a tenor's rehearsal page on a phone, in front of the
screen where the conductor reviews what the model read from a score.

Composed from two stills already in docs/assets/, both themes and both
languages: `score-compiler-review[-en]-<theme>.png` (shots.mjs, 2880x1800)
and `rehearsal-singer[-en]-<theme>.png` (780x1688). Copy fresh takes there
first, then run from anywhere: `python hero.py`. Writes
`hero[-en]-<theme>.png`, 1720x860, beside them.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ASSETS = Path(__file__).resolve().parents[2] / "docs" / "assets"
W, H = 1720, 860
PHONE_HEIGHT = 770
PHONE_LEFT = 172
RADIUS = 36


def hero(review: Path, phone_src: Path, out: Path, light: bool) -> None:
    # The review without the app's side rail, scaled to the hero's width and
    # cut at its height, so the form's first fields stay in view.
    bg = Image.open(review).convert("RGB").crop((240, 0, 2880, 1800))
    bg = bg.resize((W, int(bg.height * W / bg.width)), Image.LANCZOS).crop((0, 0, W, H))

    # The left part fades into the page colour, so the phone reads first and
    # the review's form stays sharp on the right.
    base = (236, 231, 222) if light else (18, 15, 12)
    peak = 205 if light else 225
    shade = Image.new("L", (W, H), 0)
    draw = ImageDraw.Draw(shade)
    span = W * 0.58
    for x in range(W):
        t = x / span
        alpha = peak if t < 0.55 else int(peak * max(0.0, 1 - (t - 0.55) / 0.45))
        draw.line([(x, 0), (x, H)], fill=alpha)
    bg = Image.composite(Image.new("RGB", (W, H), base), bg, shade)

    phone = Image.open(phone_src).convert("RGB")
    phone = phone.resize((int(phone.width * PHONE_HEIGHT / phone.height), PHONE_HEIGHT), Image.LANCZOS)
    mask = Image.new("L", phone.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, phone.width - 1, phone.height - 1], RADIUS, fill=255)
    px, py = PHONE_LEFT, (H - PHONE_HEIGHT) // 2

    pad = 110
    shadow = Image.new("L", (phone.width + 2 * pad, phone.height + 2 * pad), 0)
    ImageDraw.Draw(shadow).rounded_rectangle(
        [pad, pad + 14, pad + phone.width, pad + 14 + phone.height], RADIUS, fill=150 if light else 200,
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(26))
    bg.paste(Image.new("RGB", shadow.size, (40, 32, 24) if light else (0, 0, 0)), (px - pad, py - pad), shadow)

    bezel = 7 if light else 6
    frame = Image.new("RGB", (phone.width + 2 * bezel, phone.height + 2 * bezel),
                      (58, 50, 42) if light else (70, 62, 52))
    frame_mask = Image.new("L", frame.size, 0)
    ImageDraw.Draw(frame_mask).rounded_rectangle(
        [0, 0, frame.width - 1, frame.height - 1], RADIUS + bezel, fill=255,
    )
    bg.paste(frame, (px - bezel, py - bezel), frame_mask)
    bg.paste(phone, (px, py), mask)
    bg.save(out, optimize=True)


if __name__ == "__main__":
    for suffix in ("-en", ""):
        for theme in ("light", "dark"):
            out = ASSETS / f"hero{suffix}-{theme}.png"
            hero(
                ASSETS / f"score-compiler-review{suffix}-{theme}.png",
                ASSETS / f"rehearsal-singer{suffix}-{theme}.png",
                out,
                light=theme == "light",
            )
            print(out.name, out.stat().st_size // 1024, "KB")

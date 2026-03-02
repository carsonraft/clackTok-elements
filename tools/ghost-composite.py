#!/usr/bin/env python3
"""
Ghost Composite — overlay sequential game frames for motion debugging.

Produces a stroboscopic image where earlier frames are brighter and later
frames fade out, making ball movement, weapon rotation, and projectile
trajectories visible in a single image.

Usage:
    python3 tools/ghost-composite.py ~/Downloads/frame_*.png
    python3 tools/ghost-composite.py ~/Downloads/frame_*.png -o debug.png
    python3 tools/ghost-composite.py ~/Downloads/frame_*.png --mode strip
    python3 tools/ghost-composite.py ~/Downloads/frame_*.png --mode tinted
    python3 tools/ghost-composite.py ~/Downloads/frame_*.png --mode diff

Modes:
    ghost  — (default) alpha-blended overlay, newest frame faintest
    strip  — horizontal side-by-side strip with frame numbers
    tinted — each frame gets a unique color tint (red/green/blue/yellow/cyan)
    diff   — highlight only pixels that changed between frames
"""

import argparse
import os
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont, ImageChops
except ImportError:
    print("Pillow not installed. Run: pip3 install Pillow", file=sys.stderr)
    sys.exit(1)


def ghost_composite(frames, out_path):
    """Alpha-blend frames: first = opaque, each subsequent fades more."""
    n = len(frames)
    # Alpha curve: first frame fully opaque, last at ~20%
    alphas = [1.0 - (i * 0.8 / max(n - 1, 1)) for i in range(n)]

    base = Image.new('RGBA', frames[0].size, (0, 0, 0, 0))
    for frame, alpha in zip(frames, alphas):
        layer = frame.convert('RGBA')
        r, g, b, a = layer.split()
        a = a.point(lambda x: int(x * alpha))
        layer = Image.merge('RGBA', (r, g, b, a))
        base = Image.alpha_composite(base, layer)

    # Flatten to RGB with white background (matches game cream bg)
    result = Image.new('RGB', base.size, (255, 255, 255))
    result.paste(base, mask=base.split()[3])
    result.save(out_path, 'PNG')
    print(f"Ghost composite: {out_path} ({result.size[0]}x{result.size[1]})")


def strip_composite(frames, out_path):
    """Side-by-side horizontal strip with frame numbers."""
    n = len(frames)
    w, h = frames[0].size
    strip = Image.new('RGB', (w * n, h), (30, 30, 30))
    draw = ImageDraw.Draw(strip)

    for i, frame in enumerate(frames):
        strip.paste(frame.convert('RGB'), (i * w, 0))
        # Frame number label at top-left of each panel
        label = f"F{i}"
        draw.rectangle([(i * w, 0), (i * w + 40, 24)], fill=(0, 0, 0, 180))
        draw.text((i * w + 4, 2), label, fill=(255, 255, 0))

    strip.save(out_path, 'PNG')
    print(f"Strip composite: {out_path} ({strip.size[0]}x{strip.size[1]})")


TINT_COLORS = [
    (255, 80, 80),    # red
    (80, 255, 80),    # green
    (80, 120, 255),   # blue
    (255, 255, 80),   # yellow
    (80, 255, 255),   # cyan
]

def tinted_composite(frames, out_path):
    """Each frame gets a unique color tint, overlaid at partial opacity."""
    n = len(frames)
    base = Image.new('RGBA', frames[0].size, (255, 255, 255, 255))

    for i, frame in enumerate(frames):
        layer = frame.convert('RGBA')
        tint = TINT_COLORS[i % len(TINT_COLORS)]
        # Create a solid tint overlay
        tint_layer = Image.new('RGBA', layer.size, (*tint, 0))
        # Blend: mix original with tint at 40%
        r, g, b, a = layer.split()
        tr, tg, tb = tint
        r = r.point(lambda x: int(x * 0.6 + tr * 0.4))
        g = g.point(lambda x: int(x * 0.6 + tg * 0.4))
        b = b.point(lambda x: int(x * 0.6 + tb * 0.4))
        # Set opacity: first frame stronger
        alpha_val = int(255 * (0.7 - i * 0.1))
        a = a.point(lambda x: min(x, alpha_val))
        tinted = Image.merge('RGBA', (r, g, b, a))
        base = Image.alpha_composite(base, tinted)

    result = base.convert('RGB')
    result.save(out_path, 'PNG')
    print(f"Tinted composite: {out_path} ({result.size[0]}x{result.size[1]})")


def diff_composite(frames, out_path):
    """
    Highlight only changed pixels. Static background stays neutral,
    movement shows up as bright color per frame.
    """
    n = len(frames)
    base_rgb = frames[0].convert('RGB')
    w, h = base_rgb.size

    # Start with a dimmed version of the first frame as the base
    result = Image.new('RGB', (w, h), (240, 240, 240))

    for i in range(1, n):
        curr = frames[i].convert('RGB')
        diff = ImageChops.difference(base_rgb, curr)
        # Amplify differences (threshold at 15 to cut noise)
        diff = diff.point(lambda x: min(255, x * 4) if x > 15 else 0)
        # Tint the diff
        tint = TINT_COLORS[i % len(TINT_COLORS)]
        dr, dg, db = diff.split()
        # Use max channel as mask intensity
        mask = ImageChops.lighter(dr, ImageChops.lighter(dg, db))
        tint_img = Image.new('RGB', (w, h), tint)
        result = Image.composite(tint_img, result, mask)
        base_rgb = curr  # diff against previous frame

    result.save(out_path, 'PNG')
    print(f"Diff composite: {out_path} ({result.size[0]}x{result.size[1]})")


def main():
    parser = argparse.ArgumentParser(
        description='Composite sequential game frames for motion debugging.')
    parser.add_argument('frames', nargs='+', help='PNG frame files (in order)')
    parser.add_argument('-o', '--output', default=None,
                        help='Output path (default: ghost_composite.png in same dir as first frame)')
    parser.add_argument('-m', '--mode', default='ghost',
                        choices=['ghost', 'strip', 'tinted', 'diff'],
                        help='Composite mode (default: ghost)')
    args = parser.parse_args()

    # Sort frames by name to ensure correct order
    paths = sorted(args.frames)
    if len(paths) < 2:
        print("Need at least 2 frames.", file=sys.stderr)
        sys.exit(1)

    frames = []
    for p in paths:
        try:
            frames.append(Image.open(p))
        except Exception as e:
            print(f"Failed to open {p}: {e}", file=sys.stderr)
            sys.exit(1)

    # Default output path: same directory as first frame
    if args.output:
        out_path = args.output
    else:
        out_dir = str(Path(paths[0]).parent)
        out_path = os.path.join(out_dir, f'{args.mode}_composite.png')

    mode_fn = {
        'ghost': ghost_composite,
        'strip': strip_composite,
        'tinted': tinted_composite,
        'diff': diff_composite,
    }
    mode_fn[args.mode](frames, out_path)


if __name__ == '__main__':
    main()

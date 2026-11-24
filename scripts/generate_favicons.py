import os
from PIL import Image, ImageDraw

def render_code_pulse(size, radius_ratio=0.22, stroke_ratio=0.07):
    """
    Renders the Code Pulse icon at a specific pixel size with super-sampling for crisp antialiasing.
    """
    scale = 4  # 4x super-sampling for ultra crisp lines
    w = size * scale
    h = size * scale

    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Background rounded rectangle
    bg_color = (8, 9, 11, 255)  # #08090B
    border_color = (255, 255, 255, 35)  # rgba(255,255,255,0.14)
    radius = int(w * radius_ratio)
    border_w = max(1, int(w * 0.015))

    # Draw rounded background
    draw.rounded_rectangle([(border_w, border_w), (w - border_w - 1, h - border_w - 1)], radius=radius, fill=bg_color, outline=border_color, width=border_w)

    # 2. Geometry coordinates mapped to size
    amber = (234, 179, 8, 255)  # #EAB308
    stroke_w = max(2, int(w * stroke_ratio))

    def pt(x, y):
        return (int(x * w / 64.0), int(y * h / 64.0))

    # Left Bracket: (15, 18) -> (7, 32) -> (15, 46)
    left_bracket = [pt(15, 18), pt(7, 32), pt(15, 46)]
    draw.line(left_bracket, fill=amber, width=stroke_w, joint="round")
    # Round endpoints
    for p in [left_bracket[0], left_bracket[-1]]:
        r = stroke_w // 2
        draw.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=amber)

    # Pulse waveform: (18, 32) -> (22, 32) -> (25, 35) -> (30, 15) -> (35, 49) -> (39, 27) -> (42, 32) -> (46, 32)
    pulse = [
        pt(18, 32),
        pt(22, 32),
        pt(25, 35),
        pt(30, 15),
        pt(35, 49),
        pt(39, 27),
        pt(42, 32),
        pt(46, 32),
    ]
    draw.line(pulse, fill=amber, width=int(stroke_w * 0.92), joint="round")
    for p in [pulse[0], pulse[-1]]:
        r = int(stroke_w * 0.92) // 2
        draw.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=amber)

    # Right Bracket: (49, 18) -> (57, 32) -> (49, 46)
    right_bracket = [pt(49, 18), pt(57, 32), pt(49, 46)]
    draw.line(right_bracket, fill=amber, width=stroke_w, joint="round")
    for p in [right_bracket[0], right_bracket[-1]]:
        r = stroke_w // 2
        draw.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=amber)

    # Downscale with Lanczos filtering for high quality antialiasing
    final_img = img.resize((size, size), Image.Resampling.LANCZOS)
    return final_img

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    app_dir = os.path.join(project_root, "frontend", "app")
    public_dir = os.path.join(project_root, "frontend", "public")
    os.makedirs(app_dir, exist_ok=True)
    os.makedirs(public_dir, exist_ok=True)

    # 1. Generate Apple Touch Icon (180x180)
    print("Generating apple-icon.png (180x180)...")
    apple_img = render_code_pulse(180, radius_ratio=0.22, stroke_ratio=0.07)
    apple_app_path = os.path.join(app_dir, "apple-icon.png")
    apple_public_path = os.path.join(public_dir, "apple-icon.png")
    apple_img.save(apple_app_path, format="PNG")
    apple_img.save(apple_public_path, format="PNG")
    print(f"Saved: {apple_app_path}")
    print(f"Saved: {apple_public_path}")

    # 2. Generate Favicon frames (16x16, 32x32, 48x48)
    print("Generating multi-resolution favicon.ico...")
    img48 = render_code_pulse(48, radius_ratio=0.22, stroke_ratio=0.075)
    img32 = render_code_pulse(32, radius_ratio=0.22, stroke_ratio=0.08)
    img16 = render_code_pulse(16, radius_ratio=0.22, stroke_ratio=0.09)

    ico_app_path = os.path.join(app_dir, "favicon.ico")
    ico_public_path = os.path.join(public_dir, "favicon.ico")

    # Save as true ICO container holding all 3 resolution frames
    img48.save(
        ico_app_path,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=[img32, img16],
    )
    img48.save(
        ico_public_path,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=[img32, img16],
    )
    print(f"Saved: {ico_app_path}")
    print(f"Saved: {ico_public_path}")

    print("All favicon assets generated successfully!")

if __name__ == "__main__":
    main()

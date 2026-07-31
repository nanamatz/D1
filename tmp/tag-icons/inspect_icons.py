from pathlib import Path

from PIL import Image, ImageDraw


source = Path("src/ui/assets/skip-rewards")
names = sorted(path.name for path in source.glob("*.png"))
thumb = 160
label = 22
columns = 6
rows = (len(names) + columns - 1) // columns
sheet = Image.new("RGBA", (columns * thumb, rows * (thumb + label)), (25, 28, 42, 255))
draw = ImageDraw.Draw(sheet)

for index, name in enumerate(names):
    with Image.open(source / name) as image:
        rgba = image.convert("RGBA")
        assert rgba.size == (160, 160), (name, rgba.size)
        assert rgba.getextrema()[3][0] == 0, (name, "missing transparency")
        assert rgba.getpixel((0, 0))[3] == 0, (name, "opaque corner")
        x = index % columns * thumb
        y = index // columns * (thumb + label)
        sheet.alpha_composite(rgba, (x, y))
        draw.text((x + 4, y + thumb + 3), name.removesuffix("-tag.png"), fill=(255, 255, 255, 255))

sheet.save("tmp/tag-icons/contact-sheet.png", optimize=True)
print(f"validated {len(names)} icons; {sheet.size[0]}x{sheet.size[1]} contact sheet")

from pathlib import Path

from PIL import Image


source = Path("tmp/tag-icons/alpha")
target = Path("src/ui/assets/skip-rewards")
target.mkdir(parents=True, exist_ok=True)

for path in source.glob("*.png"):
    with Image.open(path) as image:
        resized = image.convert("RGBA").resize((160, 160), Image.Resampling.NEAREST)
        resized.save(target / path.name, optimize=True)


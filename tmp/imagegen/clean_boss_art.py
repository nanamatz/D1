from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
ASSETS = {
    "family-photo-alpha.png": "T_FamilyPhoto.png",
    "no-smoking-sign-alpha.png": "T_NoSmokingSign.png",
    "wifi-zone-alpha.png": "T_WifiZone.png",
    "transparent-paper-alpha.png": "T_TransparentPaper.png",
}


def keep_largest_component(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    alpha = image.getchannel("A")
    width, height = image.size
    remaining = {(x, y) for y in range(height) for x in range(width) if alpha.getpixel((x, y))}
    largest: set[tuple[int, int]] = set()
    while remaining:
        component = {remaining.pop()}
        queue = deque(component)
        while queue:
            x, y = queue.popleft()
            for nx in range(max(0, x - 1), min(width, x + 2)):
                for ny in range(max(0, y - 1), min(height, y + 2)):
                    if (nx, ny) in remaining:
                        remaining.remove((nx, ny))
                        component.add((nx, ny))
                        queue.append((nx, ny))
        if len(component) > len(largest):
            largest = component

    pixels = image.load()
    for y in range(height):
        for x in range(width):
            if (x, y) not in largest:
                pixels[x, y] = (0, 0, 0, 0)
    return image


for source_name, target_name in ASSETS.items():
    cleaned = keep_largest_component(Image.open(Path(__file__).parent / source_name))
    cleaned = cleaned.resize((160, 160), Image.Resampling.NEAREST)
    cleaned.save(ROOT / "src" / "ui" / "assets" / "bosses" / target_name)
    cleaned.save(ROOT / "docs" / "Arts" / "BlindEmblem" / target_name)

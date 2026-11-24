"""Copy the standalone web app into the Android offline assets directory."""
from pathlib import Path
import re
import shutil

root = Path(__file__).resolve().parent
assets = root / "android" / "assets"
if assets.exists():
    shutil.rmtree(assets)

(assets / "assets").mkdir(parents=True, exist_ok=True)
for name in ("index.html", "styles.css", "barcode.js", "parser.js", "app.js", "manifest.webmanifest", "sw.js"):
    shutil.copy2(root / name, assets / name)
for name in ("pickup-lockers.png", "app-icon.svg", "app-icon.png", "app-icon-512.png"):
    shutil.copy2(root / "assets" / name, assets / "assets" / name)

html = (assets / "index.html").read_text(encoding="utf-8")
for ref in re.findall(r'(?:src|href)="(assets/[^"]+|[a-zA-Z0-9._-]+\.(?:css|js|webmanifest))"', html):
    target = assets / ref
    if not target.is_file():
        raise FileNotFoundError(f"Missing packaged Android asset referenced by index.html: {ref}")

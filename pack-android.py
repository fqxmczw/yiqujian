"""Add the compiled dex and the offline web assets to the Android package."""
from pathlib import Path
import sys
import zipfile

project = Path(sys.argv[1])
package = Path(sys.argv[2])
with zipfile.ZipFile(package, "a") as archive:
    archive.write(project / "build/classes.dex", "classes.dex")
    for asset in (project / "assets").rglob("*"):
        if asset.is_file():
            archive.write(asset, "assets/" + asset.relative_to(project / "assets").as_posix())

# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

# This file is now a standalone Python script that
# updates the vendored get-pip.py and cgmanifest.json
# to the latest pip release.

import argparse
import json
import pathlib
import urllib.request
from typing import Optional

EXTENSION_ROOT = pathlib.Path(__file__).parent.parent
GET_PIP_DEST = EXTENSION_ROOT / "python_files" / "get-pip.py"
CGMANIFEST_PATH = EXTENSION_ROOT / "cgmanifest.json"
PIP_METADATA_URL = "https://pypi.org/pypi/pip/json"
GET_PIP_URL = "https://raw.githubusercontent.com/pypa/get-pip/{version}/public/get-pip.py"


def _get_latest_version() -> str:
    with urllib.request.urlopen(PIP_METADATA_URL) as response:
        metadata = json.load(response)

    version = metadata.get("info", {}).get("version")
    if not isinstance(version, str) or not version:
        raise ValueError(f"PyPI metadata from {PIP_METADATA_URL} did not contain a version")
    return version


def _download_get_pip(version: str) -> bytes:
    url = GET_PIP_URL.format(version=version)
    print(f"Downloading {url}")
    with urllib.request.urlopen(url) as response:
        get_pip = response.read()

    expected_version = f"pip (version {version})".encode()
    if expected_version not in get_pip[:1024]:
        raise ValueError(f"Downloaded get-pip.py did not contain pip {version}")
    return get_pip


def _update_cgmanifest(version: str) -> str:
    manifest = json.loads(CGMANIFEST_PATH.read_text(encoding="utf-8"))
    for registration in manifest["Registrations"]:
        component = registration.get("Component", {}).get("Other", {})
        if component.get("Name") == "get-pip":
            component["Version"] = version
            return f"{json.dumps(manifest, indent=4)}\n"

    raise ValueError(f"get-pip registration was not found in {CGMANIFEST_PATH}")


def refresh_get_pip(version: Optional[str] = None) -> None:
    version = version or _get_latest_version()
    get_pip = _download_get_pip(version)
    cgmanifest = _update_cgmanifest(version)

    GET_PIP_DEST.write_bytes(get_pip)
    CGMANIFEST_PATH.write_text(cgmanifest, encoding="utf-8")
    print(f"Updated {GET_PIP_DEST} and {CGMANIFEST_PATH} to get-pip {version}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Refresh the vendored get-pip.py")
    parser.add_argument(
        "--version",
        help="pip release to vendor; defaults to the latest release on PyPI",
    )
    args = parser.parse_args()
    refresh_get_pip(args.version)


if __name__ == "__main__":
    main()

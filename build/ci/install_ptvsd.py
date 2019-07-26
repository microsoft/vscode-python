# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import argparse
import glob
import os
import shutil
import subprocess
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "..", "pythonFiles"))
from folder_tag import get_folder_tag


def install_ptvsd_wheels(version, platforms):
    """Downlad and install PTVSD wheels for a specific Python version and a list of platforms."""

    # Mapping between folder platform names and wheel platform tags.
    root_dirname = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    for folder in platforms:
        dirpath = os.path.join(
            root_dirname, "pythonFiles", "lib", f"python-{folder}-{version}"
        )
        # Remove the platform folder and its content if it exists, then create it.
        if os.path.isdir(dirpath):
            shutil.rmtree(dirpath)
        os.makedirs(dirpath)

        # Download and install the appropriate PTVSD wheel.
        with open(
            os.path.join(root_dirname, "requirements.txt"), "r", encoding="utf-8"
        ) as requirements:
            ptvsd_prefix = "ptvsd=="
            for line in requirements:
                if line.startswith(ptvsd_prefix):
                    ptvsd_version = line[len(ptvsd_prefix) :].strip()
                    break
        subprocess.call(
            [
                sys.executable,
                "-m",
                "pip",
                "download",
                f"ptvsd=={ptvsd_version}",
                "-d",
                dirpath,
                "--platform",
                platforms[folder],
                "--no-deps",
            ]
        )

        try:
            wheel = glob.glob(os.path.join(dirpath, "*.whl"), recursive=False)[0]
        except IndexError:
            raise IndexError(f"{dirpath!r} contains no '.whl' files")
        subprocess.call(
            [sys.executable, "-m", "pip", "install", f"--target={dirpath}", wheel]
        )


def get_platforms(local):
    """Get the platforms of the PTVSD wheels to download and install."""
    # Mapping between folder platform names and wheel platform tags.
    platforms = {
        "win-32": "win32",
        "win-64": "win_amd64",
        "linux-32": "manylinux1_i686",
        "linux-64": "manylinux1_x86_64",
        "mac-64": "macosx_10_13_x86_64",
    }

    if local is False:
        return platforms
    else:
        folder_name = get_folder_tag()
        return {folder_name: platforms[folder_name]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Download and install all PTVSD wheels for a given Python version."
    )
    parser.add_argument(
        "--local",
        dest="local",
        help="only install the wheel that corresponds to the local OS and architecture",
        action="store_true",
    )
    parser.add_argument(
        "--python-version",
        dest="version",
        help='the Python interpreter version to use for wheel and "Requires-Python" compatibility checks (default: 3.7)',
        default="3.7",
    )
    args = parser.parse_args()

    platforms = get_platforms(args.local)
    install_ptvsd_wheels(args.version, platforms)

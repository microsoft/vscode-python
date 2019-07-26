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

    def delete_folder(path):
        """Delete a folder at a given path."""
        if os.path.exists(path) and os.path.isdir(path):
            shutil.rmtree(path)

    def download_wheel(wheel_platform, dest):
        """Download a PTVSD wheel and save it in its platform-specific folder."""
        subprocess.call(
            [
                sys.executable,
                "-m",
                "pip",
                "download",
                "ptvsd==4.2.10",
                "-d",
                dest,
                "--platform",
                wheel_platform,
                "--no-deps",
            ]
        )

    def get_wheel_name(folder):
        """Retrieve the file name of the PTVSD wheel that was just downloaded."""
        wheel = [w for w in glob.glob(os.path.join(folder, "*.whl"), recursive=False)]
        if len(wheel) == 1:
            return wheel[0]
        else:
            raise Exception(f"The content of {folder} is incorrect")

    def install_wheel(wheel, dest):
        """Install a PTVSD wheel in its platform-specific folder."""
        subprocess.call(
            [sys.executable, "-m", "pip", "install", f"--target={dest}", wheel]
        )

    for folder in platforms:
        dirpath = os.path.join(
            os.path.dirname(__file__),
            "..",
            "..",
            "pythonFiles",
            "lib",
            f"python-{folder}-{version}",
        )
        # Remove the platform folder and its content if it exists, then create it.
        delete_folder(dirpath)
        os.makedirs(dirpath)

        # Download and install the appropriate PTVSD wheel.
        download_wheel(platforms[folder], dirpath)
        wheel = get_wheel_name(dirpath)
        install_wheel(wheel, dirpath)


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

    if local == False:
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
        default="37",
    )
    args = parser.parse_args()

    platforms = get_platforms(args.local)
    if len(platforms) == 0:
        raise Exception(f"No matching platforms")

    install_ptvsd_wheels(args.version, platforms)

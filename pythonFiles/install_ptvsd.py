# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import argparse
import glob
import os
import shutil
import subprocess
import sys

ROOT_FOLDER_PATH = os.path.join(".", "pythonFiles", "lib")
PLATFORMS = {
    "win-32": "win32",
    "win-64": "win_amd64",
    "linux-32": "manylinux1_i686",
    "linux-64": "manylinux1_x86_64",
    "mac-64": "macosx_10_13_x86_64",
}


def install_ptvsd_wheels(version):
    def delete_folder(path):
        if os.path.exists(path) and os.path.isdir(path):
            shutil.rmtree(path)

    def download_wheel(platform, dest):
        subprocess.call(
            [
                sys.executable,
                "-m",
                "pip",
                "download",
                "ptvsd",
                "-d",
                dest,
                "--platform",
                platform,
                "--no-deps",
            ]
        )

    def get_wheel_name(folder):
        wheel = [w for w in glob.glob(os.path.join(folder, "*.whl"), recursive=False)]
        if len(wheel) == 1:
            return wheel[0]
        else:
            raise Exception(f"The content of {folder} is incorrect")

    def install_wheel(wheel, dest):
        subprocess.call(
            [sys.executable, "-m", "pip", "install", f"--target={dest}", wheel]
        )

    # mapping between folder platform names and wheel platform names
    for folder in PLATFORMS:
        # remove the platform folder and its content if it exists
        dirpath = os.path.join(ROOT_FOLDER_PATH, f"python-{folder}-{version}")
        delete_folder(dirpath)

        # download and install the appropriate PTVSD wheel
        try:
            step = "mkdir"
            os.mkdir(dirpath)

            step = "download"
            download_wheel(PLATFORMS[folder], dirpath)

            step = "install"
            wheel = get_wheel_name(dirpath)
            install_wheel(wheel, dirpath)
        except Exception as ex:
            return {"status": -1, "platform": folder, "step": step, "exception": ex}
    return {"status": 0}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Download and install all PTVSD wheels for a given Python version."
    )
    parser.add_argument(
        "--python-version",
        dest="version",
        help='the Python interpreter version to use for wheel and "Requires-Python" compatibility checks (default: 3.7)',
        default="37",
    )
    args = parser.parse_args()
    result = install_ptvsd_wheels(args.version)
    if result["status"] != 0:
        raise Exception(
            f"There is a problem at the {result['step']} step for the {result['platform']} wheel: {result['exception']}"
        )


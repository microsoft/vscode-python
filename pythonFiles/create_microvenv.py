# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import argparse
import os
import pathlib
import subprocess
import sys
import urllib.request as url_lib
from typing import Optional, Sequence

VENV_NAME = ".venv"
LIB_ROOT = pathlib.Path(__file__).parent / "lib" / "python"
CWD = pathlib.Path.cwd()


class MicroVenvError(Exception):
    pass


def run_process(args: Sequence[str], error_message: str) -> None:
    try:
        print("Running: " + " ".join(args))
        subprocess.run(args, cwd=os.getcwd(), check=True)
    except subprocess.CalledProcessError:
        raise MicroVenvError(error_message)


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--install-pip",
        action="store_true",
        default=False,
        help="Install pip into the virtual environment.",
    )

    parser.add_argument(
        "--name",
        default=VENV_NAME,
        type=str,
        help="Name of the virtual environment.",
        metavar="NAME",
        action="store",
    )
    return parser.parse_args(argv)


def create_microvenv(name: str):
    run_process(
        [sys.executable, os.fspath(LIB_ROOT / "microvenv.py"), name],
        "CREATE_MICROVENV.MICROVENV_FAILED_CREATION",
    )


def download_pip_pyz(name: str):
    url = "https://bootstrap.pypa.io/pip/pip.pyz"
    print("CREATE_MICROVENV.DOWNLOADING_PIP")

    try:
        with url_lib.urlopen(url) as response:
            pip_pyz_path = os.fspath(CWD / name / "pip.pyz")
            with open(pip_pyz_path, "wb") as out_file:
                data = response.read()
                out_file.write(data)
                out_file.flush()
    except Exception:
        raise MicroVenvError("CREATE_MICROVENV.DOWNLOAD_PIP_FAILED")


def install_pip(name: str):
    pip_pyz_path = os.fspath(CWD / name / "pip.pyz")
    executable = os.fspath(CWD / name / "bin" / "python")
    print("CREATE_MICROVENV.INSTALLING_PIP")
    run_process(
        [executable, pip_pyz_path, "install", "pip"],
        "CREATE_MICROVENV.INSTALL_PIP_FAILED",
    )


def main(argv: Optional[Sequence[str]] = None) -> None:
    if argv is None:
        argv = []
    args = parse_args(argv)

    print("CREATE_MICROVENV.CREATING_MICROVENV")
    create_microvenv(args.name)
    print("CREATE_MICROVENV.CREATED_MICROVENV")

    if args.install_pip:
        download_pip_pyz(args.name)
        install_pip(args.name)


if __name__ == "__main__":
    main(sys.argv[1:])

# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import argparse
import importlib.util as import_util
import os
import pathlib
import subprocess
import sys
from typing import Sequence

VENV_NAME = ".venv"
CWD = pathlib.PurePath(os.getcwd())


class VenvError(Exception):
    pass


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--install",
        action="store_true",
        default=False,
        help="Install packages into the virtual environment.",
    )
    parser.add_argument(
        "--git-ignore",
        action="store_true",
        default=False,
        help="Add .gitignore to the newly created virtual environment.",
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


def is_installed(module: str) -> bool:
    return import_util.find_spec(module) is not None


def file_exists(path: pathlib.PurePath) -> bool:
    return os.path.exists(path)


def venv_exists(name: str) -> bool:
    return os.path.exists(CWD / name)


def run_process(args: Sequence[str], error_message: str) -> None:
    try:
        print("Running: " + " ".join(args))
        subprocess.run(args, cwd=os.getcwd(), check=True)
    except subprocess.CalledProcessError:
        raise VenvError(error_message)


def install_packages(name: str) -> None:
    if not is_installed("pip"):
        raise VenvError("CREATE_VENV.PIP_NOT_FOUND")

    requirements = os.fspath(CWD / "requirements.txt")
    pyproject = os.fspath(CWD / "pyproject.toml")
    if sys.platform == "win32":
        venv_path = os.fspath(CWD / name / "Scripts" / "python.exe")
    else:
        venv_path = os.fspath(CWD / name / "bin" / "python")

    run_process(
        [venv_path, "-m", "pip", "install", "--upgrade", "pip"],
        "CREATE_VENV.PIP_UPGRADE_FAILED",
    )

    if file_exists(requirements):
        run_process(
            [venv_path, "-m", "pip", "install", "-r", requirements],
            "CREATE_VENV.PIP_FAILED_INSTALL_REQUIREMENTS",
        )
    elif file_exists(pyproject):
        run_process(
            [venv_path, "-m", "pip", "install", "-e", ".[extras]"],
            "CREATE_VENV.PIP_FAILED_INSTALL_PYPROJECT",
        )


def add_gitignore(name: str) -> None:
    git_ignore = CWD / name / ".gitignore"
    if not file_exists(git_ignore):
        print("Creating: " + os.fspath(git_ignore))
        with open(git_ignore, "w") as f:
            f.write("*")


def main(argv: Sequence[str] = None) -> None:
    if argv is None:
        argv = []
    args = parse_args(argv)

    if is_installed("venv"):
        if not venv_exists(args.name):
            run_process(
                [sys.executable, "-m", "venv", args.name],
                "CREATE_VENV.VENV_FAILED_CREATION",
            )
            if args.git_ignore:
                add_gitignore(args.name)

        if args.install:
            install_packages(args.name)
    else:
        raise VenvError("CREATE_VENV.VENV_NOT_FOUND")


if __name__ == "__main__":
    main(sys.argv[1:])

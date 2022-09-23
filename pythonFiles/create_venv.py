# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import argparse
import importlib.util as import_util
import os
import pathlib
import subprocess
import sys
from typing import Optional, Sequence, Union

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


def file_exists(path: Union[str, pathlib.PurePath]) -> bool:
    return os.path.exists(path)


def venv_exists(name: str) -> bool:
    return os.path.exists(CWD / name)


def run_process(args: Sequence[str], error_message: str) -> None:
    try:
        print("Running: " + " ".join(args))
        subprocess.run(args, cwd=os.getcwd(), check=True)
    except subprocess.CalledProcessError:
        raise VenvError(error_message)


def get_venv_path(name: str) -> str:
    # See `venv` doc here for more details on binary location:
    # https://docs.python.org/3/library/venv.html#creating-virtual-environments
    if sys.platform == "win32":
        return os.fspath(CWD / name / "Scripts" / "python.exe")
    else:
        return os.fspath(CWD / name / "bin" / "python")


def install_packages(venv_path: str) -> None:
    if not is_installed("pip"):
        raise VenvError("CREATE_VENV.PIP_NOT_FOUND")

    requirements = os.fspath(CWD / "requirements.txt")
    pyproject = os.fspath(CWD / "pyproject.toml")

    run_process(
        [venv_path, "-m", "pip", "install", "--upgrade", "pip"],
        "CREATE_VENV.PIP_UPGRADE_FAILED",
    )

    if file_exists(requirements):
        print(f"VENV_INSTALLING_REQUIREMENTS: {requirements}")
        run_process(
            [venv_path, "-m", "pip", "install", "-r", requirements],
            "CREATE_VENV.PIP_FAILED_INSTALL_REQUIREMENTS",
        )
    elif file_exists(pyproject):
        print(f"VENV_INSTALLING_PYPROJECT: {pyproject}")
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


def main(argv: Optional[Sequence[str]] = None) -> None:
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
        venv_path = get_venv_path(args.name)
        print(f"CREATED_VENV:{venv_path}")
        if args.install:
            install_packages(venv_path)
    else:
        raise VenvError("CREATE_VENV.VENV_NOT_FOUND")


if __name__ == "__main__":
    main(sys.argv[1:])

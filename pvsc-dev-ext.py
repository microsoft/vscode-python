#!/usr/bin/env python3
# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

"""Setup and maintain a development build of PVSC.

You must have git, node, and npm installed.

"""
# Downloading the development build of the ``.vsix` was considered, but it actually
# takes longer to install due to the number of files to unzip compared to the
# incremental updates working from a git clone.

import argparse
import enum
import os
import pathlib
import shutil
import subprocess
import sys


REPO_URL = "https://github.com/Microsoft/vscode-python.git"


@enum.unique
class VSCode(enum.Enum):
    """Enum representing the install types of VS Code."""
    stable = ".vscode"
    insiders = ".vscode-insiders"


def run_command(command, cwd=None):
    """Run the specified command in a subprocess shell."""
    cmd = subprocess.run(command, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True)
    cmd.check_returncode()


def checkout_directory(install_type, dir_name="vscode-python"):
    return pathlib.Path.home() / install_type.value / "extensions" / dir_name


def clone_repo(clone_to):
    """Clone the repository to the appropriate location."""
    # https://code.visualstudio.com/docs/editor/extension-gallery#_where-are-extensions-installed
    cmd = ["git", "clone", "-q", "--single-branch", "--branch", "master", REPO_URL, os.fspath(clone_to)]
    run_command(cmd)


def update_checkout(checkout):
    """Update the code the latest version."""
    run_command(["git", "pull", "-q", "origin", "master"], cwd=checkout)


def install_npm_dependencies(checkout):
    """Install packages from npm."""
    run_command(["npm", "--silent", "--no-progress", "install", "--no-save"], cwd=checkout)


def build_typescript(checkout):
    """Compile all TypeScript code in the extension."""
    tsc_path = pathlib.Path("node_modules") / "typescript" / "bin" / "tsc"
    run_command(["node", os.fspath(tsc_path), "-p", os.fspath(checkout)], cwd=checkout)


def install_ptvsd(checkout):
    """Install ptvsd from PyPI."""
    ptvsd_path = checkout / "pythonFiles" / "experimental" / "ptvsd"
    cmd = [sys.executable, "-m", "pip", "-q", "--disable-pip-version-check", "install", "--target", os.fspath(ptvsd_path), "--upgrade", "ptvsd"]
    run_command(cmd)


def cleanup(checkout):
    """Delete files downloaded by the extension."""
    for path in checkout.glob("languageServer*"):
        if path.is_dir():
            shutil.rmtree(path)


def build(checkout):
    """Install dependencies and build the extension."""
    print("Installing npm dependencies ...")
    install_npm_dependencies(checkout)
    print("Building TypeScript files ...")
    build_typescript(checkout)
    print("Installing ptvsd ...")
    install_ptvsd(checkout)


def setup(install_type):
    """Set up a clone of PVSC."""
    checkout = checkout_directory(install_type)
    print(f"Cloning {REPO_URL} ...")
    clone_repo(checkout)
    build(checkout)


def update():
    """Update development installs of PVSC."""
    for install_type in VSCode:
        checkout = checkout_directory(install_type)
        if not checkout.exists():
            continue
        print(f"UPDATING {checkout}")
        print("Deleting files downloaded by the extension ...")
        cleanup(checkout)
        print("Updating clone ...")
        update_checkout(checkout)
        build(checkout)


def parse_args(args=sys.argv[1:]):
    """Parse CLI arguments."""
    parser = argparse.ArgumentParser(description="Setup and maintain a development build of PVSC (requires git, node, and npm)")
    subparsers = parser.add_subparsers(dest="cmd")
    setup_parser = subparsers.add_parser("setup")
    setup_parser.add_argument("install_type", choices=[install_type.name for install_type in VSCode])
    update_parser = subparsers.add_parser("update")
    return parser.parse_args(args)


if __name__ == "__main__":
    args = parse_args()
    if args.cmd == "setup":
        setup(VSCode[args.install_type])
    elif args.cmd == "update":
        update()
    else:
        raise RuntimeError(f"unrecognized sub-command: {args.cmd!r}")

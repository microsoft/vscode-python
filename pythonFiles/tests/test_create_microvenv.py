# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import importlib
import os
import sys

import create_microvenv
import pytest


def test_create_microvenv():
    importlib.reload(create_microvenv)
    run_process_called = False

    def run_process(args, error_message):
        nonlocal run_process_called
        run_process_called = True
        assert args == [
            sys.executable,
            os.fspath(create_microvenv.LIB_ROOT / "microvenv.py"),
            create_microvenv.VENV_NAME,
        ]
        assert error_message == "CREATE_MICROVENV.MICROVENV_FAILED_CREATION"

    create_microvenv.run_process = run_process

    create_microvenv.main()
    assert run_process_called == True


def test_create_microvenv_with_pip():
    importlib.reload(create_microvenv)

    download_pip_pyz_called = False

    def download_pip_pyz(name):
        nonlocal download_pip_pyz_called
        download_pip_pyz_called = True
        assert name == create_microvenv.VENV_NAME

    create_microvenv.download_pip_pyz = download_pip_pyz

    run_process_called = False

    def run_process(args, error_message):
        if "install" in args and "pip" in args:
            nonlocal run_process_called
            run_process_called = True
            pip_pyz_path = os.fspath(
                create_microvenv.CWD / create_microvenv.VENV_NAME / "pip.pyz"
            )
            executable = os.fspath(
                create_microvenv.CWD / create_microvenv.VENV_NAME / "bin" / "python"
            )
            assert args == [executable, pip_pyz_path, "install", "pip"]
            assert error_message == "CREATE_MICROVENV.INSTALL_PIP_FAILED"

    create_microvenv.run_process = run_process
    create_microvenv.main(["--install-pip"])

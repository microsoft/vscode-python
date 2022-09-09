# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import importlib
import sys

import create_venv
import pytest


def test_venv_not_installed():
    importlib.reload(create_venv)
    create_venv.is_installed = lambda module: module != "venv"
    with pytest.raises(create_venv.VenvError) as e:
        create_venv.main()
    assert str(e.value) == "CREATE_VENV.VENV_NOT_FOUND"


def test_pip_not_installed():
    importlib.reload(create_venv)
    create_venv.venv_exists = lambda _n: True
    create_venv.is_installed = lambda module: module != "pip"
    create_venv.run_process = lambda _args, _error_message: None
    with pytest.raises(create_venv.VenvError) as e:
        create_venv.main(["--install"])
    assert str(e.value) == "CREATE_VENV.PIP_NOT_FOUND"


@pytest.mark.parametrize("env_exists", [True, False])
@pytest.mark.parametrize("git_ignore", [True, False])
@pytest.mark.parametrize("install", [True, False])
def test_create_env(env_exists, git_ignore, install):
    importlib.reload(create_venv)
    create_venv.is_installed = lambda _x: True
    create_venv.venv_exists = lambda _n: env_exists

    install_packages_called = False

    def install_packages(_name):
        nonlocal install_packages_called
        install_packages_called = True

    create_venv.install_packages = install_packages

    run_process_called = False

    def run_process(args, error_message):
        nonlocal run_process_called
        run_process_called = True
        if not env_exists:
            assert args == [sys.executable, "-m", "venv", create_venv.VENV_NAME]
            assert error_message == "CREATE_VENV.VENV_FAILED_CREATION"

    create_venv.run_process = run_process

    add_gitignore_called = False

    def add_gitignore(_name):
        nonlocal add_gitignore_called
        add_gitignore_called = True

    create_venv.add_gitignore = add_gitignore

    args = []
    if git_ignore:
        args.append("--git-ignore")
    if install:
        args.append("--install")
    create_venv.main(args)
    assert install_packages_called == install

    # run_process is called when the venv does not exist
    assert run_process_called != env_exists

    # add_gitignore is called when new venv is created and git_ignore is True
    assert add_gitignore_called == (not env_exists and git_ignore)


@pytest.mark.parametrize("install_type", ["requirements", "pyproject"])
def test_install_packages(install_type):
    importlib.reload(create_venv)
    create_venv.is_installed = lambda _x: True
    create_venv.file_exists = lambda x: install_type in x

    pip_upgraded = False
    installing = None

    def run_process(args, error_message):
        nonlocal pip_upgraded, installing
        if args[1:] == ["-m", "pip", "install", "--upgrade", "pip"]:
            pip_upgraded = True
            assert error_message == "CREATE_VENV.PIP_UPGRADE_FAILED"
        elif args[1:-1] == ["-m", "pip", "install", "-r"]:
            installing = "requirements"
            assert error_message == "CREATE_VENV.PIP_FAILED_INSTALL_REQUIREMENTS"
        elif args[1:] == ["-m", "pip", "install", "-e", ".[extras]"]:
            installing = "pyproject"
            assert error_message == "CREATE_VENV.PIP_FAILED_INSTALL_PYPROJECT"

    create_venv.run_process = run_process

    create_venv.main(["--install"])
    assert pip_upgraded
    assert installing == install_type

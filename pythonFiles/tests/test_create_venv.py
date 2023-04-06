# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import importlib
import os
import sys

import create_venv
import pytest


@pytest.mark.skipif(
    sys.platform == "win32", reason="Windows does not have micro venv fallback."
)
def test_venv_not_installed_unix():
    importlib.reload(create_venv)
    create_venv.is_installed = lambda module: module != "venv"
    run_process_called = False

    def run_process(args, error_message):
        nonlocal run_process_called
        if "--install-pip" in args:
            run_process_called = True
            assert args == [
                sys.executable,
                os.fspath(create_venv.MICROVENV_SCRIPT_PATH),
                "--install-pip",
                "--name",
                ".test_venv",
            ]
            assert error_message == "CREATE_VENV.MICROVENV_FAILED_CREATION"

    create_venv.run_process = run_process

    create_venv.main(["--name", ".test_venv"])

    # run_process is called when the venv does not exist
    assert run_process_called == True


@pytest.mark.skipif(
    sys.platform != "win32", reason="Windows does not have microvenv fallback."
)
def test_venv_not_installed_windows():
    importlib.reload(create_venv)
    create_venv.is_installed = lambda module: module != "venv"
    with pytest.raises(create_venv.VenvError) as e:
        create_venv.main()
    assert str(e.value) == "CREATE_VENV.VENV_NOT_FOUND"


@pytest.mark.parametrize("install", ["requirements", "toml"])
def test_pip_not_installed(install):
    importlib.reload(create_venv)
    create_venv.venv_exists = lambda _n: True
    create_venv.is_installed = lambda module: module != "pip"
    create_venv.run_process = lambda _args, _error_message: None
    with pytest.raises(create_venv.VenvError) as e:
        if install == "requirements":
            create_venv.main(["--requirements", "requirements-for-test.txt"])
        elif install == "toml":
            create_venv.main(["--toml", "pyproject.toml", "--extras", "test"])
    assert str(e.value) == "CREATE_VENV.PIP_NOT_FOUND"


@pytest.mark.parametrize("env_exists", ["hasEnv", "noEnv"])
@pytest.mark.parametrize("git_ignore", ["useGitIgnore", "skipGitIgnore"])
@pytest.mark.parametrize("install", ["requirements", "toml", "skipInstall"])
def test_create_env(env_exists, git_ignore, install):
    importlib.reload(create_venv)
    create_venv.is_installed = lambda _x: True
    create_venv.venv_exists = lambda _n: env_exists == "hasEnv"
    create_venv.upgrade_pip = lambda _x: None

    install_packages_called = False

    def install_packages(_env, _name):
        nonlocal install_packages_called
        install_packages_called = True

    create_venv.install_requirements = install_packages
    create_venv.install_toml = install_packages

    run_process_called = False

    def run_process(args, error_message):
        nonlocal run_process_called
        run_process_called = True
        if env_exists == "noEnv":
            assert args == [sys.executable, "-m", "venv", create_venv.VENV_NAME]
            assert error_message == "CREATE_VENV.VENV_FAILED_CREATION"

    create_venv.run_process = run_process

    add_gitignore_called = False

    def add_gitignore(_name):
        nonlocal add_gitignore_called
        add_gitignore_called = True

    create_venv.add_gitignore = add_gitignore

    args = []
    if git_ignore == "useGitIgnore":
        args += ["--git-ignore"]
    if install == "requirements":
        args += ["--requirements", "requirements-for-test.txt"]
    elif install == "toml":
        args += ["--toml", "pyproject.toml", "--extras", "test"]

    create_venv.main(args)
    assert install_packages_called == (install != "skipInstall")

    # run_process is called when the venv does not exist
    assert run_process_called == (env_exists == "noEnv")

    # add_gitignore is called when new venv is created and git_ignore is True
    assert add_gitignore_called == (
        (env_exists == "noEnv") and (git_ignore == "useGitIgnore")
    )


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
            assert error_message == "CREATE_VENV.UPGRADE_PIP_FAILED"
        elif args[1:-1] == ["-m", "pip", "install", "-r"]:
            installing = "requirements"
            assert error_message == "CREATE_VENV.PIP_FAILED_INSTALL_REQUIREMENTS"
        elif args[1:] == ["-m", "pip", "install", "-e", ".[test]"]:
            installing = "pyproject"
            assert error_message == "CREATE_VENV.PIP_FAILED_INSTALL_PYPROJECT"

    create_venv.run_process = run_process

    if install_type == "requirements":
        create_venv.main(["--requirements", "requirements-for-test.txt"])
    elif install_type == "pyproject":
        create_venv.main(["--toml", "pyproject.toml", "--extras", "test"])

    assert pip_upgraded
    assert installing == install_type


@pytest.mark.parametrize(
    ("extras", "expected"),
    [
        ([], ["-m", "pip", "install", "-e", "."]),
        (["test"], ["-m", "pip", "install", "-e", ".[test]"]),
        (["test", "doc"], ["-m", "pip", "install", "-e", ".[test,doc]"]),
    ],
)
def test_toml_args(extras, expected):
    importlib.reload(create_venv)

    actual = []

    def run_process(args, error_message):
        nonlocal actual
        actual = args[1:]

    create_venv.run_process = run_process

    create_venv.install_toml(sys.executable, extras)

    assert actual == expected


@pytest.mark.parametrize(
    ("extras", "expected"),
    [
        ([], []),
        (
            ["requirements/test.txt"],
            [[sys.executable, "-m", "pip", "install", "-r", "requirements/test.txt"]],
        ),
        (
            ["requirements/test.txt", "requirements/doc.txt"],
            [
                [sys.executable, "-m", "pip", "install", "-r", "requirements/test.txt"],
                [sys.executable, "-m", "pip", "install", "-r", "requirements/doc.txt"],
            ],
        ),
    ],
)
def test_requirements_args(extras, expected):
    importlib.reload(create_venv)

    actual = []

    def run_process(args, error_message):
        nonlocal actual
        actual.append(args)

    create_venv.run_process = run_process

    create_venv.install_requirements(sys.executable, extras)

    assert actual == expected

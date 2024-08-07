# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os
import pathlib
import subprocess
import sys
from typing import Union
import traceback

script_dir = pathlib.Path(__file__).parent.parent
sys.path.append(os.fspath(script_dir))
sys.path.insert(0, os.fspath(script_dir / "lib" / "python"))

from pvsc_utils import (  # noqa: E402
    VSCodeUnittestError,
)


def django_discovery_runner(
    top_level_dir: Union[str, None], manage_py_path: Union[str, None]
) -> None:
    # Get path to manage.py if set as an env var, otherwise use the default

    if manage_py_path is None:
        # Search for default manage.py path at the root of the workspace
        if not top_level_dir:
            print("Error running Django, no start_dir provided or value for MANAGE_PY_PATH")

        cwd = pathlib.Path(top_level_dir)
        manage_py_path = os.fspath(cwd / "manage.py")

    try:
        # Get path to the custom_test_runner.py parent folder, add to sys.path.
        custom_test_runner_dir = pathlib.Path(__file__).parent
        sys.path.insert(0, custom_test_runner_dir)

        # Build command to run 'python manage.py test'.
        command = [
            sys.executable,
            manage_py_path,
            "test",
            "--testrunner=django_test_runner.CustomDiscoveryTestRunner",
            "--verbosity=3",  # remove when no longer in development mode
        ] 
        print("Running Django run tests with command: ", command)
        env = os.environ.copy()
        if "PYTHONPATH" in env:
            env["PYTHONPATH"] = os.fspath(custom_test_runner_dir) + os.pathsep + env["PYTHONPATH"]
        else:
            env["PYTHONPATH"] = os.fspath(custom_test_runner_dir)
        try:
            abc = subprocess.run(
                command,
                capture_output=True,
                text=True,
                env=env,
            )
            print(abc.stderr)
            print(abc.stdout)
            print("Django tests ran successfully.")
        except subprocess.CalledProcessError as e:
            print(f"Error running 'manage.py test': {e}")
            print(traceback.format_exc())
            raise VSCodeUnittestError(f"Error running 'manage.py test': {e}")  # noqa: B904
    except Exception as e:
        print(f"Error configuring Django test runner: {e}")
        raise VSCodeUnittestError(f"Error configuring Django test runner: {e}")  # noqa: B904


def django_execution_runner(
    top_level_dir: Union[str, None], manage_py_path: Union[str, None], test_ids: list[str]
) -> None:
    # Get path to manage.py if set as an env var, otherwise use the default

    if manage_py_path is None:
        # Search for default manage.py path at the root of the workspace
        if not top_level_dir:
            print("Error running Django, no start_dir provided or value for MANAGE_PY_PATH")

        cwd = pathlib.Path(top_level_dir)
        manage_py_path = os.fspath(cwd / "manage.py")

    try:
        # Get path to the custom_test_runner.py parent folder, add to sys.path.
        custom_test_runner_dir = pathlib.Path(__file__).parent
        sys.path.insert(0, custom_test_runner_dir)

        # Build command to run 'python manage.py test'.
        command = [
            sys.executable,
            manage_py_path,
            "test",
            "--testrunner=django_test_runner.CustomExecutionTestRunner",
            "--verbosity=3",  # remove when no longer in development mode
        ]
        command.extend(test_ids)
        print("Running Django run tests with command: ", command)
        env = os.environ.copy()
        if "PYTHONPATH" in env:
            env["PYTHONPATH"] = os.fspath(custom_test_runner_dir) + os.pathsep + env["PYTHONPATH"]
        else:
            env["PYTHONPATH"] = os.fspath(custom_test_runner_dir)
        try:
            abc = subprocess.run(
                command,
                capture_output=True,
                text=True,
                env=env,
            )
            print(abc.stderr)
            print(abc.stdout)
            print("Django tests ran successfully.")
        except subprocess.CalledProcessError as e:
            print(f"Error running 'manage.py test': {e}")
            print(traceback.format_exc())
            raise VSCodeUnittestError(f"Error running 'manage.py test': {e}")  # noqa: B904
    except Exception as e:
        print(f"Error configuring Django test runner: {e}")
        raise VSCodeUnittestError(f"Error configuring Django test runner: {e}")  # noqa: B904

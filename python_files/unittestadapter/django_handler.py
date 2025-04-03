# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import importlib.util
import os
import pathlib
import subprocess
import sys
from contextlib import contextmanager, suppress
from typing import TYPE_CHECKING, Generator, List

if TYPE_CHECKING:
    from importlib.machinery import ModuleSpec


script_dir = pathlib.Path(__file__).parent
sys.path.append(os.fspath(script_dir))
sys.path.insert(0, os.fspath(script_dir / "lib" / "python"))

from pvsc_utils import (  # noqa: E402
    VSCodeUnittestError,
)


@contextmanager
def override_argv(argv: List[str]) -> Generator:
    """Context manager to temporarily override sys.argv with the provided arguments."""
    original_argv = sys.argv
    sys.argv = argv
    try:
        yield
    finally:
        sys.argv = original_argv


def django_discovery_runner(manage_py_path: str, args: List[str]) -> None:
    # Attempt a small amount of validation on the manage.py path.
    if not pathlib.Path(manage_py_path).exists():
        raise VSCodeUnittestError("Error running Django, manage.py path does not exist.")

    try:
        # Get path to the custom_test_runner.py parent folder, add to sys.path and new environment used for subprocess.
        custom_test_runner_dir = pathlib.Path(__file__).parent
        sys.path.insert(0, os.fspath(custom_test_runner_dir))
        env = os.environ.copy()
        if "PYTHONPATH" in env:
            env["PYTHONPATH"] = os.fspath(custom_test_runner_dir) + os.pathsep + env["PYTHONPATH"]
        else:
            env["PYTHONPATH"] = os.fspath(custom_test_runner_dir)

        # Build command to run 'python manage.py test'.
        command = [
            sys.executable,
            manage_py_path,
            "test",
            "--testrunner=django_test_runner.CustomDiscoveryTestRunner",
        ]
        command.extend(args)
        print("Running Django tests with command:", command)

        subprocess_discovery = subprocess.run(
            command,
            capture_output=True,
            text=True,
            env=env,
        )
        print(subprocess_discovery.stderr, file=sys.stderr)
        print(subprocess_discovery.stdout, file=sys.stdout)
        # Zero return code indicates success, 1 indicates test failures, so both are considered successful.
        if subprocess_discovery.returncode not in (0, 1):
            error_msg = "Django test discovery process exited with non-zero error code See stderr above for more details."
            print(error_msg, file=sys.stderr)
    except Exception as e:
        raise VSCodeUnittestError(f"Error during Django discovery: {e}")  # noqa: B904


def django_execution_runner(manage_py_path: str, test_ids: List[str], args: List[str]) -> None:
    # Attempt a small amount of validation on the manage.py path.
    if not pathlib.Path(manage_py_path).exists():
        raise VSCodeUnittestError("Error running Django, manage.py path does not exist.")

    try:
        # Get path to the custom_test_runner.py parent folder, add to sys.path.
        custom_test_runner_dir: pathlib.Path = pathlib.Path(__file__).parent
        sys.path.insert(0, os.fspath(custom_test_runner_dir))
        env: dict[str, str] = os.environ.copy()
        if "PYTHONPATH" in env:
            env["PYTHONPATH"] = os.fspath(custom_test_runner_dir) + os.pathsep + env["PYTHONPATH"]
        else:
            env["PYTHONPATH"] = os.fspath(custom_test_runner_dir)

        django_project_dir: pathlib.Path = pathlib.Path(manage_py_path).parent
        sys.path.insert(0, os.fspath(django_project_dir))
        print(f"Django project directory: {django_project_dir}")

        manage_spec: ModuleSpec | None = importlib.util.spec_from_file_location(
            "manage", manage_py_path
        )
        if manage_spec is None or manage_spec.loader is None:
            raise VSCodeUnittestError("Error importing manage.py when running Django testing.")
        manage_module = importlib.util.module_from_spec(manage_spec)
        manage_spec.loader.exec_module(manage_module)

        manage_argv: List[str] = [
            manage_py_path,
            "test",
            "--testrunner=django_test_runner.CustomExecutionTestRunner",
            *args,
            *test_ids,
        ]
        print(f"Django manage.py arguments: {manage_argv}")

        with override_argv(manage_argv), suppress(SystemExit):
            manage_module.main()
    except Exception as e:
        print(f"Error during Django test execution: {e}", file=sys.stderr)

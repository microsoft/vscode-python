# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os
import pathlib
import subprocess
import sys
from contextlib import contextmanager, suppress
from typing import Generator, List

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


_START_DIRECTORY_FLAGS = ("-s", "--start-directory")
_VERBOSE_FLAGS = ("-v", "--verbose")
_QUIET_FLAGS = ("-q", "--quiet")


def _to_manage_py_args(args: List[str]) -> List[str]:
    """Adapt unittest discovery/execution args for 'manage.py test'.

    Most unittest discovery flags (-p/--pattern, -t/--top-level-directory,
    -f/--failfast, ...) are understood by Django's 'manage.py test' the same
    way, so they -- and any Django-specific options a user adds to
    unittestArgs, e.g. --keepdb, --settings -- are passed through unchanged.
    Only two flags need adapting:
    - -s/--start-directory has no Django equivalent, since Django discovers
      tests across installed apps rather than a start directory, so it (and
      its value) is dropped.
    - -v/--verbose and -q/--quiet are value-less unittest flags, but Django's
      -v/--verbosity requires an explicit value, so they're translated to an
      explicit "-v 2"/"-v 0".
    """
    manage_py_args: List[str] = []
    skip_next = False
    for arg in args:
        if skip_next:
            skip_next = False
            continue
        if arg in _START_DIRECTORY_FLAGS:
            skip_next = True
        elif arg in _VERBOSE_FLAGS:
            manage_py_args.extend(["-v", "2"])
        elif arg in _QUIET_FLAGS:
            manage_py_args.extend(["-v", "0"])
        else:
            manage_py_args.append(arg)
    return manage_py_args


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
        command.extend(_to_manage_py_args(args))
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
    manage_path: pathlib.Path = pathlib.Path(manage_py_path)
    # Attempt a small amount of validation on the manage.py path.
    if not manage_path.exists():
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

        django_project_dir: pathlib.Path = manage_path.parent
        sys.path.insert(0, os.fspath(django_project_dir))
        print(f"Django project directory: {django_project_dir}")

        manage_argv: List[str] = [
            str(manage_path),
            "test",
            "--testrunner=django_test_runner.CustomExecutionTestRunner",
            *_to_manage_py_args(args),
            *test_ids,
        ]
        print(f"Django manage.py arguments: {manage_argv}")

        try:
            argv_context = override_argv(manage_argv)
            suppress_context = suppress(SystemExit)
            manage_file = manage_path.open()
            with argv_context, suppress_context, manage_file:
                manage_code = manage_file.read()
                exec(manage_code, {"__name__": "__main__", "__file__": manage_path})
        except OSError as e:
            raise VSCodeUnittestError("Error running Django, unable to read manage.py") from e
    except Exception as e:
        print(f"Error during Django test execution: {e}", file=sys.stderr)

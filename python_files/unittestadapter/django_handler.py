# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os
import pathlib
import subprocess
import sys

script_dir = pathlib.Path(__file__).parent
sys.path.append(os.fspath(script_dir))
sys.path.insert(0, os.fspath(script_dir / "lib" / "python"))

from pvsc_utils import (  # noqa: E402
    EOTPayloadDict,
    VSCodeUnittestError,
    send_post_request,
)


def django_discovery_runner(manage_py_path: str, args: list[str]) -> None:
    # Attempt a small amount of validation on the manage.py path.
    try:
        pathlib.Path(manage_py_path)
    except Exception as e:
        raise VSCodeUnittestError(f"Error running Django, manage.py path is not a valid path: {e}")  # noqa: B904

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
            try:
                test_run_pipe = os.getenv("TEST_RUN_PIPE")
                eot_payload: EOTPayloadDict = {"command_type": "discovery", "eot": True}
                send_post_request(eot_payload, test_run_pipe)
            except Exception:
                raise VSCodeUnittestError(  # noqa: B904
                    "Connection failure, likely means failure in Django subprocess run, see specific error output above."
                )
    except Exception as e:
        raise VSCodeUnittestError(f"Error during Django discovery: {e}")  # noqa: B904


def django_execution_runner(manage_py_path: str, test_ids: list[str], args: list[str]) -> None:
    # Attempt a small amount of validation on the manage.py path.
    try:
        pathlib.Path(manage_py_path)
    except Exception as e:
        raise VSCodeUnittestError(f"Error running Django, manage.py path is not a valid path: {e}")  # noqa: B904

    try:
        # Get path to the custom_test_runner.py parent folder, add to sys.path.
        custom_test_runner_dir: pathlib.Path = pathlib.Path(__file__).parent
        sys.path.insert(0, os.fspath(custom_test_runner_dir))
        env: dict[str, str] = os.environ.copy()
        if "PYTHONPATH" in env:
            env["PYTHONPATH"] = os.fspath(custom_test_runner_dir) + os.pathsep + env["PYTHONPATH"]
        else:
            env["PYTHONPATH"] = os.fspath(custom_test_runner_dir)

        # Build command to run 'python manage.py test'.
        command: list[str] = [
            sys.executable,
            manage_py_path,
            "test",
            "--testrunner=django_test_runner.CustomExecutionTestRunner",
        ]
        # Add any additional arguments to the command provided by the user.
        command.extend(args)
        # Add the test_ids to the command.
        print("Test IDs: ", test_ids)
        print("args: ", args)
        command.extend(test_ids)
        print("Running Django run tests with command: ", command)
        subprocess_execution = subprocess.run(
            command,
            capture_output=True,
            text=True,
            env=env,
        )
        print(subprocess_execution.stderr, file=sys.stderr)
        print(subprocess_execution.stdout, file=sys.stdout)
        # Zero return code indicates success, 1 indicates test failures, so both are considered successful.
        if subprocess_execution.returncode not in (0, 1):
            try:
                print("ERROR NUM", subprocess_execution.returncode)
                test_run_pipe: str | None = os.getenv("TEST_RUN_PIPE")
                eot_payload: EOTPayloadDict = {"command_type": "discovery", "eot": True}
                send_post_request(eot_payload, test_run_pipe)
            except Exception:
                raise VSCodeUnittestError(  # noqa: B904
                    "Connection failure, likely means failure in Django subprocess run, see specific error output above."
                )
    except Exception as e:
        print(f"Error during Django test execution: {e}", file=sys.stderr)

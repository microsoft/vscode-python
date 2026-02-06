# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os
import pathlib
import sys
import traceback
import unittest
from typing import List, Optional

script_dir = pathlib.Path(__file__).parent
sys.path.append(os.fspath(script_dir))

from django_handler import django_discovery_runner  # noqa: E402

# If I use from utils then there will be an import error in test_discovery.py.
from unittestadapter.pvsc_utils import (  # noqa: E402
    DiscoveryPayloadDict,
    VSCodeUnittestError,
    build_test_tree,
    parse_unittest_args,
    send_post_request,
)


def discover_tests(
    start_dir: str,
    pattern: str,
    top_level_dir: Optional[str],
    project_root_path: Optional[str] = None,
) -> DiscoveryPayloadDict:
    """Returns a dictionary containing details of the discovered tests.

    The returned dict has the following keys:

    - cwd: Absolute path to the test start directory (or project_root_path if provided);
    - status: Test discovery status, can be "success" or "error";
    - tests: Discoverered tests if any, not present otherwise. Note that the status can be "error" but the payload can still contain tests;
    - error: Discovery error if any, not present otherwise.

    Payload format for a successful discovery:
    {
        "status": "success",
        "cwd": <test discovery directory>,
        "tests": <test tree>
    }

    Payload format for a successful discovery with no tests:
    {
        "status": "success",
        "cwd": <test discovery directory>,
    }

    Payload format when there are errors:
    {
        "cwd": <test discovery directory>
        "": [list of errors]
        "status": "error",
    }

    Args:
        start_dir: Directory where test discovery starts
        pattern: Pattern to match test files (e.g., "test*.py")
        top_level_dir: Top-level directory for the test tree hierarchy
        project_root_path: Optional project root path for the cwd in the response payload
                          (used for project-based testing to root test tree at project)
    """
    cwd = os.path.abspath(project_root_path or start_dir)  # noqa: PTH100
    if "/" in start_dir:  #  is a subdir
        parent_dir = os.path.dirname(start_dir)  # noqa: PTH120
        sys.path.insert(0, parent_dir)
    else:
        sys.path.insert(0, cwd)
    payload: DiscoveryPayloadDict = {"cwd": cwd, "status": "success", "tests": None}
    tests = None
    error: List[str] = []

    try:
        loader = unittest.TestLoader()
        suite = loader.discover(start_dir, pattern, top_level_dir)

        # If the top level directory is not provided, then use the start directory.
        if top_level_dir is None:
            top_level_dir = start_dir

        # Get abspath of top level directory for build_test_tree.
        top_level_dir = os.path.abspath(top_level_dir)  # noqa: PTH100

        tests, error = build_test_tree(suite, top_level_dir)  # test tree built successfully here.

    except Exception:
        error.append(traceback.format_exc())

    # Still include the tests in the payload even if there are errors so that the TS
    # side can determine if it is from run or discovery.
    payload["tests"] = tests if tests is not None else None

    if len(error):
        payload["status"] = "error"
        payload["error"] = error

    return payload


if __name__ == "__main__":
    # Get unittest discovery arguments.
    argv = sys.argv[1:]
    index = argv.index("--udiscovery")

    (
        start_dir,
        pattern,
        top_level_dir,
        _verbosity,
        _failfast,
        _locals,
    ) = parse_unittest_args(argv[index + 1 :])

    test_run_pipe = os.getenv("TEST_RUN_PIPE")
    if not test_run_pipe:
        error_msg = (
            "UNITTEST ERROR: TEST_RUN_PIPE is not set at the time of unittest trying to send data. "
            "Please confirm this environment variable is not being changed or removed "
            "as it is required for successful test discovery and execution."
            f"TEST_RUN_PIPE = {test_run_pipe}\n"
        )
        print(error_msg, file=sys.stderr)
        raise VSCodeUnittestError(error_msg)

    if manage_py_path := os.environ.get("MANAGE_PY_PATH"):
        # Django configuration requires manage.py path to enable.
        print(
            f"MANAGE_PY_PATH is set, running Django discovery with path to manage.py as: ${manage_py_path}"
        )
        try:
            # collect args for Django discovery runner.
            args = argv[index + 1 :] or []
            django_discovery_runner(manage_py_path, args)
        except Exception as e:
            error_msg = f"Error configuring Django test runner: {e}"
            print(error_msg, file=sys.stderr)
            raise VSCodeUnittestError(error_msg)  # noqa: B904
    else:
        # Check for PROJECT_ROOT_PATH environment variable (project-based testing).
        # When set, this overrides top_level_dir to root the test tree at the project directory.
        project_root_path = os.environ.get("PROJECT_ROOT_PATH")
        if project_root_path:
            top_level_dir = project_root_path
            print(
                f"PROJECT_ROOT_PATH is set, using {project_root_path} as top_level_dir for discovery"
            )

        # Perform regular unittest test discovery.
        # Pass project_root_path so the payload's cwd matches the project root.
        payload = discover_tests(
            start_dir, pattern, top_level_dir, project_root_path=project_root_path
        )
        # Post this discovery payload.
        send_post_request(payload, test_run_pipe)

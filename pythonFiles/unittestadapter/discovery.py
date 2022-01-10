# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import getopt
import os
from typing import Any, Dict, List, Tuple, Union
import sys
import traceback
import unittest

from .utils import build_test_tree


# Add the lib path to our sys path to find the httpx module.
EXTENSION_ROOT = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
sys.path.insert(0, os.path.join(EXTENSION_ROOT, "pythonFiles", "lib", "python"))

import httpx


Arguments = Tuple[str, Any]

DEFAULT_PORT = 45454


def parse_port(args: List[Arguments]) -> int:
    """
    Parse command-line arguments that should be processed by the script,
    for example the port number that it needs to connect to.
    """
    # The port is passed to the discovery.py script when it is executed,
    # defaults to DEFAULT_PORT if it can't be parsed.
    port = DEFAULT_PORT
    for opt in args:
        if opt[0] == "--port":
            port = opt[1]
    return port


def parse_unittest_args(args: List[Arguments]) -> Tuple[str, str, Union[str, None]]:
    """
    Parse command-line arguments that should be forwarded to unittest.
    Unittest arguments are: -v, -s, -p, -t.
    """
    pattern: str = "test*.py"
    start_dir: str = "."
    top_level_dir: Union[str, None] = None

    for opt in args:
        if opt[0] in ("-s", "--start-directory"):
            start_dir = opt[1]
        elif opt[0] in ("-p", "--pattern"):
            pattern = opt[1]
        elif opt[0] in ("-t", "--top-level-directory"):
            top_level_dir = opt[1]

    return start_dir, pattern, top_level_dir


def discover_tests(start_dir, pattern, top_level_dir) -> Dict[str, Any]:
    """
    Unittest test discovery function, that returns a payload dictionary with the following keys:
    - cwd: Absolute path to the test start directory;
    - status: Test discovery status, can be "success" or "error";
    - tests: Discoverered tests if any, not present otherwise. Note that the status can be "error" but the payload can still contain tests;
    - errors: Discovery errors if any, not present otherwise.
    """
    cwd = os.path.abspath(start_dir)
    payload = {"cwd": cwd, "status": "success"}
    tests = None
    errors = []

    try:
        loader = unittest.TestLoader()
        suite = loader.discover(start_dir, pattern, top_level_dir)

        tests, errors = build_test_tree(suite, cwd)
    except:
        errors.append(traceback.format_exc())

    if tests is not None:
        payload["tests"] = tests

    if len(errors):
        payload["status"] = "error"
        payload["errors"] = errors

    # Connect to the TypeScript side and send payload.

    # Payload format for a successful discovery:
    # {
    #     "status": "success",
    #     "cwd": <test discovery directory>,
    #     "tests": <test tree>
    # }

    # Payload format for a successful discovery with no tests:
    # {
    #     "status": "success",
    #     "cwd": <test discovery directory>,
    # }

    # Payload format when there are errors:
    # {
    #     "cwd": <test discovery directory>
    #     "errors": [list of errors]
    #     "status": "error",
    # }

    return payload


if __name__ == "__main__":
    # Get unittest discovery arguments
    argv = sys.argv[1:]
    index = argv.index("--udiscovery")

    script_args, _ = getopt.getopt(argv[:index], "", ["port="])
    unittest_args, _ = getopt.getopt(
        argv[index + 1 :],
        "vs:p:t:",
        ["start-directory=", "pattern=", "top-level-directory="],
    )

    start_dir, pattern, top_level_dir = parse_unittest_args(unittest_args)

    # Perform test discovery & send it over
    payload = discover_tests(start_dir, pattern, top_level_dir)

    port = parse_port(script_args)
    httpx.post(f"http://localhost:{port}", data=payload)

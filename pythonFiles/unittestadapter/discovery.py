# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import getopt
import os
from typing import Any, Dict, List, Tuple
import sys
import traceback
import unittest

from utils import build_test_tree


# Add the lib path to our sys path to find the requests module.
EXTENSION_ROOT = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
sys.path.insert(0, os.path.join(EXTENSION_ROOT, "pythonFiles", "lib", "python"))

import requests


Arguments = Tuple[str, Any]


def parse_port(args: List[Arguments]) -> int:
    """
    Parse command-line arguments that should be processed by the script,
    for example the port number that it needs to connect to.
    """
    # The port is passed to the discovery.py script when it is executed,
    # defaults to 45454 if it can't be parsed.
    port = 45454
    for opt in args:
        if opt[0] == "--port":
            port = opt[1]
    return port


def parse_unittest_args(args: List[Arguments]) -> Tuple[str, str, str]:
    """
    Parse command-line arguments that should be forwarded to unittest.
    Unittest arguments are: -v, -s, -p, -t, in that order.
    """
    pattern = "test*.py"
    top_level_dir = None

    for opt in args:
        if opt[0] == "-s":
            start_dir = opt[1]
        elif opt[0] == "-p":
            pattern = opt[1]
        elif opt[0] == "-t":
            top_level_dir = opt[1]

    return start_dir, pattern, top_level_dir


def discover_tests(start_dir, pattern, top_level_dir) -> Dict[str, Any]:
    cwd = os.path.abspath(start_dir)
    payload = {"cwd": cwd}
    tests = None
    errors = []

    try:
        loader = unittest.TestLoader()
        suite = loader.discover(start_dir, pattern, top_level_dir)

        tests, errors = build_test_tree(suite, cwd)
    except:
        payload["status"] = "error"
        errors.append(traceback.format_exc())

    if tests is not None:
        payload["tests"] = tests

    if len(errors):
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
    requests.post(f"http://localhost:{port}", json=payload)

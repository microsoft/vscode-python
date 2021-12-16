import getopt
import os
from typing import Any, List, Tuple
import requests
import sys
import traceback
import unittest

from utils import build_test_tree

sys.path.insert(0, os.getcwd())

# Get arguments
argv = sys.argv[1:]
index = argv.index("--")

script_args, _ = getopt.getopt(argv[:index], "", ["port="])
unittest_args, _ = getopt.getopt(
    argv[index + 1 :],
    "vs:p:t:",
    ["start-directory=", "pattern=", "top-level-directory="],
)

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


if __name__ == "__main__":
    # Test discovery
    start_dir, pattern, top_level_dir = parse_unittest_args(unittest_args)
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

    # Payload format when there are errors:
    # {
    #     "cwd": <test discovery directory>
    #     "errors": [list of errors]
    #     "status": "error",
    # }

    port = parse_port(script_args)
    requests.post(f"http://localhost:{port}", json=payload)

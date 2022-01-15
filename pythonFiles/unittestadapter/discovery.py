# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import argparse
import getopt
import os
import sys
import traceback
import unittest
from typing import Any, List, Literal, Optional, Tuple, TypedDict, Union

from typing_extensions import NotRequired

from .utils import TestNode, build_test_tree

# Add the lib path to our sys path to find the httpx module.
EXTENSION_ROOT = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
sys.path.insert(0, os.path.join(EXTENSION_ROOT, "pythonFiles", "lib", "python"))

import httpx

DEFAULT_PORT = "45454"


def parse_port(args: List[str]) -> int:
    """Parse command-line arguments that should be processed by the script.

    So far that only includes the port number that it needs to connect to.
    The port is passed to the discovery.py script when it is executed, and
    defaults to DEFAULT_PORT if it can't be parsed.
    If there are several --port arguments, the value returned by parse_port will be the value of the last --port argument.
    """
    arg_parser = argparse.ArgumentParser()
    arg_parser.add_argument("--port", default=DEFAULT_PORT)
    parsed_args, _ = arg_parser.parse_known_args(args)

    return int(parsed_args.port)


def parse_unittest_args(args: List[str]) -> Tuple[str, str, Union[str, None]]:
    """Parse command-line arguments that should be forwarded to unittest.

    Valid unittest arguments are: -v, -s, -p, -t and their long-form counterparts,
    however we only care about the last three.

    The returned tuple contains the following items
    - start_directory: The directory where to start discovery, defaults to .
    - pattern: The pattern to match test files, defaults to test*.py
    - top_level_directory: The top-level directory of the project, defaults to None, and unittest will use start_directory behind the scenes.
    """

    arg_parser = argparse.ArgumentParser()
    arg_parser.add_argument("--start-directory", "-s", default=".")
    arg_parser.add_argument("--pattern", "-p", default="test*.py")
    arg_parser.add_argument("--top-level-directory", "-t", default=None)

    parsed_args, _ = arg_parser.parse_known_args(args)

    return (
        parsed_args.start_directory,
        parsed_args.pattern,
        parsed_args.top_level_directory,
    )


class PayloadDict(TypedDict):
    cwd: str
    status: Literal["success", "error"]
    tests: NotRequired[TestNode]
    errors: NotRequired[List[str]]


def discover_tests(
    start_dir: str, pattern: str, top_level_dir: Optional[str]
) -> PayloadDict:
    """Returns a dictionary containing details of the discovered tests.

    The returned dict has the following keys:

    - cwd: Absolute path to the test start directory;
    - status: Test discovery status, can be "success" or "error";
    - tests: Discoverered tests if any, not present otherwise. Note that the status can be "error" but the payload can still contain tests;
    - errors: Discovery errors if any, not present otherwise.

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
        "errors": [list of errors]
        "status": "error",
    }
    """
    cwd = os.path.abspath(start_dir)
    payload: PayloadDict = {"cwd": cwd, "status": "success"}
    tests = None
    errors = []

    try:
        loader = unittest.TestLoader()
        suite = loader.discover(start_dir, pattern, top_level_dir)

        tests, errors = build_test_tree(suite, cwd)
    except Exception:
        errors.append(traceback.format_exc())

    if tests is not None:
        payload["tests"] = tests

    if len(errors):
        payload["status"] = "error"
        payload["errors"] = errors

    return payload


if __name__ == "__main__":
    # Get unittest discovery arguments.
    argv = sys.argv[1:]
    index = argv.index("--udiscovery")

    start_dir, pattern, top_level_dir = parse_unittest_args(argv[index + 1 :])

    # Perform test discovery & send it over.
    payload = discover_tests(start_dir, pattern, top_level_dir)

    port = parse_port(argv[:index])
    httpx.post(f"http://localhost:{port}", data=payload)  # type: ignore

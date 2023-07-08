# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import argparse
import json
import os
import pathlib
import sys
import traceback
import unittest
from typing import List, Optional, Tuple, Union

script_dir = pathlib.Path(__file__).parent.parent
sys.path.append(os.fspath(script_dir))
sys.path.insert(0, os.fspath(script_dir / "lib" / "python"))

from testing_tools import socket_manager

# If I use from utils then there will be an import error in test_discovery.py.
from unittestadapter.utils import TestNode, build_test_tree, parse_unittest_args

from typing_extensions import NotRequired, TypedDict, Literal

DEFAULT_PORT = "45454"


def parse_discovery_cli_args(args: List[str]) -> Tuple[int, Union[str, None]]:
    """Parse command-line arguments that should be processed by the script.

    So far this includes the port number that it needs to connect to, and the uuid passed by the TS side.
    The port is passed to the discovery.py script when it is executed, and
    defaults to DEFAULT_PORT if it can't be parsed.
    The uuid should be passed to the discovery.py script when it is executed, and defaults to None if it can't be parsed.
    If the arguments appear several times, the value returned by parse_cli_args will be the value of the last argument.
    """
    arg_parser = argparse.ArgumentParser()
    arg_parser.add_argument("--port", default=DEFAULT_PORT)
    arg_parser.add_argument("--uuid")
    parsed_args, _ = arg_parser.parse_known_args(args)

    return int(parsed_args.port), parsed_args.uuid


class PayloadDict(TypedDict):
    cwd: str
    status: Literal["success", "error"]
    tests: Optional[TestNode]
    error: NotRequired[List[str]]


def discover_tests(
    start_dir: str, pattern: str, top_level_dir: Optional[str], uuid: Optional[str]
) -> PayloadDict:
    """Returns a dictionary containing details of the discovered tests.

    The returned dict has the following keys:

    - cwd: Absolute path to the test start directory;
    - uuid: UUID sent by the caller of the Python script, that needs to be sent back as an integrity check;
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
    """
    cwd = os.path.abspath(start_dir)
    payload: PayloadDict = {"cwd": cwd, "status": "success", "tests": None}
    tests = None
    error: List[str] = []

    try:
        loader = unittest.TestLoader()
        suite = loader.discover(start_dir, pattern, top_level_dir)

        tests, error = build_test_tree(suite, cwd)  # test tree built succesfully here.

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

    start_dir, pattern, top_level_dir = parse_unittest_args(argv[index + 1 :])

    # Perform test discovery.
    port, uuid = parse_discovery_cli_args(argv[:index])
    payload = discover_tests(start_dir, pattern, top_level_dir, uuid)

    # Build the request data (it has to be a POST request or the Node side will not process it), and send it.
    addr = ("localhost", port)
    data = json.dumps(payload)
    request = f"""Content-Length: {len(data)}
Content-Type: application/json
Request-uuid: {uuid}

{data}"""
    try:
        with socket_manager.SocketManager(addr) as s:
            if s.socket is not None:
                s.socket.sendall(request.encode("utf-8"))
    except Exception as e:
        print(f"Error sending response: {e}")
        print(f"Request data: {request}")

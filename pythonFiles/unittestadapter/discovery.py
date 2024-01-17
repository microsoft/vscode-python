# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import json
import os
import pathlib
import sys
import traceback
import unittest
from typing import List, Optional, Union

script_dir = pathlib.Path(__file__).parent.parent
sys.path.append(os.fspath(script_dir))
sys.path.insert(0, os.fspath(script_dir / "lib" / "python"))

from testing_tools import socket_manager
from typing_extensions import Literal, NotRequired, TypedDict

# If I use from utils then there will be an import error in test_discovery.py.
from unittestadapter.pvsc_utils import (
    TestNode,
    build_test_tree,
    parse_unittest_args,
)

DEFAULT_PORT = 45454


class PayloadDict(TypedDict):
    cwd: str
    status: Literal["success", "error"]
    tests: Optional[TestNode]
    error: NotRequired[List[str]]


class EOTPayloadDict(TypedDict):
    """A dictionary that is used to send a end of transmission post request to the server."""

    command_type: Union[Literal["discovery"], Literal["execution"]]
    eot: bool


def discover_tests(
    start_dir: str,
    pattern: str,
    top_level_dir: Optional[str],
    uuid: Optional[str],
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
    if "/" in start_dir:  #  is a subdir
        parent_dir = os.path.dirname(start_dir)
        sys.path.insert(0, parent_dir)
    else:
        sys.path.insert(0, cwd)
    payload: PayloadDict = {"cwd": cwd, "status": "success", "tests": None}
    tests = None
    error: List[str] = []

    try:
        loader = unittest.TestLoader()
        suite = loader.discover(start_dir, pattern, top_level_dir)

        # If the top level directory is not provided, then use the start directory.
        if top_level_dir is None:
            top_level_dir = start_dir

        # Get abspath of top level directory for build_test_tree.
        top_level_dir = os.path.abspath(top_level_dir)

        tests, error = build_test_tree(
            suite, top_level_dir
        )  # test tree built successfully here.

    except Exception:
        error.append(traceback.format_exc())

    # Still include the tests in the payload even if there are errors so that the TS
    # side can determine if it is from run or discovery.
    payload["tests"] = tests if tests is not None else None

    if len(error):
        payload["status"] = "error"
        payload["error"] = error

    return payload


def post_response(
    payload: Union[PayloadDict, EOTPayloadDict], port: int, uuid: str
) -> None:
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

    testPort = int(os.environ.get("TEST_PORT", DEFAULT_PORT))
    testUuid = os.environ.get("TEST_UUID")
    if testPort is DEFAULT_PORT:
        print(
            "Error[vscode-unittest]: TEST_PORT is not set.",
            " TEST_UUID = ",
            testUuid,
        )
    if testUuid is not None:
        # Perform test discovery.
        payload = discover_tests(start_dir, pattern, top_level_dir, testUuid)
        # Post this discovery payload.
        post_response(payload, testPort, testUuid)
        # Post EOT token.
        eot_payload: EOTPayloadDict = {"command_type": "discovery", "eot": True}
        post_response(eot_payload, testPort, testUuid)
    else:
        print("Error: no uuid provided or parsed.")
        eot_payload: EOTPayloadDict = {"command_type": "discovery", "eot": True}
        post_response(eot_payload, testPort, "")

# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import argparse
import enum
import json
import os
import pathlib
import socket
import sys
import traceback
import unittest
from types import TracebackType
from typing import Dict, List, Optional, Tuple, Type, Union

script_dir = pathlib.Path(__file__).parent.parent
sys.path.append(os.fspath(script_dir))
sys.path.insert(0, os.fspath(script_dir / "lib" / "python"))

from typing_extensions import NotRequired, TypeAlias, TypedDict

from testing_tools import process_json_util, socket_manager
from unittestadapter.utils import parse_unittest_args

DEFAULT_PORT = "45454"


def parse_execution_cli_args(
    args: List[str],
) -> Tuple[int, Union[str, None]]:
    """Parse command-line arguments that should be processed by the script.

    So far this includes the port number that it needs to connect to, the uuid passed by the TS side,
    and the list of test ids to report.
    The port is passed to the execution.py script when it is executed, and
    defaults to DEFAULT_PORT if it can't be parsed.
    The list of test ids is passed to the execution.py script when it is executed, and defaults to an empty list if it can't be parsed.
    The uuid should be passed to the execution.py script when it is executed, and defaults to None if it can't be parsed.
    If the arguments appear several times, the value returned by parse_cli_args will be the value of the last argument.
    """
    arg_parser = argparse.ArgumentParser()
    arg_parser.add_argument("--port", default=DEFAULT_PORT)
    arg_parser.add_argument("--uuid")
    parsed_args, _ = arg_parser.parse_known_args(args)

    return (int(parsed_args.port), parsed_args.uuid)


ErrorType = Union[
    Tuple[Type[BaseException], BaseException, TracebackType], Tuple[None, None, None]
]
PORT = 0
UUID = 0
START_DIR = ""


class TestOutcomeEnum(str, enum.Enum):
    error = "error"
    failure = "failure"
    success = "success"
    skipped = "skipped"
    expected_failure = "expected-failure"
    unexpected_success = "unexpected-success"
    subtest_success = "subtest-success"
    subtest_failure = "subtest-failure"


class UnittestTestResult(unittest.TextTestResult):
    def __init__(self, *args, **kwargs):
        self.formatted: Dict[str, Dict[str, Union[str, None]]] = dict()
        super(UnittestTestResult, self).__init__(*args, **kwargs)

    def startTest(self, test: unittest.TestCase):
        super(UnittestTestResult, self).startTest(test)

    def addError(
        self,
        test: unittest.TestCase,
        err: ErrorType,
    ):
        super(UnittestTestResult, self).addError(test, err)
        self.formatResult(test, TestOutcomeEnum.error, err)

    def addFailure(
        self,
        test: unittest.TestCase,
        err: ErrorType,
    ):
        super(UnittestTestResult, self).addFailure(test, err)
        self.formatResult(test, TestOutcomeEnum.failure, err)

    def addSuccess(self, test: unittest.TestCase):
        super(UnittestTestResult, self).addSuccess(test)
        self.formatResult(test, TestOutcomeEnum.success)

    def addSkip(self, test: unittest.TestCase, reason: str):
        super(UnittestTestResult, self).addSkip(test, reason)
        self.formatResult(test, TestOutcomeEnum.skipped)

    def addExpectedFailure(self, test: unittest.TestCase, err: ErrorType):
        super(UnittestTestResult, self).addExpectedFailure(test, err)
        self.formatResult(test, TestOutcomeEnum.expected_failure, err)

    def addUnexpectedSuccess(self, test: unittest.TestCase):
        super(UnittestTestResult, self).addUnexpectedSuccess(test)
        self.formatResult(test, TestOutcomeEnum.unexpected_success)

    def addSubTest(
        self,
        test: unittest.TestCase,
        subtest: unittest.TestCase,
        err: Union[ErrorType, None],
    ):
        super(UnittestTestResult, self).addSubTest(test, subtest, err)
        self.formatResult(
            test,
            TestOutcomeEnum.subtest_failure if err else TestOutcomeEnum.subtest_success,
            err,
            subtest,
        )

    def formatResult(
        self,
        test: unittest.TestCase,
        outcome: str,
        error: Union[ErrorType, None] = None,
        subtest: Union[unittest.TestCase, None] = None,
    ):
        tb = None
        if error and error[2] is not None:
            # Format traceback
            formatted = traceback.format_exception(*error)
            # Remove the 'Traceback (most recent call last)'
            formatted = formatted[1:]
            tb = "".join(formatted)

        if subtest:
            test_id = subtest.id()
        else:
            test_id = test.id()

        result = {
            "test": test.id(),
            "outcome": outcome,
            "message": str(error),
            "traceback": tb,
            "subtest": subtest.id() if subtest else None,
        }
        self.formatted[test_id] = result
        if PORT == 0 or UUID == 0:
            print("Error sending response, port or uuid unknown to python server.")
        send_run_data(result, PORT, UUID)


class TestExecutionStatus(str, enum.Enum):
    error = "error"
    success = "success"


TestResultTypeAlias: TypeAlias = Dict[str, Dict[str, Union[str, None]]]


class PayloadDict(TypedDict):
    cwd: str
    status: TestExecutionStatus
    result: Optional[TestResultTypeAlias]
    not_found: NotRequired[List[str]]
    error: NotRequired[str]


# Args: start_path path to a directory or a file, list of ids that may be empty.
# Edge cases:
# - if tests got deleted since the VS Code side last ran discovery and the current test run,
# return these test ids in the "not_found" entry, and the VS Code side can process them as "unknown";
# - if tests got added since the VS Code side last ran discovery and the current test run, ignore them.
def run_tests(
    start_dir: str,
    test_ids: List[str],
    pattern: str,
    top_level_dir: Optional[str],
    uuid: Optional[str],
) -> PayloadDict:
    cwd = os.path.abspath(start_dir)
    status = TestExecutionStatus.error
    error = None
    payload: PayloadDict = {"cwd": cwd, "status": status, "result": None}

    try:
        # If it's a file, split path and file name.
        start_dir = cwd
        if cwd.endswith(".py"):
            start_dir = os.path.dirname(cwd)
            pattern = os.path.basename(cwd)

        # Discover tests at path with the file name as a pattern (if any).
        loader = unittest.TestLoader()

        args = {  # noqa: F841
            "start_dir": start_dir,
            "pattern": pattern,
            "top_level_dir": top_level_dir,
        }
        suite = loader.discover(start_dir, pattern, top_level_dir)  # noqa: F841

        # Run tests.
        runner = unittest.TextTestRunner(resultclass=UnittestTestResult)
        # lets try to tailer our own suite so we can figure out running only the ones we want
        loader = unittest.TestLoader()
        tailor: unittest.TestSuite = loader.loadTestsFromNames(test_ids)
        result: UnittestTestResult = runner.run(tailor)  # type: ignore

        payload["result"] = result.formatted

    except Exception:
        status = TestExecutionStatus.error
        error = traceback.format_exc()

    if error is not None:
        payload["error"] = error
    else:
        status = TestExecutionStatus.success

    payload["status"] = status

    return payload


def send_run_data(raw_data, port, uuid):
    # Build the request data (it has to be a POST request or the Node side will not process it), and send it.
    status = raw_data["outcome"]
    cwd = os.path.abspath(START_DIR)
    if raw_data["subtest"]:
        test_id = raw_data["subtest"]
    else:
        test_id = raw_data["test"]
    test_dict = {}
    test_dict[test_id] = raw_data
    payload: PayloadDict = {"cwd": cwd, "status": status, "result": test_dict}
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
    # Get unittest test execution arguments.
    argv = sys.argv[1:]
    index = argv.index("--udiscovery")

    start_dir, pattern, top_level_dir = parse_unittest_args(argv[index + 1 :])

    run_test_ids_port = os.environ.get("RUN_TEST_IDS_PORT")
    run_test_ids_port_int = (
        int(run_test_ids_port) if run_test_ids_port is not None else 0
    )

    # get data from socket
    test_ids_from_buffer = []
    try:
        client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        client_socket.connect(("localhost", run_test_ids_port_int))
        buffer = b""

        while True:
            # Receive the data from the client
            data = client_socket.recv(1024 * 1024)
            if not data:
                break

            # Append the received data to the buffer
            buffer += data

            try:
                # Try to parse the buffer as JSON
                test_ids_from_buffer = process_json_util.process_rpc_json(
                    buffer.decode("utf-8")
                )
                # Clear the buffer as complete JSON object is received
                buffer = b""

                # Process the JSON data
                break
            except json.JSONDecodeError:
                # JSON decoding error, the complete JSON object is not yet received
                continue
    except socket.error as e:
        print(f"Error: Could not connect to runTestIdsPort: {e}")
        print("Error: Could not connect to runTestIdsPort")

    PORT, UUID = parse_execution_cli_args(argv[:index])
    if test_ids_from_buffer:
        # Perform test execution.
        payload = run_tests(
            start_dir, test_ids_from_buffer, pattern, top_level_dir, UUID
        )
    else:
        cwd = os.path.abspath(start_dir)
        status = TestExecutionStatus.error
        payload: PayloadDict = {
            "cwd": cwd,
            "status": status,
            "error": "No test ids received from buffer",
            "result": None,
        }

# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import atexit
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

from testing_tools import process_json_util, socket_manager
from typing_extensions import Literal, NotRequired, TypeAlias, TypedDict
from unittestadapter.pvsc_utils import parse_unittest_args

ErrorType = Union[
    Tuple[Type[BaseException], BaseException, TracebackType], Tuple[None, None, None]
]
testPort = 0
testUuid = 0
START_DIR = ""
DEFAULT_PORT = 45454


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

        message = ""
        # error is a tuple of the form returned by sys.exc_info(): (type, value, traceback).
        if error is not None:
            try:
                message = f"{error[0]} {error[1]}"
            except Exception:
                message = "Error occurred, unknown type or value"
            formatted = traceback.format_exception(*error)
            tb = "".join(formatted)
            # Remove the 'Traceback (most recent call last)'
            formatted = formatted[1:]
        if subtest:
            test_id = subtest.id()
        else:
            test_id = test.id()

        result = {
            "test": test.id(),
            "outcome": outcome,
            "message": message,
            "traceback": tb,
            "subtest": subtest.id() if subtest else None,
        }
        self.formatted[test_id] = result
        if testPort == 0 or testUuid == 0:
            print("Error sending response, port or uuid unknown to python server.")
        send_run_data(result, testPort, testUuid)


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


class EOTPayloadDict(TypedDict):
    """A dictionary that is used to send a end of transmission post request to the server."""

    command_type: Union[Literal["discovery"], Literal["execution"]]
    eot: bool


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
    verbosity: int,
    failfast: Optional[bool],
    locals: Optional[bool] = None,
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

        if failfast is None:
            failfast = False
        if locals is None:
            locals = False
        if verbosity is None:
            verbosity = 1
        runner = unittest.TextTestRunner(
            resultclass=UnittestTestResult,
            tb_locals=locals,
            failfast=failfast,
            verbosity=verbosity,
        )
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


__socket = None
atexit.register(lambda: __socket.close() if __socket else None)


def send_run_data(raw_data, port, uuid):
    status = raw_data["outcome"]
    cwd = os.path.abspath(START_DIR)
    if raw_data["subtest"]:
        test_id = raw_data["subtest"]
    else:
        test_id = raw_data["test"]
    test_dict = {}
    test_dict[test_id] = raw_data
    payload: PayloadDict = {"cwd": cwd, "status": status, "result": test_dict}
    post_response(payload, port, uuid)


def post_response(
    payload: Union[PayloadDict, EOTPayloadDict], port: int, uuid: str
) -> None:
    # Build the request data (it has to be a POST request or the Node side will not process it), and send it.
    addr = ("localhost", port)
    global __socket
    if __socket is None:
        try:
            __socket = socket_manager.SocketManager(addr)
            __socket.connect()
        except Exception as error:
            print(f"Plugin error connection error[vscode-pytest]: {error}")
            __socket = None
    data = json.dumps(payload)
    request = f"""Content-Length: {len(data)}
Content-Type: application/json
Request-uuid: {uuid}

{data}"""
    try:
        if __socket is not None and __socket.socket is not None:
            __socket.socket.sendall(request.encode("utf-8"))
    except Exception as ex:
        print(f"Error sending response: {ex}")
        print(f"Request data: {request}")


if __name__ == "__main__":
    # Get unittest test execution arguments.
    argv = sys.argv[1:]
    index = argv.index("--udiscovery")

    (
        start_dir,
        pattern,
        top_level_dir,
        verbosity,
        failfast,
        locals,
    ) = parse_unittest_args(argv[index + 1 :])

    run_test_ids_port = os.environ.get("RUN_TEST_IDS_PORT")
    run_test_ids_port_int = (
        int(run_test_ids_port) if run_test_ids_port is not None else 0
    )
    if run_test_ids_port_int == 0:
        print("Error[vscode-unittest]: RUN_TEST_IDS_PORT env var is not set.")
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
                break
            except json.JSONDecodeError:
                # JSON decoding error, the complete JSON object is not yet received
                continue
    except socket.error as e:
        print(f"Error: Could not connect to runTestIdsPort: {e}")
        print("Error: Could not connect to runTestIdsPort")

    testPort = int(os.environ.get("TEST_PORT", DEFAULT_PORT))
    testUuid = os.environ.get("TEST_UUID")
    if testPort is DEFAULT_PORT:
        print(
            "Error[vscode-unittest]: TEST_PORT is not set.",
            " TEST_UUID = ",
            testUuid,
        )
    if testUuid is None:
        print(
            "Error[vscode-unittest]: TEST_UUID is not set.",
            " TEST_PORT = ",
            testPort,
        )
        testUuid = "unknown"
    if test_ids_from_buffer:
        # Perform test execution.
        payload = run_tests(
            start_dir,
            test_ids_from_buffer,
            pattern,
            top_level_dir,
            testUuid,
            verbosity,
            failfast,
            locals,
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
    eot_payload: EOTPayloadDict = {"command_type": "execution", "eot": True}
    if testUuid is None:
        print("Error sending response, uuid unknown to python server.")
        post_response(eot_payload, testPort, "unknown")
    else:
        post_response(eot_payload, testPort, testUuid)

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

from testing_tools import process_json_util, socket_manager  # noqa: E402
from unittestadapter.pvsc_utils import (  # noqa: E402
    VSCodeUnittestError,
    parse_unittest_args,
    send_post_request,
    ExecutionPayloadDict,
    EOTPayloadDict,
    TestExecutionStatus,
)

ErrorType = Union[Tuple[Type[BaseException], BaseException, TracebackType], Tuple[None, None, None]]
test_run_pipe = ""
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
        test_run_pipe = os.getenv("TEST_RUN_PIPE")
        if not test_run_pipe:
            print(
                "UNITTEST ERROR: TEST_RUN_PIPE is not set at the time of unittest trying to send data. "
                f"TEST_RUN_PIPE = {test_run_pipe}\n",
                file=sys.stderr,
            )
            raise VSCodeUnittestError(
                "UNITTEST ERROR: TEST_RUN_PIPE is not set at the time of unittest trying to send data. "
            )
        send_run_data(result, test_run_pipe)


def filter_tests(suite: unittest.TestSuite, test_ids: List[str]) -> unittest.TestSuite:
    """Filter the tests in the suite to only run the ones with the given ids."""
    filtered_suite = unittest.TestSuite()
    for test in suite:
        if isinstance(test, unittest.TestCase):
            if test.id() in test_ids:
                filtered_suite.addTest(test)
        else:
            filtered_suite.addTest(filter_tests(test, test_ids))
    return filtered_suite


def get_all_test_ids(suite: unittest.TestSuite) -> List[str]:
    """Return a list of all test ids in the suite."""
    test_ids = []
    for test in suite:
        if isinstance(test, unittest.TestCase):
            test_ids.append(test.id())
        else:
            test_ids.extend(get_all_test_ids(test))
    return test_ids


def find_missing_tests(test_ids: List[str], suite: unittest.TestSuite) -> List[str]:
    """Return a list of test ids that are not in the suite."""
    all_test_ids = get_all_test_ids(suite)
    return [test_id for test_id in test_ids if test_id not in all_test_ids]


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
    verbosity: int,
    failfast: Optional[bool],
    locals: Optional[bool] = None,
) -> ExecutionPayloadDict:
    cwd = os.path.abspath(start_dir)
    status = TestExecutionStatus.error
    error = None
    payload: ExecutionPayloadDict = {"cwd": cwd, "status": status, "result": None}

    try:
        # If it's a file, split path and file name.
        start_dir = cwd
        if cwd.endswith(".py"):
            start_dir = os.path.dirname(cwd)
            pattern = os.path.basename(cwd)

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

        # Discover tests at path with the file name as a pattern (if any).
        loader = unittest.TestLoader()
        suite = loader.discover(start_dir, pattern, top_level_dir)

        # lets try to tailer our own suite so we can figure out running only the ones we want
        tailor: unittest.TestSuite = filter_tests(suite, test_ids)

        # If any tests are missing, add them to the payload.
        not_found = find_missing_tests(test_ids, tailor)
        if not_found:
            missing_suite = loader.loadTestsFromNames(not_found)
            tailor.addTests(missing_suite)

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


def send_run_data(raw_data, test_run_pipe):
    status = raw_data["outcome"]
    cwd = os.path.abspath(START_DIR)
    if raw_data["subtest"]:
        test_id = raw_data["subtest"]
    else:
        test_id = raw_data["test"]
    test_dict = {}
    test_dict[test_id] = raw_data
    payload: ExecutionPayloadDict = {"cwd": cwd, "status": status, "result": test_dict}
    send_post_request(payload, test_run_pipe)


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

    run_test_ids_pipe = os.environ.get("RUN_TEST_IDS_PIPE")
    test_run_pipe = os.getenv("TEST_RUN_PIPE")

    if not run_test_ids_pipe:
        print("Error[vscode-unittest]: RUN_TEST_IDS_PIPE env var is not set.")
        raise VSCodeUnittestError("Error[vscode-unittest]: RUN_TEST_IDS_PIPE env var is not set.")
    if not test_run_pipe:
        print("Error[vscode-unittest]: TEST_RUN_PIPE env var is not set.")
        raise VSCodeUnittestError("Error[vscode-unittest]: TEST_RUN_PIPE env var is not set.")
    test_ids_from_buffer = []
    raw_json = None
    try:
        with socket_manager.PipeManager(run_test_ids_pipe) as sock:
            buffer: str = ""
            while True:
                # Receive the data from the client
                data: str = sock.read()
                if not data:
                    break

                # Append the received data to the buffer
                buffer += data

                try:
                    # Try to parse the buffer as JSON
                    raw_json = process_json_util.process_rpc_json(buffer)
                    # Clear the buffer as complete JSON object is received
                    buffer = ""
                    print("Received JSON data in run")
                    break
                except json.JSONDecodeError:
                    # JSON decoding error, the complete JSON object is not yet received
                    continue
    except socket.error as e:
        msg = f"Error: Could not connect to RUN_TEST_IDS_PIPE: {e}"
        print(msg)
        raise VSCodeUnittestError(msg)

    try:
        if raw_json and "params" in raw_json:
            test_ids_from_buffer = raw_json["params"]
            if test_ids_from_buffer:
                # Perform test execution.
                payload = run_tests(
                    start_dir,
                    test_ids_from_buffer,
                    pattern,
                    top_level_dir,
                    verbosity,
                    failfast,
                    locals,
                )
        else:
            # No test ids received from buffer
            cwd = os.path.abspath(start_dir)
            status = TestExecutionStatus.error
            payload: ExecutionPayloadDict = {
                "cwd": cwd,
                "status": status,
                "error": "No test ids received from buffer",
                "result": None,
            }
            send_post_request(payload, test_run_pipe)
    except json.JSONDecodeError:
        msg = "Error: Could not parse test ids from stdin"
        print(msg)
        raise VSCodeUnittestError(msg)
    eot_payload: EOTPayloadDict = {"command_type": "execution", "eot": True}
    send_post_request(eot_payload, test_run_pipe)

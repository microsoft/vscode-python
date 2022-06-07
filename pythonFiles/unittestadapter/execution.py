# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import argparse
import enum
import json
import os
import sys
import traceback
import unittest
from types import TracebackType
from typing import Dict, List, Optional, Tuple, Type, TypeAlias, TypedDict

from typing_extensions import NotRequired

from .discovery import parse_unittest_discovery_args

# Add the path to pythonFiles to sys.path to find testing_tools.socket_manager.
PYTHON_FILES = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PYTHON_FILES)

# from testing_tools import socket_manager

# Add the lib path to sys.path to find the typing_extensions module.
sys.path.insert(0, os.path.join(PYTHON_FILES, "lib", "python"))

DEFAULT_PORT = "45454"


def parse_execution_cli_args(args: List[str]) -> Tuple[int, str | None, List[str]]:
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
    arg_parser.add_argument("--testids")
    parsed_args, _ = arg_parser.parse_known_args(args)

    test_ids: List[str] = parsed_args.testids.split(",") if parsed_args.testids else []

    return (int(parsed_args.port), parsed_args.uuid, test_ids)


ErrorType: TypeAlias = (
    Tuple[Type[BaseException], BaseException, TracebackType] | Tuple[None, None, None]
)


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
    formatted: Dict[str, Dict[str, str | None]] = dict()

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
        self, test: unittest.TestCase, subtest: unittest.TestCase, err: ErrorType | None
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
        error: ErrorType | None = None,
        subtest: unittest.TestCase | None = None,
    ):
        tb = None
        if error and error[2] is not None:
            # Format traceback
            formatted = traceback.format_exception(*error)
            # Remove the 'Traceback (most recent call last)'
            formatted = formatted[1:]
            tb = "".join(formatted)

        test_id = test.id()

        result = {
            "test": test.id(),
            "outcome": outcome,
            "message": str(error),
            "traceback": tb,
            "subtest": subtest.id() if subtest else None,
        }

        self.formatted[test_id] = result


class TestExecutionStatus(str, enum.Enum):
    error = "error"
    success = "success"


TestResultTypeAlias: TypeAlias = Dict[str, Dict[str, str | None]]


class PayloadDict(TypedDict):
    cwd: str
    uuid: str | None
    status: TestExecutionStatus
    result: NotRequired[TestResultTypeAlias]
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
    pattern: Optional[str],
    top_level_dir: Optional[str],
    uuid: Optional[str],
) -> PayloadDict:
    cwd = os.path.abspath(start_dir)
    status = TestExecutionStatus.success
    error = None
    payload: PayloadDict = {"cwd": cwd, "uuid": uuid, "status": status}

    try:
        # If it's a file, split path and file name.
        start_dir = cwd
        if cwd.endswith(".py"):
            start_dir = os.path.dirname(cwd)
            pattern = os.path.basename(cwd)

        # Discover tests at path with the file name as a pattern (if any).
        loader = unittest.TestLoader()

        args = {
            "start_dir": start_dir,
            "pattern": pattern,
            "top_level_dir": top_level_dir,
        }
        suite = loader.discover(**{k: v for k, v in args.items() if v is not None})

        # Run tests.
        runner = unittest.TextTestRunner(resultclass=UnittestTestResult)
        result: UnittestTestResult = runner.run(suite)  # type: ignore

        # Filter tests by id.
        filtered_results = {k: v for k, v in result.formatted.items() if k in test_ids}
        payload["result"] = filtered_results

        # Add a payload entry with the list of test ids for tests that weren't found.
        not_found = set(test_ids) - set(filtered_results.keys())
        if not_found:
            payload["not_found"] = list(not_found)
    except Exception:
        status = TestExecutionStatus.error
        error = traceback.format_exc()

    if error is not None:
        payload["error"] = error

    payload["status"] = status

    print(f"payload: \n{json.dumps(payload, indent=4)}")

    return payload


if __name__ == "__main__":
    # Get unittest test execution arguments.
    argv = sys.argv[1:]
    index = argv.index("--udiscovery")

    start_dir, pattern, top_level_dir = parse_unittest_discovery_args(argv[index + 1 :])

    # start_path = pathlib.Path.home() / "Documents" / "Sandbox" / "unittest-subtest"
    # test_ids = [
    #     "subfolder.test_two.TestClassTwo.test_two_two",
    #     "test_one.TestClassOne.test_func_one",
    #     "test_eight.TestClassEight.test_func_eight",
    # ]
    # uuid = "abcd"

    # Perform test execution.
    port, uuid, test_ids = parse_execution_cli_args(argv[:index])
    run_tests(start_dir, test_ids, pattern, top_level_dir, uuid)


#     # Build the request data (it has to be a POST request or the Node side will not process it), and send it.
#     addr = ("localhost", port)
#     with socket_manager.SocketManager(addr) as s:
#         data = json.dumps(payload)
#         request = f"""POST / HTTP/1.1
# Host: localhost:{port}
# Content-Length: {len(data)}
# Content-Type: application/json

# {data}"""
#         result = s.socket.sendall(request.encode("utf-8"))  # type: ignore

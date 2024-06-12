# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os
import pathlib
import sys
from unittest.mock import patch
from typing import Dict, Optional

import pytest

script_dir = pathlib.Path(__file__).parent.parent.parent
sys.path.insert(0, os.fspath(script_dir / "lib" / "python"))

from unittestadapter.pvsc_utils import ExecutionPayloadDict  # noqa: E402
from unittestadapter.execution import run_tests  # noqa: E402

TEST_DATA_PATH = pathlib.Path(__file__).parent / ".data"


def test_no_ids_run() -> None:
    """This test runs on an empty array of test_ids, therefore it should return
    an empty dict for the result.
    """
    start_dir: str = os.fspath(TEST_DATA_PATH)
    testids = []
    pattern = "discovery_simple*"
    actual = run_tests(start_dir, testids, pattern, None, 1, None)
    assert actual
    assert all(item in actual for item in ("cwd", "status"))
    assert actual["status"] == "success"
    assert actual["cwd"] == os.fspath(TEST_DATA_PATH)
    if actual["result"] is not None:
        assert len(actual["result"]) == 0
    else:
        raise AssertionError("actual['result'] is None")


@pytest.fixture
def mock_send_run_data():
    with patch("unittestadapter.execution.send_run_data") as mock:
        yield mock


def test_single_ids_run(mock_send_run_data):
    """This test runs on a single test_id, therefore it should return
    a dict with a single key-value pair for the result.

    This single test passes so the outcome should be 'success'.
    """
    id = "discovery_simple.DiscoverySimple.test_one"
    os.environ["TEST_RUN_PIPE"] = "fake"
    actual: ExecutionPayloadDict = run_tests(
        os.fspath(TEST_DATA_PATH),
        [id],
        "discovery_simple*",
        None,
        1,
        None,
    )

    # Access the arguments
    args, _ = mock_send_run_data.call_args
    test_actual = args[0]  # first argument is the result

    assert test_actual
    actual_result: Optional[Dict[str, Dict[str, Optional[str]]]] = actual["result"]
    if actual_result is None:
        raise AssertionError("actual_result is None")
    else:
        if not isinstance(actual_result, Dict):
            raise AssertionError("actual_result is not a Dict")
        assert len(actual_result) == 1
        assert id in actual_result
        id_result = actual_result[id]
        assert id_result is not None
        assert "outcome" in id_result
        assert id_result["outcome"] == "success"


def test_subtest_run(mock_send_run_data) -> None:
    """This test runs on a the test_subtest which has a single method, test_even,
    that uses unittest subtest.

    The actual result of run should return a dict payload with 6 entry for the 6 subtests.
    """
    id = "test_subtest.NumbersTest.test_even"
    os.environ["TEST_RUN_PIPE"] = "fake"
    actual = run_tests(
        os.fspath(TEST_DATA_PATH),
        [id],
        "test_subtest.py",
        None,
        1,
        None,
    )
    subtests_ids = [
        "test_subtest.NumbersTest.test_even (i=0)",
        "test_subtest.NumbersTest.test_even (i=1)",
        "test_subtest.NumbersTest.test_even (i=2)",
        "test_subtest.NumbersTest.test_even (i=3)",
        "test_subtest.NumbersTest.test_even (i=4)",
        "test_subtest.NumbersTest.test_even (i=5)",
    ]
    assert actual
    assert all(item in actual for item in ("cwd", "status"))
    assert actual["status"] == "success"
    assert actual["cwd"] == os.fspath(TEST_DATA_PATH)
    assert actual["result"] is not None
    result = actual["result"]
    assert len(result) == 6
    for id in subtests_ids:
        assert id in result


@pytest.mark.parametrize(
    "test_ids, pattern, cwd, expected_outcome",
    [
        (
            [
                "test_add.TestAddFunction.test_add_negative_numbers",
                "test_add.TestAddFunction.test_add_positive_numbers",
            ],
            "test_add.py",
            os.fspath(TEST_DATA_PATH / "unittest_folder"),
            "success",
        ),
        (
            [
                "test_add.TestAddFunction.test_add_negative_numbers",
                "test_add.TestAddFunction.test_add_positive_numbers",
                "test_subtract.TestSubtractFunction.test_subtract_negative_numbers",
                "test_subtract.TestSubtractFunction.test_subtract_positive_numbers",
            ],
            "test*",
            os.fspath(TEST_DATA_PATH / "unittest_folder"),
            "success",
        ),
        (
            [
                "pattern_a_test.DiscoveryA.test_one_a",
                "pattern_a_test.DiscoveryA.test_two_a",
            ],
            "*test.py",
            os.fspath(TEST_DATA_PATH / "two_patterns"),
            "success",
        ),
        (
            [
                "test_pattern_b.DiscoveryB.test_one_b",
                "test_pattern_b.DiscoveryB.test_two_b",
            ],
            "test_*",
            os.fspath(TEST_DATA_PATH / "two_patterns"),
            "success",
        ),
        (
            [
                "file_one.CaseTwoFileOne.test_one",
                "file_one.CaseTwoFileOne.test_two",
                "folder.file_two.CaseTwoFileTwo.test_one",
                "folder.file_two.CaseTwoFileTwo.test_two",
            ],
            "*",
            os.fspath(TEST_DATA_PATH / "utils_nested_cases"),
            "success",
        ),
        (
            [
                "test_two_classes.ClassOne.test_one",
                "test_two_classes.ClassTwo.test_two",
            ],
            "test_two_classes.py",
            os.fspath(TEST_DATA_PATH),
            "success",
        ),
        (
            [
                "test_scene.TestMathOperations.test_operations(add)",
                "test_scene.TestMathOperations.test_operations(subtract)",
                "test_scene.TestMathOperations.test_operations(multiply)",
            ],
            "*",
            os.fspath(TEST_DATA_PATH / "test_scenarios" / "tests"),
            "success",
        ),
    ],
)
def test_multiple_ids_run(mock_send_run_data, test_ids, pattern, cwd, expected_outcome) -> None:
    """
    The following are all successful tests of different formats.

    # 1. Two tests with the `pattern` specified as a file
        # 2. Two test files in the same folder called `unittest_folder`
        # 3. A folder with two different test file patterns, this test gathers pattern `*test`
        # 4. A folder with two different test file patterns, this test gathers pattern `test_*`
        # 5. A nested structure where a test file is on the same level as a folder containing a test file
        # 6. Test file with two test classes

    All tests should have the outcome of `success`.
    """
    os.environ["TEST_RUN_PIPE"] = "fake"
    actual = run_tests(cwd, test_ids, pattern, None, 1, None)
    assert actual
    assert all(item in actual for item in ("cwd", "status"))
    assert actual["status"] == "success"
    assert actual["cwd"] == cwd
    assert actual["result"] is not None
    result = actual["result"]
    assert len(result) == len(test_ids)
    for test_id in test_ids:
        assert test_id in result
        id_result = result[test_id]
        assert id_result is not None
        assert "outcome" in id_result
        assert id_result["outcome"] == expected_outcome
    assert True


def test_failed_tests(mock_send_run_data):
    """This test runs on a single file `test_fail` with two tests that fail."""

    os.environ["TEST_RUN_PIPE"] = "fake"
    test_ids = [
        "test_fail_simple.RunFailSimple.test_one_fail",
        "test_fail_simple.RunFailSimple.test_two_fail",
    ]
    actual = run_tests(
        os.fspath(TEST_DATA_PATH),
        test_ids,
        "test_fail_simple*",
        None,
        1,
        None,
    )
    assert actual
    assert all(item in actual for item in ("cwd", "status"))
    assert actual["status"] == "success"
    assert actual["cwd"] == os.fspath(TEST_DATA_PATH)
    assert actual["result"] is not None
    result = actual["result"]
    assert len(result) == len(test_ids)
    for test_id in test_ids:
        assert test_id in result
        id_result = result[test_id]
        assert id_result is not None
        assert "outcome" in id_result
        assert id_result["outcome"] == "failure"
        assert "message" and "traceback" in id_result
        assert "2 not greater than 3" in str(id_result["message"]) or "1 == 1" in str(
            id_result["traceback"]
        )
    assert True


def test_unknown_id(mock_send_run_data):
    """This test runs on a unknown test_id, therefore it should return
    an error as the outcome as it attempts to find the given test.
    """
    os.environ["TEST_RUN_PIPE"] = "fake"
    test_ids = ["unknown_id"]
    actual = run_tests(
        os.fspath(TEST_DATA_PATH),
        test_ids,
        "test_fail_simple*",
        None,
        1,
        None,
    )
    assert actual
    assert all(item in actual for item in ("cwd", "status"))
    assert actual["status"] == "success"
    assert actual["cwd"] == os.fspath(TEST_DATA_PATH)
    assert actual["result"] is not None
    result = actual["result"]
    assert len(result) == len(test_ids)
    assert "unittest.loader._FailedTest.unknown_id" in result
    id_result = result["unittest.loader._FailedTest.unknown_id"]
    assert id_result is not None
    assert "outcome" in id_result
    assert id_result["outcome"] == "error"
    assert "message" and "traceback" in id_result


def test_incorrect_path():
    """This test runs on a non existent path, therefore it should return
    an error as the outcome as it attempts to find the given folder.
    """
    test_ids = ["unknown_id"]
    os.environ["TEST_RUN_PIPE"] = "fake"

    actual = run_tests(
        os.fspath(TEST_DATA_PATH / "unknown_folder"),
        test_ids,
        "test_fail_simple*",
        None,
        1,
        None,
    )
    assert actual
    assert all(item in actual for item in ("cwd", "status", "error"))
    assert actual["status"] == "error"
    assert actual["cwd"] == os.fspath(TEST_DATA_PATH / "unknown_folder")

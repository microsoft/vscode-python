# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os
import pathlib
from typing import List

import pytest
from unittestadapter.execution import parse_execution_cli_args, run_tests

TEST_DATA_PATH = pathlib.Path(__file__).parent / ".data"


@pytest.mark.parametrize(
    "args, expected",
    [
        (
            [
                "--port",
                "111",
                "--uuid",
                "fake-uuid",
                "--testids",
                "test_file.test_class.test_method",
            ],
            (111, "fake-uuid", ["test_file.test_class.test_method"]),
        ),
        (
            ["--port", "111", "--uuid", "fake-uuid", "--testids", ""],
            (111, "fake-uuid", [""]),
        ),
        (
            [
                "--port",
                "111",
                "--uuid",
                "fake-uuid",
                "--testids",
                "test_file.test_class.test_method",
                "-v",
                "-s",
            ],
            (111, "fake-uuid", ["test_file.test_class.test_method"]),
        ),
    ],
)
def test_parse_execution_cli_args(args: List[str], expected: List[str]) -> None:
    """The parse_execution_cli_args function should return values for the port, uuid, and testids arguments
    when passed as command-line options, and ignore unrecognized arguments.
    """
    actual = parse_execution_cli_args(args)
    assert actual == expected


def test_no_ids_run() -> None:
    """This test runs on an empty array of test_ids, therefore it should return
    an empty dict for the result.
    """
    start_dir: str = os.fspath(TEST_DATA_PATH)
    testids = []
    pattern = "discovery_simple*"
    actual = run_tests(start_dir, testids, pattern, None, "fake-uuid")
    assert actual
    assert all(item in actual for item in ("cwd", "status"))
    assert actual["status"] == "success"
    assert actual["cwd"] == os.fspath(TEST_DATA_PATH)
    if "result" in actual:
        assert len(actual["result"]) == 0
    else:
        raise AssertionError("actual['result'] is None")


def test_single_ids_run() -> None:
    """This test runs on a single test_id, therefore it should return
    a dict with a single key-value pair for the result.

    This single test passes so the outcome should be 'success'.
    """
    id = "discovery_simple.DiscoverySimple.test_one"
    actual = run_tests(
        os.fspath(TEST_DATA_PATH), [id], "discovery_simple*", None, "fake-uuid"
    )
    assert actual
    assert all(item in actual for item in ("cwd", "status"))
    assert actual["status"] == "success"
    assert actual["cwd"] == os.fspath(TEST_DATA_PATH)
    assert "result" in actual
    result = actual["result"]
    assert len(result) == 1
    assert id in result
    id_result = result[id]
    assert id_result is not None
    assert "outcome" in id_result
    assert id_result["outcome"] == "success"

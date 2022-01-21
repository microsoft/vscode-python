# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os
import pathlib

import pytest
from unittestadapter.discovery import (
    DEFAULT_PORT,
    discover_tests,
    parse_cli_args,
    parse_unittest_args,
)
from unittestadapter.utils import TestNodeTypeEnum

from .helpers import TEST_DATA_PATH, is_same_tree


@pytest.mark.parametrize(
    "args, expected",
    [
        (["--port", "6767", "--uuid", "some-uuid"], (6767, "some-uuid")),
        (["--foo", "something", "--bar", "another"], (int(DEFAULT_PORT), None)),
        (["--port", "4444", "--foo", "something", "--port", "9999"], (9999, None)),
        (
            ["--uuid", "first-uuid", "--bar", "other", "--uuid", "second-uuid"],
            (int(DEFAULT_PORT), "second-uuid"),
        ),
    ],
)
def test_parse_cli_args(args, expected) -> None:
    """The parse_cli_args function should parse and return the port and uuid passed as command-line options.

    If there were no --port or --uuid command-line option, it should return default values).
    If there are multiple options, the last one wins.
    """
    actual = parse_cli_args(args)

    assert expected == actual


@pytest.mark.parametrize(
    "args, expected",
    [
        (
            ["-s", "something", "-p", "other*", "-t", "else"],
            ("something", "other*", "else"),
        ),
        (
            [
                "--start-directory",
                "foo",
                "--pattern",
                "bar*",
                "--top-level-directory",
                "baz",
            ],
            ("foo", "bar*", "baz"),
        ),
        (
            ["--foo", "something"],
            (".", "test*.py", None),
        ),
    ],
)
def test_parse_unittest_args(args, expected) -> None:
    """The parse_unittest_args function should return values for the start_dir, pattern, and top_level_dir arguments
    when passed as command-line options, and ignore unrecognized arguments.
    """
    actual = parse_unittest_args(args)

    assert actual == expected


def test_simple_discovery() -> None:
    """The discover_tests function should return a dictionary with a "success" status, a uuid, no errors, and a test tree
    if unittest discovery was performed successfully.
    """
    start_dir = os.fsdecode(TEST_DATA_PATH)
    pattern = "discovery_simple*"
    file_path = os.fsdecode(pathlib.PurePath(TEST_DATA_PATH / "discovery_simple.py"))

    expected = {
        "path": start_dir,
        "type_": TestNodeTypeEnum.folder,
        "name": ".data",
        "children": [
            {
                "name": "discovery_simple.py",
                "type_": TestNodeTypeEnum.file,
                "path": file_path,
                "children": [
                    {
                        "name": "DiscoverySimple",
                        "path": file_path,
                        "type_": TestNodeTypeEnum.class_,
                        "children": [
                            {
                                "id_": "discovery_simple.DiscoverySimple.test_one",
                                "name": "test_one",
                                "path": file_path,
                                "type_": TestNodeTypeEnum.test,
                                "lineno": "14",
                            },
                            {
                                "id_": "discovery_simple.DiscoverySimple.test_two",
                                "name": "test_two",
                                "path": file_path,
                                "type_": TestNodeTypeEnum.test,
                                "lineno": "17",
                            },
                        ],
                    }
                ],
            }
        ],
    }

    uuid = "some-uuid"
    actual = discover_tests(start_dir, pattern, None, uuid)

    assert actual["status"] == "success"
    assert actual["uuid"] == uuid
    assert is_same_tree(actual.get("tests"), expected)
    assert "errors" not in actual


def test_empty_discovery() -> None:
    """The discover_tests function should return a dictionary with a "success" status, a uuid, no errors, and no test tree
    if unittest discovery was performed successfully but no tests were found.
    """
    start_dir = os.fsdecode(TEST_DATA_PATH)
    pattern = "discovery_empty*"

    uuid = "some-uuid"
    actual = discover_tests(start_dir, pattern, None, uuid)

    assert actual["status"] == "success"
    assert actual["uuid"] == uuid
    assert "tests" not in actual
    assert "errors" not in actual


def test_error_discovery() -> None:
    """The discover_tests function should return a dictionary with an "error" status, a uuid, the discovered tests, and a list of errors
    if unittest discovery failed at some point.
    """
    # Discover tests in .data/discovery_error/.
    start_path = pathlib.PurePath(TEST_DATA_PATH / "discovery_error")
    start_dir = os.fsdecode(start_path)
    pattern = "file*"

    file_path = os.fsdecode(start_path / "file_two.py")

    expected = {
        "path": start_dir,
        "type_": TestNodeTypeEnum.folder,
        "name": "discovery_error",
        "children": [
            {
                "name": "file_two.py",
                "type_": TestNodeTypeEnum.file,
                "path": file_path,
                "children": [
                    {
                        "name": "DiscoveryErrorTwo",
                        "path": file_path,
                        "type_": TestNodeTypeEnum.class_,
                        "children": [
                            {
                                "id_": "file_two.DiscoveryErrorTwo.test_one",
                                "name": "test_one",
                                "path": file_path,
                                "type_": TestNodeTypeEnum.test,
                                "lineno": "14",
                            },
                            {
                                "id_": "file_two.DiscoveryErrorTwo.test_two",
                                "name": "test_two",
                                "path": file_path,
                                "type_": TestNodeTypeEnum.test,
                                "lineno": "17",
                            },
                        ],
                    }
                ],
            }
        ],
    }

    uuid = "some-uuid"
    actual = discover_tests(start_dir, pattern, None, uuid)

    assert actual["status"] == "error"
    assert actual["uuid"] == uuid
    assert is_same_tree(expected, actual.get("tests"))
    assert len(actual.get("errors", [])) == 1

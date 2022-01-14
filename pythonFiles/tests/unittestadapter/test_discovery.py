# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import pathlib

import pytest

from unittestadapter.discovery import (
    DEFAULT_PORT,
    discover_tests,
    parse_port,
    parse_unittest_args,
)
from unittestadapter.utils import TestNodeTypeEnum

from .helpers import TEST_DATA_PATH, is_same_tree


@pytest.mark.parametrize(
    "args, expected",
    [
        ([("--port", 9999)], 9999),
        ([("--foo", "something"), ("--bar", "another")], DEFAULT_PORT),
    ],
)
def test_parse_port_option(args, expected) -> None:
    """The parse_port function should parse and return the port passed as a command-line option.

    If there was no --port command-line option, it should return a default port value.
    """
    actual = parse_port(args)

    assert expected == actual


@pytest.mark.parametrize(
    "args, expected",
    [
        (
            [
                ("-s", "foo"),
                ("-p", "bar*"),
                ("-t", "baz"),
            ],
            ("foo", "bar*", "baz"),
        ),
        (
            [
                ("--start-directory", "foo"),
                ("--pattern", "bar*"),
                ("--top-level-directory", "baz"),
            ],
            ("foo", "bar*", "baz"),
        ),
        (
            [
                ("--foo", "something"),
            ],
            (".", "test*.py", None),
        ),
    ],
)
def test_parse_short_unittest_args(args, expected) -> None:
    """The parse_unittest_args function should return values for the start_dir, pattern, and top_level_dir arguments
    when passed as command-line options, and ignore unrecognized arguments.
    """
    actual = parse_unittest_args(args)

    assert actual == expected


def test_simple_discovery() -> None:
    """The discover_tests function should return a dictionary with a "success" status, no errors, and a test tree
    if unittest discovery was performed successfully.
    """
    start_dir = TEST_DATA_PATH.__str__()
    pattern = "discovery_simple*"
    file_path = pathlib.PurePath(TEST_DATA_PATH, "discovery_simple.py").__str__()

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

    actual = discover_tests(start_dir, pattern, None)

    assert actual["status"] == "success"
    assert is_same_tree(actual["tests"], expected)
    assert "errors" not in actual


def test_empty_discovery() -> None:
    """The discover_tests function should return a dictionary with a "success" status, no errors, and no test tree
    if unittest discovery was performed successfully but no tests were found.
    """
    start_dir = TEST_DATA_PATH.__str__()
    pattern = "discovery_empty*"

    actual = discover_tests(start_dir, pattern, None)

    assert actual["status"] == "success"
    assert "tests" not in actual
    assert "errors" not in actual


def test_error_discovery() -> None:
    """The discover_tests function should return a dictionary with an "error" status, the discovered tests, and a list of errors
    if unittest discovery failed at some point.
    """
    # Discover tests in .data/discovery_error/.
    start_dir = pathlib.PurePath(TEST_DATA_PATH, "discovery_error").__str__()
    pattern = "file*"

    file_path = pathlib.PurePath(start_dir, "file_two.py").__str__()

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

    actual = discover_tests(start_dir, pattern, None)

    assert actual["status"] == "error"
    assert is_same_tree(expected, actual["tests"])
    assert len(actual["errors"]) == 1

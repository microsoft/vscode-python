# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

from pathlib import PurePath

from unittestadapter.discovery import (
    DEFAULT_PORT,
    discover_tests,
    parse_port,
    parse_unittest_args,
)
from unittestadapter.utils import TestNodeTypeEnum

from . import TEST_DATA_PATH, is_same_tree


def test_parse_port_option() -> None:
    """
    The parse_port function should parse and return the port passed as a command-line option.
    """

    expected = 9999
    args = [("--port", expected)]

    actual = parse_port(args)

    assert expected == actual


def test_parse_no_port_option() -> None:
    """
    The parse_port function should return a default port value if there was no --port command-line option.
    """

    args = [("--foo", "something"), ("--bar", "another")]

    actual = parse_port(args)

    assert DEFAULT_PORT == actual


def test_parse_short_unittest_args() -> None:
    """
    The parse_unittest_args function should return the values for the start_dir, pattern, and top_level_dir arguments
    when passed as command-line options with their shorthand form.
    """

    expected_start_dir = "foo"
    expected_pattern = "bar*"
    expected_top_level_dir = "baz"
    args = [
        ("-s", expected_start_dir),
        ("-p", expected_pattern),
        ("-t", expected_top_level_dir),
    ]

    actual_start_dir, actual_pattern, actual_top_level_dir = parse_unittest_args(args)

    assert expected_start_dir == actual_start_dir
    assert expected_pattern == actual_pattern
    assert expected_top_level_dir == actual_top_level_dir


def test_parse_long_unittest_args() -> None:
    """
    The parse_unittest_args function should return the values for the start_dir, pattern, and top_level_dir arguments
    when passed as command-line options with their long form.
    """

    expected_start_dir = "foo"
    expected_pattern = "bar*"
    expected_top_level_dir = "baz"
    args = [
        ("--start-directory", expected_start_dir),
        ("--pattern", expected_pattern),
        ("--top-level-directory", expected_top_level_dir),
    ]

    actual_start_dir, actual_pattern, actual_top_level_dir = parse_unittest_args(args)

    assert expected_start_dir == actual_start_dir
    assert expected_pattern == actual_pattern
    assert expected_top_level_dir == actual_top_level_dir


def test_parse_no_unittest_args() -> None:
    """
    The parse_unittest_args function should return default values for the start_dir, pattern, and top_level_dir arguments
    if they were not passed as command-line options, and ignore unrecognized arguments.
    """

    expected_start_dir = "."
    expected_pattern = "test*.py"
    expected_top_level_dir = None
    args = [
        ("--foo", "something"),
    ]

    actual_start_dir, actual_pattern, actual_top_level_dir = parse_unittest_args(args)

    assert expected_start_dir == actual_start_dir
    assert expected_pattern == actual_pattern
    assert expected_top_level_dir == actual_top_level_dir


def test_simple_discovery() -> None:
    """
    The discover_tests function should return a dictionary with a "success" status, no errors, and a test tree
    if unittest discovery was performed successfully.
    """

    start_dir = TEST_DATA_PATH.__str__()
    pattern = "discovery_simple*"
    file_path = PurePath(TEST_DATA_PATH, "discovery_simple.py").__str__()

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
    """
    The discover_tests function should return a dictionary with a "success" status, no errors, and no test tree
    if unittest discovery was performed successfully but no tests were found.
    """

    start_dir = TEST_DATA_PATH.__str__()
    pattern = "discovery_empty*"

    actual = discover_tests(start_dir, pattern, None)

    assert actual["status"] == "success"
    assert "tests" not in actual
    assert "errors" not in actual


def test_error_discovery() -> None:
    """
    The discover_tests function should return a dictionary with an "error" status, the discovered tests, and a list of errors
    if unittest discovery failed at some point.
    """

    # Discover tests in .data/discovery_error/
    start_dir = PurePath(TEST_DATA_PATH, "discovery_error").__str__()
    pattern = "file*"

    file_path = PurePath(start_dir, "file_two.py").__str__()

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
                                "id_": "discovery_error.DiscoveryErrorTwo.test_one",
                                "name": "test_one",
                                "path": file_path,
                                "type_": TestNodeTypeEnum.test,
                                "lineno": "14",
                            },
                            {
                                "id_": "discovery_error.DiscoveryErrorTwo.test_two",
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
    is_same_tree(expected, actual["tests"])
    assert len(actual["errors"]) == 1

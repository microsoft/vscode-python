# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import sys
import pytest

import unittest
from pathlib import PurePath

from unittestadapter.utils import (
    build_test_tree,
    get_child_node,
    get_test_case,
    TestNode,
    TestNodeTypeEnum,
)

from . import is_same_tree, TEST_DATA_PATH

if sys.version_info < (3):
    pytest.skip("Skip unittest test utils tests on Python 2.7", allow_module_level=True)


def test_simple_test_cases() -> None:
    """
    The get_test_case fuction should return tests from the test suite.
    """

    expected = [
        "utils_simple_cases.CaseOne.test_one",
        "utils_simple_cases.CaseOne.test_two",
    ]
    actual = []

    # Discover tests in .data/utils_simple_cases.py
    start_dir = TEST_DATA_PATH.__str__()
    pattern = "utils_simple_cases*"

    loader = unittest.TestLoader()
    suite = loader.discover(start_dir, pattern)

    # Iterate on get_test_case and save the test id
    for test in get_test_case(suite):
        actual.append(test.id())

    assert expected == actual


def test_nested_test_cases() -> None:
    """
    The get_test_case fuction should return tests from all test suites,
    even those in subfolders.
    """

    expected = [
        "file_one.CaseTwoFileOne.test_one",
        "file_one.CaseTwoFileOne.test_two",
        "folder.file_two.CaseTwoFileTwo.test_one",
        "folder.file_two.CaseTwoFileTwo.test_two",
    ]
    actual = []

    # Discover tests in .data/utils_nested_cases/
    start_dir = PurePath(TEST_DATA_PATH, "utils_nested_cases").__str__()
    pattern = "file*"

    loader = unittest.TestLoader()
    suite = loader.discover(start_dir, pattern)

    # Iterate on get_test_case and save the test id
    for test in get_test_case(suite):
        actual.append(test.id())

    assert expected == actual


def test_get_existing_child_node() -> None:
    """
    The get_child_node fuction should return the child node of a test tree if it exists.
    """

    tree = {
        "name": "root",
        "path": "foo",
        "type_": "folder",
        "children": [
            {
                "name": "childOne",
                "path": "child/one",
                "type_": "folder",
                "children": [
                    {
                        "name": "nestedOne",
                        "path": "nested/one",
                        "type_": "folder",
                        "children": [],
                    },
                    {
                        "name": "nestedTwo",
                        "path": "nested/two",
                        "type_": "folder",
                        "children": [],
                    },
                ],
            },
            {
                "name": "childTwo",
                "path": "child/two",
                "type_": "folder",
                "children": [],
            },
        ],
    }

    initial_len = len(tree["children"])
    result = get_child_node("childTwo", "child/two", "folder", tree)
    post_len = len(tree["children"])

    assert result is not None
    assert initial_len == post_len


def test_no_existing_child_node() -> None:
    """
    The get_child_node fuction should add a child node to a test tree and return it if it does not exist.
    """

    tree: TestNode = {
        "name": "root",
        "path": "foo",
        "type_": "folder",
        "children": [
            {
                "name": "childOne",
                "path": "child/one",
                "type_": "folder",
                "children": [
                    {
                        "name": "nestedOne",
                        "path": "nested/one",
                        "type_": "folder",
                        "children": [],
                    },
                    {
                        "name": "nestedTwo",
                        "path": "nested/two",
                        "type_": "folder",
                        "children": [],
                    },
                ],
            },
            {
                "name": "childTwo",
                "path": "child/two",
                "type_": "folder",
                "children": [],
            },
        ],
    }

    initial_len = len(tree["children"])
    result = get_child_node("childThree", "child/three", "folder", tree)
    post_len = len(tree["children"])
    last_child = tree["children"][-1]

    assert result is not None
    assert last_child["name"] == "childThree"
    assert initial_len < post_len


def test_build_simple_tree() -> None:
    """
    The build_test_tree function should build and return a test tree from discovered test suites, and an empty list of errors if there are none in the discovered data.
    """

    # Discovery tests in utils_simple_tree.py
    start_dir = TEST_DATA_PATH.__str__()
    pattern = "utils_simple_tree*"
    file_path = PurePath(TEST_DATA_PATH, "utils_simple_tree.py").__str__()

    expected: TestNode = {
        "path": start_dir,
        "type_": TestNodeTypeEnum.folder,
        "name": ".data",
        "children": [
            {
                "name": "utils_simple_tree.py",
                "type_": TestNodeTypeEnum.file,
                "path": file_path,
                "children": [
                    {
                        "name": "TreeOne",
                        "path": file_path,
                        "type_": TestNodeTypeEnum.class_,
                        "children": [
                            {
                                "id_": "utils_simple_tree.TreeOne.test_one",
                                "name": "test_one",
                                "path": file_path,
                                "type_": TestNodeTypeEnum.test,
                                "lineno": "13",
                            },
                            {
                                "id_": "utils_simple_tree.TreeOne.test_two",
                                "name": "test_two",
                                "path": file_path,
                                "type_": TestNodeTypeEnum.test,
                                "lineno": "16",
                            },
                        ],
                    }
                ],
            }
        ],
    }

    loader = unittest.TestLoader()
    suite = loader.discover(start_dir, pattern)
    tests, errors = build_test_tree(suite, start_dir)

    assert is_same_tree(expected, tests)
    assert len(errors) == 0


def test_build_empty_tree() -> None:
    """
    The build_test_tree function should return None if there are no discovered test suites, and an empty list of errors if there are none in the discovered data
    """

    start_dir = TEST_DATA_PATH.__str__()
    pattern = "does_not_exist*"

    expected = None

    loader = unittest.TestLoader()
    suite = loader.discover(start_dir, pattern)
    tests, errors = build_test_tree(suite, start_dir)

    # Build tree
    assert expected == tests
    assert len(errors) == 0

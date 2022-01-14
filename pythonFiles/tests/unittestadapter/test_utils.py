# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os
import pathlib
import unittest

import pytest

from unittestadapter.utils import (
    TestNode,
    TestNodeTypeEnum,
    build_test_tree,
    get_child_node,
    get_test_case,
)

from .helpers import TEST_DATA_PATH, is_same_tree


@pytest.mark.parametrize(
    "directory, pattern, expected",
    [
        (
            ".",
            "utils_simple_cases*",
            [
                "utils_simple_cases.CaseOne.test_one",
                "utils_simple_cases.CaseOne.test_two",
            ],
        ),
        (
            "utils_nested_cases",
            "file*",
            [
                "file_one.CaseTwoFileOne.test_one",
                "file_one.CaseTwoFileOne.test_two",
                "folder.file_two.CaseTwoFileTwo.test_one",
                "folder.file_two.CaseTwoFileTwo.test_two",
            ],
        ),
    ],
)
def test_simple_test_cases(directory, pattern, expected) -> None:
    """The get_test_case fuction should return tests from all test suites."""

    actual = []

    # Discover tests in .data/<directory>.
    start_dir = os.fsdecode(pathlib.PurePath(TEST_DATA_PATH, directory))

    loader = unittest.TestLoader()
    suite = loader.discover(start_dir, pattern)

    # Iterate on get_test_case and save the test id.
    for test in get_test_case(suite):
        actual.append(test.id())

    assert expected == actual


def test_get_existing_child_node() -> None:
    """The get_child_node fuction should return the child node of a test tree if it exists."""

    tree: TestNode = {
        "name": "root",
        "path": "foo",
        "type_": TestNodeTypeEnum.folder,
        "children": [
            {
                "name": "childOne",
                "path": "child/one",
                "type_": TestNodeTypeEnum.folder,
                "children": [
                    {
                        "name": "nestedOne",
                        "path": "nested/one",
                        "type_": TestNodeTypeEnum.folder,
                        "children": [],
                    },
                    {
                        "name": "nestedTwo",
                        "path": "nested/two",
                        "type_": TestNodeTypeEnum.folder,
                        "children": [],
                    },
                ],
            },
            {
                "name": "childTwo",
                "path": "child/two",
                "type_": TestNodeTypeEnum.folder,
                "children": [],
            },
        ],
    }

    initial_len = len(tree["children"])
    result = get_child_node("childTwo", "child/two", TestNodeTypeEnum.folder, tree)
    post_len = len(tree["children"])

    assert result is not None
    assert initial_len == post_len


def test_no_existing_child_node() -> None:
    """The get_child_node fuction should add a child node to a test tree and return it if it does not exist."""

    tree: TestNode = {
        "name": "root",
        "path": "foo",
        "type_": TestNodeTypeEnum.folder,
        "children": [
            {
                "name": "childOne",
                "path": "child/one",
                "type_": TestNodeTypeEnum.folder,
                "children": [
                    {
                        "name": "nestedOne",
                        "path": "nested/one",
                        "type_": TestNodeTypeEnum.folder,
                        "children": [],
                    },
                    {
                        "name": "nestedTwo",
                        "path": "nested/two",
                        "type_": TestNodeTypeEnum.folder,
                        "children": [],
                    },
                ],
            },
            {
                "name": "childTwo",
                "path": "child/two",
                "type_": TestNodeTypeEnum.folder,
                "children": [],
            },
        ],
    }

    initial_len = len(tree["children"])
    result = get_child_node("childThree", "child/three", TestNodeTypeEnum.folder, tree)
    post_len = len(tree["children"])
    last_child = tree["children"][-1]

    assert result is not None
    assert last_child["name"] == "childThree"
    assert initial_len < post_len


def test_build_simple_tree() -> None:
    """The build_test_tree function should build and return a test tree from discovered test suites, and an empty list of errors if there are none in the discovered data."""

    # Discovery tests in utils_simple_tree.py.
    start_dir = os.fsdecode(TEST_DATA_PATH)
    pattern = "utils_simple_tree*"
    file_path = os.fsdecode(pathlib.PurePath(TEST_DATA_PATH, "utils_simple_tree.py"))

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
    assert not errors


def test_build_empty_tree() -> None:
    """The build_test_tree function should return None if there are no discovered test suites, and an empty list of errors if there are none in the discovered data."""

    start_dir = os.fsdecode(TEST_DATA_PATH)
    pattern = "does_not_exist*"

    expected = None

    loader = unittest.TestLoader()
    suite = loader.discover(start_dir, pattern)
    tests, errors = build_test_tree(suite, start_dir)

    assert expected == tests
    assert not errors

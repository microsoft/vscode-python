# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import unittest

from os import path
from unittestadapter.utils import (
    build_test_tree,
    get_child_node,
    get_test_case,
    TestNode,
    TestNodeTypeEnum,
)


def test_simple_test_cases() -> None:
    expected = ["utils_case_one.CaseOne.test_one", "utils_case_one.CaseOne.test_two"]
    actual = []

    # Discover tests in .data/utils_case_one.py
    start_dir = path.join(path.dirname(__file__), ".data")
    pattern = "utils_case_one*"

    loader = unittest.TestLoader()
    suite = loader.discover(start_dir, pattern)

    # Iterate on get_test_case and save the test id
    for test in get_test_case(suite):
        actual.append(test.id())

    assert expected == actual


def test_nested_test_cases() -> None:
    expected = [
        "file_one.CaseTwoFileOne.test_one",
        "file_one.CaseTwoFileOne.test_two",
        "file_two.CaseTwoFileTwo.test_one",
        "file_two.CaseTwoFileTwo.test_two",
    ]
    actual = []

    # Discover tests in .data/utils_case_two/
    start_dir = path.join(path.dirname(__file__), ".data", "utils_case_two")
    pattern = "file*"

    loader = unittest.TestLoader()
    suite = loader.discover(start_dir, pattern)

    # Iterate on get_test_case and save the test id
    for test in get_test_case(suite):
        actual.append(test.id())

    assert expected == actual


def test_get_existing_child_node() -> None:
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


# Helper function to test if two test trees are the same.
def is_same_tree(tree1, tree2) -> bool:
    # Compare the root
    if (
        tree1["path"] != tree2["path"]
        or tree1["name"] != tree2["name"]
        or tree1["type_"] != tree2["type_"]
    ):
        return False

    # Compare child test nodes if they exist, otherwise compare test items.
    if "children" in tree1 and "children" in tree2:
        children1 = tree1["children"]
        children2 = tree2["children"]

        # Compare test nodes
        if len(children1) != len(children2):
            return False
        else:
            result = True
            index = 0
            while index < len(children1) and result == True:
                result = result and is_same_tree(children1[index], children2[index])
                index = index + 1
            return result
    elif "id_" in tree1 and "id_" in tree2:
        # Compare test items
        return tree1["id_"] == tree2["id_"] and tree1["lineno"] == tree2["lineno"]

    return False


def test_build_simple_tree() -> None:
    # Discovery tests in utils_tree_one.py
    start_dir = path.join(path.dirname(__file__), ".data")
    pattern = "utils_tree_one*"

    expected: TestNode = {
        "path": start_dir,
        "type_": TestNodeTypeEnum.folder,
        "name": ".data",
        "children": [
            {
                "name": "utils_tree_one.py",
                "type_": TestNodeTypeEnum.file,
                "path": path.join(start_dir, "utils_tree_one.py"),
                "children": [
                    {
                        "name": "TreeOne",
                        "path": path.join(start_dir, "utils_tree_one.py"),
                        "type_": TestNodeTypeEnum.class_,
                        "children": [
                            {
                                "id_": "utils_tree_one.TreeOne.test_one",
                                "name": "test_one",
                                "path": path.join(start_dir, "utils_tree_one.py"),
                                "type_": TestNodeTypeEnum.test,
                                "lineno": "13",
                            },
                            {
                                "id_": "utils_tree_one.TreeOne.test_two",
                                "name": "test_two",
                                "path": path.join(start_dir, "utils_tree_one.py"),
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

    # Build tree
    assert is_same_tree(expected, tests)
    assert len(errors) == 0


def test_build_empty_tree() -> None:
    start_dir = path.join(path.dirname(__file__), ".data")
    pattern = "does_not_exist*"

    expected = None

    loader = unittest.TestLoader()
    suite = loader.discover(start_dir, pattern)
    tests, errors = build_test_tree(suite, start_dir)

    # Build tree
    assert expected == tests
    assert len(errors) == 0

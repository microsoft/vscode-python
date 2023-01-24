# -*- coding: utf-8 -*-

# this file taken from 71636e91930c9905604577db7e1e9a1cffa05a6e
# multi class actually working on Nov 9th

import enum
import json
import os
import pathlib
import sys
from dbm.ndbm import library
from typing import KeysView, List, Literal, Optional, Tuple, TypedDict, Union
from unittest import TestCase

import pytest


# Inherit from str so it's JSON serializable.
class TestNodeTypeEnum(str, enum.Enum):
    class_ = "class"
    file = "file"
    folder = "folder"
    test = "test"


class TestData(TypedDict):
    name: str
    path: str
    type_: TestNodeTypeEnum
    id_: str


class TestItem(TestData):
    lineno: str
    runID: str


class TestNode(TestData):
    children: "List[TestNode | TestItem]"


# Add the path to pythonFiles to sys.path to find testing_tools.socket_manager.
PYTHON_FILES = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PYTHON_FILES)

# Add the lib path to sys.path to find the typing_extensions module.
sys.path.insert(0, os.path.join(PYTHON_FILES, "lib", "python"))
from testing_tools import socket_manager
from typing_extensions import NotRequired

DEFAULT_PORT = "45454"

# session
#   test Case

# modules folders1/folders2  (can be in classes)
#   test cases

# module
# class
# test case


def pytest_collection_finish(session):
    node, error = build_test_tree(session)
    cwd = os.getcwd()
    # add error check
    sendPost(cwd, node)


def build_test_tree(session) -> Tuple[Union[TestNode, None], List[str]]:
    errors: List[str] = []  # TODO: how do I check for errors
    session_test_node = createSessionTestNode(session)
    testNode_file_dict: dict[
        pytest.Module, TestNode
    ] = dict()  # a dictionary of all files in the session
    session_children_dict: dict[
        str, TestNode
    ] = dict()  # a dictionary of all direct children of the session
    testNode_class_dict: dict[
        str, TestNode
    ] = dict()  # a dictionary of all direct children of the session
    # iterate through all the test items in the session
    for test_case in session.items:
        testNode_test = createTestItem(test_case)
        # if the parent object file doesn't already exist
        if type(test_case.parent) == pytest.Module:
            test_case_parent_node = testNode_file_dict.setdefault(
                test_case.parent, createFileTestNode(test_case.parent)
            )
            test_case_parent_node["children"].append(testNode_test)
        else:
            # this means its a unittest class
            # create class
            test_class_node = testNode_class_dict.setdefault(
                test_case.parent.name,
                createClassTestNode(test_case.parent),
            )
            test_class_node["children"].append(testNode_test)
            parent_module = test_case.parent.parent
            # create file that wraps class
            test_file_node = testNode_file_dict.setdefault(
                parent_module, createFileTestNode(parent_module)
            )
            if test_class_node not in test_file_node["children"]:
                test_file_node["children"].append(test_class_node)

    created_filesfolder_dict: dict[str, TestNode] = {}
    for file_module, testNode_file in testNode_file_dict.items():
        name = str(file_module.name)
        prev_folder_test_node: TestNode = testNode_file
        if "/" in name:
            # it is a nested folder structure and so new objects need to be created
            nested_folder_list = name.split("/")
            path_iterator = (
                str(session.path)
                + "/"
                + "/".join(
                    nested_folder_list[0:-1]
                )  # check to see if windows style (more fancy stuff path lib if windows or posix via API in os module)
            )
            for i in range(len(nested_folder_list) - 2, -1, -1):  # reverse and slice
                folderName = nested_folder_list[i]
                test_folder_node = created_filesfolder_dict.setdefault(
                    folderName, createFolderTestNode(folderName, path_iterator)
                )
                if prev_folder_test_node not in test_folder_node["children"]:
                    test_folder_node["children"].append(prev_folder_test_node)
                # TestNode_test before
                # increase iteration through path
                prev_folder_test_node = test_folder_node
                path_iterator = str(session.path) + "/".join(nested_folder_list[0:i])

        # the final folder we get to is the highest folder in the path and therefore we add this as a child to the session
        if (prev_folder_test_node is not None) and (
            prev_folder_test_node.get("id_") not in session_children_dict
        ):
            session_children_dict[
                prev_folder_test_node.get("id_")
            ] = prev_folder_test_node
    session_test_node["children"] = list(session_children_dict.values())
    return session_test_node, errors


def createTestItem(test_case) -> TestItem:
    return {
        "name": test_case.name,
        "path": str(test_case.path),
        "lineno": test_case.location[1] + 1,
        "type_": TestNodeTypeEnum.test,
        "id_": str(test_case.nodeid),
        "runID": test_case.nodeid,  # can I use this two times?
    }


def createSessionTestNode(session) -> TestNode:
    return {
        "name": session.name,
        "path": str(session.path),
        "type_": TestNodeTypeEnum.folder,  # check if this is a file or a folder
        "children": [],
        "id_": str(session.path),
    }


def createClassTestNode(class_module) -> TestNode:
    return {
        "name": class_module.name,
        "path": str(class_module.path),
        "type_": TestNodeTypeEnum.class_,
        "children": [],
        "id_": str(class_module.nodeid),
    }


def createFileTestNode(file_module) -> TestNode:
    return {
        "name": str(file_module.path.name),  # check
        "path": str(file_module.path),
        "type_": TestNodeTypeEnum.file,
        "id_": str(file_module.path),
        "children": [],
    }


def createFolderTestNode(folderName, path_iterator) -> TestNode:
    return {
        "name": folderName,
        "path": str(path_iterator),
        "type_": TestNodeTypeEnum.folder,  # check if this is a file or a folder
        "id_": str(path_iterator),
        "children": [],
    }


class PayloadDict(TypedDict):
    cwd: str
    status: Literal["success", "error"]
    tests: NotRequired[TestNode]
    errors: NotRequired[List[str]]


def sendPost(cwd, tests):
    payload: PayloadDict = {"cwd": cwd, "status": "success", "tests": tests}
    testPort = os.getenv("TEST_PORT", 45454)
    testuuid = os.getenv("TEST_UUID")
    addr = ("localhost", int(testPort))
    print("sending post", addr, cwd)
    # socket_manager.send_post("Hello from pytest")  # type: ignore
    with socket_manager.SocketManager(addr) as s:
        data = json.dumps(payload)
        request = f"""POST / HTTP/1.1
Host: localhost:{testPort}
Content-Length: {len(data)}
Content-Type: application/json
Request-uuid: {testuuid}
{data}"""
        result = s.socket.sendall(request.encode("utf-8"))  # type: ignore

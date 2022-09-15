# -*- coding: utf-8 -*-
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
            if test_case.parent not in testNode_file_dict:
                testNode_file_dict[test_case.parent] = createFileTestNode(
                    test_case.parent
                )
            testNode_file_dict[test_case.parent].get("children").append(
                testNode_test
            )  # use set default
        else:
            # this means its a unittest class
            # create class
            testNode_class = accessOrCreateGeneral(
                test_case.parent.name, testNode_class_dict, test_case.parent.fspath
            )
            testNode_class["children"].append(testNode_test)
            parent_module = test_case.parent.parent
            # create file that wraps class
            if parent_module not in testNode_file_dict.keys():
                testNode_file_dict[parent_module] = createFileTestNode(parent_module)
            testNode_file_dict[parent_module].get("children").append(testNode_class)

    created_filesfolder_dict: dict[str, TestNode] = {}
    for file_module, testNode_file in testNode_file_dict.items():
        name = str(file_module.name)
        prev_folder_test_node: TestNode = testNode_file
        if "/" in name:
            # it is a nested folder structure and so new objects need to be created
            nested_folder_list = name.split("/")
            path_iterator = (
                str(session.fspath)
                + "/"
                + "/".join(
                    nested_folder_list[0:-1]
                )  # check to see if windows style (more fancy stuff path lib if windows or posix via API in os module)
            )
            for i in range(len(nested_folder_list) - 2, -1, -1):  # reverse and slice
                folderName = nested_folder_list[i]
                folder_test_node = accessOrCreateGeneral(
                    folderName,
                    created_filesfolder_dict,
                    path_iterator,
                )
                folder_test_node["children"].append(prev_folder_test_node)
                # increase iteration through path
                prev_folder_test_node = folder_test_node
                path_iterator = str(session.fspath) + "/".join(nested_folder_list[0:i])

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
        "path": str(test_case.fspath),
        "lineno": test_case.location[1] + 1,
        "type_": TestNodeTypeEnum.test,
        "id_": str(test_case.nodeid),
        "runID": test_case.nodeid,  # can I use this two times?
    }


def createSessionTestNode(session) -> TestNode:
    return {
        "name": session.name,
        "path": str(session.fspath),
        "type_": TestNodeTypeEnum.folder,  # check if this is a file or a folder
        "children": [],
        "id_": str(session.fspath),
    }


def createClassTestNode(class_module_name, class_module_path) -> TestNode:
    return {
        "name": class_module_name,
        "path": str(class_module_path),
        "type_": TestNodeTypeEnum.class_,
        "children": [],
        "id_": str(class_module_path),
    }


def createFileTestNode(file_module) -> TestNode:
    return {
        "name": str(file_module.fspath.basename),
        "path": str(file_module.fspath),
        "type_": TestNodeTypeEnum.file,
        "id_": str(file_module.fspath),
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


def accessOrCreateGeneral(test_node_name, test_node_dict, test_node_path) -> TestNode:
    if test_node_name in test_node_dict.keys():  # exists in the dictionary
        return test_node_dict[test_node_name]
    else:
        # create new
        temp = createFolderTestNode(test_node_name, test_node_path)
        test_node_dict[test_node_name] = temp
        return temp


# def accessOrCreateClass(class_module, testNode_class_dict) -> TestNode:
#     if class_module.name in testNode_class_dict.keys():  # exists in the dictionary
#         return testNode_class_dict[class_module.name]
#     else:
#         # create new
#         temp = createClassTestNode(class_module.name, class_module.fspath)
#         testNode_class_dict[class_module.name] = temp
#         return temp


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

# -*- coding: utf-8 -*-
import enum
import json
import os
import pathlib
import sys
from dbm.ndbm import library
from typing import KeysView, List, Literal, Optional, Tuple, TypedDict, Union

import debugpy
import pytest

debugpy.connect(5678)

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

from testing_tools import socket_manager

# Add the lib path to sys.path to find the typing_extensions module.
sys.path.insert(0, os.path.join(PYTHON_FILES, "lib", "python"))
from testing_tools import socket_manager
from typing_extensions import NotRequired

DEFAULT_PORT = "45454"

# session
#   test Case

# modules folders1/folders2  (can be in classes)
#   test cases


# def pytest_configure(config):
#     inputArgs = vars(config.option)
#     port = inputArgs["port_arg"]
#     print("portValue", port)


def pytest_collection_finish(session):
    node, error = build_test_tree(session)
    cwd = os.getcwd()
    print("session, test node")
    sendPost(cwd, node)


def buildPayload():
    print("building payload")


def build_test_tree(session) -> Tuple[Union[TestNode, None], List[str]]:
    print("building test tree")
    errors: List[str] = []  # how do I check for errors
    session_test_node: TestNode = {
        "path": str(session.fspath),
        "name": session.name,
        "type_": TestNodeTypeEnum.folder,  # check if this is a file or a folder
        "children": [],
        "id_": str(session.fspath),
    }
    testNode_file_dict: dict[pytest.Module, TestNode] = dict()
    session_children_dict: dict[str, TestNode] = dict()
    for test_case in session.items:
        testNode_test: TestItem = {
            "name": test_case.name,
            "path": str(test_case.fspath),
            "lineno": test_case.location[1],  # idk worth a shot
            "type_": TestNodeTypeEnum.test,
            "id_": str(test_case.nodeid),
            "runID": test_case.nodeid,  # can I use this two times?
        }
        print("item: ", test_case, type(test_case))
        print("parent: ", test_case.parent, type(test_case.parent))
        # if the parent object doesn't already exist
        if (
            test_case.parent not in testNode_file_dict.keys()
            and type(test_case.parent) == pytest.Module
        ):
            # create node for file
            ti: TestNode = {
                "name": test_case.parent.name,
                "path": str(test_case.parent.fspath.basename),
                "type_": TestNodeTypeEnum.file,  # check if this is a file or a folder
                "id_": str(test_case.parent.fspath),
                "children": [testNode_test],
            }
            testNode_file_dict[test_case.parent] = ti
        elif type(test_case.parent) == pytest.Module:
            print("AAA", testNode_file_dict[test_case.parent].keys())
            (testNode_file_dict[test_case.parent]).get("children").append(testNode_test)
    created_dict: dict[str, TestNode] = {}
    for file_module, testNode_file in testNode_file_dict.items():
        print("TYPE", type(file_module))
        print("parent", file_module.name)
        name = str(file_module.name)
        prev_folder_test_node: TestNode = testNode_file
        if "/" in name:
            print("this folder is nested")
            nested_folder_list = name.split("/")
            print("folder list", nested_folder_list)
            path_iterator = (
                str(session.fspath) + "/" + "".join(nested_folder_list[0:-1])
            )  # CHECK
            print("len", len(nested_folder_list))
            print("f", file_module)
            for i in range(len(nested_folder_list) - 2, -1, -1):
                folderName = nested_folder_list[i]
                print("folder", nested_folder_list[i])
                print("i", i)
                print("path iterator", path_iterator)
                folder_test_node: TestNode
                if folderName in created_dict.keys():
                    folder_test_node = created_dict[folderName]
                    folder_test_node["children"].append(prev_folder_test_node)
                    print("added child", folder_test_node)
                else:
                    temp: TestNode = {
                        "name": nested_folder_list[i],
                        "path": str(path_iterator),
                        "type_": TestNodeTypeEnum.folder,  # check if this is a file or a folder
                        "id_": str(path_iterator),
                        "children": [prev_folder_test_node],
                    }
                    folder_test_node = temp
                    created_dict[folderName] = folder_test_node
                prev_folder_test_node = folder_test_node
                path_iterator = str(session.fspath) + "".join(nested_folder_list[0:i])
        if (prev_folder_test_node != None) and (
            prev_folder_test_node.get("id_") not in session_children_dict.keys()
        ):
            session_children_dict[
                prev_folder_test_node.get("id_")
            ] = prev_folder_test_node
    session_test_node["children"] = list(session_children_dict.values())
    print("STN", session_test_node)
    return session_test_node, errors


def build_test_node(path: str, name: str, id: str, type_: TestNodeTypeEnum) -> TestNode:
    print("building test node")
    return {"path": path, "name": name, "type_": type_, "children": [], "id_": id}


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

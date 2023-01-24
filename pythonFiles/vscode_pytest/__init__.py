# -*- coding: utf-8 -*-
import enum
import json
import os
import pathlib
import sys
import traceback
from typing import List, Literal, Tuple, TypedDict, Union

import pytest

script_dir = pathlib.Path(__file__).parent.parent
sys.path.append(os.fspath(script_dir))
sys.path.append(os.fspath(script_dir / "lib" / "python"))

import debugpy

debugpy.breakpoint()

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
# PYTHON_FILES = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# sys.path.insert(0, PYTHON_FILES)

# # Add the lib path to sys.path to find the typing_extensions module.
# sys.path.insert(0, os.path.join(PYTHON_FILES, "lib", "python"))
from testing_tools import socket_manager
from typing_extensions import NotRequired

DEFAULT_PORT = "45454"


def pytest_collection_finish(session):
    print("hello")
    node, error = build_test_tree(session)
    cwd = os.getcwd()
    # TODO: add error checking.
    sendPost(cwd, node)


def build_test_tree(session) -> Tuple[Union[TestNode, None], List[str]]:
    errors: List[str] = []
    session_node = create_session_node(session)
    # a dictionary of all direct children of the session.
    session_children_dict: dict[str, TestNode] = dict()
    # a dictionary of all files in the session.
    file_nodes_dict: dict[pytest.Module, TestNode] = dict()
    # a dictionary of all classes in the session.
    class_nodes_dict: dict[str, TestNode] = dict()
    # iterate through all the test items in the session.
    for test_case in session.items:
        test_node = create_test_node(test_case)
        # Check parent node type, either Module or UnitTest class.
        if type(test_case.parent) == pytest.Module:
            file_nodes_dict.setdefault(
                test_case.parent, create_file_node(test_case.parent)
            )["children"].append(test_node)
        else:
            test_class_node = class_nodes_dict.setdefault(
                test_case.parent.name,
                create_class_node(test_case.parent),
            )
            test_class_node["children"].append(test_node)
            parent_module = test_case.parent.parent
            # Create a file node that has the class as a child.
            test_file_node = file_nodes_dict.setdefault(
                parent_module, create_file_node(parent_module)
            )
            # Check if the class is already a child of the file node.
            if test_class_node not in test_file_node["children"]:
                test_file_node["children"].append(test_class_node)

    created_files_folders_dict: dict[str, TestNode] = {}
    for file_module, file_node in file_nodes_dict.items():
        root_folder_node = build_nested_folders(
            file_module, file_node, created_files_folders_dict, session
        )
        # the final folder we get to is the highest folder in the path and therefore we add this as a child to the session.
        if root_folder_node.get("id_") not in session_children_dict:
            session_children_dict[root_folder_node.get("id_")] = root_folder_node
    session_node["children"] = list(session_children_dict.values())
    return session_node, errors


def build_nested_folders(
    file_module, file_node, created_files_folders_dict, session
) -> TestNode:
    prev_folder_node: TestNode = file_node
    # Begin the i_path iteration one level above the current file.
    iterator_path = file_module.path.parent
    while iterator_path != session.path:
        curr_folder_name = iterator_path.name
        curr_folder_node = created_files_folders_dict.setdefault(
            curr_folder_name, create_folder_node(curr_folder_name, iterator_path)
        )
        if prev_folder_node not in curr_folder_node["children"]:
            curr_folder_node["children"].append(prev_folder_node)
        iterator_path = iterator_path.parent
        prev_folder_node = curr_folder_node
    return prev_folder_node


def create_test_node(test_case) -> TestItem:
    return {
        "name": test_case.name,
        "path": str(test_case.path),
        "lineno": test_case.location[1] + 1,
        "type_": TestNodeTypeEnum.test,
        "id_": test_case.nodeid,  # remove cast
        "runID": test_case.nodeid,
    }


def create_session_node(session) -> TestNode:
    return {
        "name": session.name,
        "path": str(session.path),
        "type_": TestNodeTypeEnum.folder,
        "children": [],
        "id_": str(session.path),
    }


def create_class_node(class_module) -> TestNode:
    return {
        "name": class_module.name,
        "path": str(class_module.path),
        "type_": TestNodeTypeEnum.class_,
        "children": [],
        "id_": class_module.nodeid,
    }


def create_file_node(file_module) -> TestNode:
    return {
        "name": str(file_module.path.name),
        "path": str(file_module.path),
        "type_": TestNodeTypeEnum.file,
        "id_": str(file_module.path),
        "children": [],
    }


def create_folder_node(folderName, path_iterator) -> TestNode:
    return {
        "name": folderName,
        "path": str(path_iterator),
        "type_": TestNodeTypeEnum.folder,
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
    with socket_manager.SocketManager(addr) as s:
        data = json.dumps(payload)
        request = f"""POST / HTTP/1.1
Host: localhost:{testPort}
Content-Length: {len(data)}
Content-Type: application/json
Request-uuid: {testuuid}

{data}"""
        with open(
            "/Users/eleanorboyd/vscode-python/pythonFiles/vscode_pytest/test_logs.log",
            "w",
        ) as f:
            f.write(request)
            try:
                s.socket.sendall(request.encode("utf-8"))  # type: ignore
            except Exception as ex:
                f.write(traceback.format_exc())

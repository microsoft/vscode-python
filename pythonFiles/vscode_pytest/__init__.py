# -*- coding: utf-8 -*-
import enum
import json
import os
import pathlib
import sys
from typing import List, Literal, Tuple, TypedDict, Union

import pytest
from _pytest.doctest import DoctestItem, DoctestTextfile

script_dir = pathlib.Path(__file__).parent.parent
sys.path.append(os.fspath(script_dir))
sys.path.append(os.fspath(script_dir / "lib" / "python"))

# Inherit from str so it's JSON serializable.
class TestNodeTypeEnum(str, enum.Enum):
    class_ = "class"
    file = "file"
    folder = "folder"
    test = "test"
    doc_file = "doc_file"


class TestData(TypedDict):
    name: str
    path: str
    type_: TestNodeTypeEnum
    id_: str


class TestItem(TestData):
    lineno: str
    runID: str


class TestNode(TestData):
    children: "List[Union[TestNode, TestItem]]"


from testing_tools import socket_manager
from typing_extensions import NotRequired

DEFAULT_PORT = "45454"


def pytest_collection_finish(session):
    # Called after collection has been performed.
    node: Union[TestNode, None] = build_test_tree(session)[0]
    cwd = pathlib.Path.cwd()
    if node:
        sendPost(str(cwd), node)
    # TODO: add error checking.


def build_test_tree(session) -> Tuple[Union[TestNode, None], List[str]]:
    # Builds a tree of tests from the pytest session.
    errors: List[str] = []
    session_node: TestNode = create_session_node(session)
    session_children_dict: dict[str, TestNode] = {}
    file_nodes_dict: dict[pytest.Module, TestNode] = {}
    class_nodes_dict: dict[str, TestNode] = {}

    for test_case in session.items:
        test_node: TestItem = create_test_node(test_case)
        if type(test_case.parent) == DoctestTextfile:
            try:
                parent_test_case: TestNode = file_nodes_dict[test_case.parent]
            except KeyError:
                parent_test_case: TestNode = create_doc_file_node(test_case.parent)
                file_nodes_dict[test_case.parent] = parent_test_case
            parent_test_case["children"].append(test_node)
        elif type(test_case.parent) is pytest.Module:
            try:
                parent_test_case: TestNode = file_nodes_dict[test_case.parent]
            except KeyError:
                parent_test_case: TestNode = create_file_node(test_case.parent)
                file_nodes_dict[test_case.parent] = parent_test_case
            parent_test_case["children"].append(test_node)
        else:  # should be a pytest.Class
            try:
                test_class_node: TestNode = class_nodes_dict[test_case.parent.name]
            except KeyError:
                test_class_node: TestNode = create_class_node(test_case.parent)
                class_nodes_dict[test_case.parent.name] = test_class_node
            test_class_node["children"].append(test_node)
            parent_module: pytest.Module = test_case.parent.parent
            # Create a file node that has the class as a child.
            try:
                test_file_node: TestNode = file_nodes_dict[parent_module]
            except KeyError:
                test_file_node: TestNode = create_file_node(parent_module)
                file_nodes_dict[parent_module] = test_file_node
            test_file_node["children"].append(test_class_node)
            # Check if the class is already a child of the file node.
            if test_class_node not in test_file_node["children"]:
                test_file_node["children"].append(test_class_node)
    created_files_folders_dict: dict[str, TestNode] = {}
    for file_module, file_node in file_nodes_dict.items():
        # Iterate through all the files that exist and construct them into nested folders.
        root_folder_node: TestNode = build_nested_folders(
            file_module, file_node, created_files_folders_dict, session
        )
        # The final folder we get to is the highest folder in the path and therefore we add this as a child to the session.
        if root_folder_node.get("id_") not in session_children_dict:
            session_children_dict[root_folder_node.get("id_")] = root_folder_node
    session_node["children"] = list(session_children_dict.values())
    return session_node, errors


def build_nested_folders(
    file_module: pytest.Module,
    file_node: TestNode,
    created_files_folders_dict: dict[str, TestNode],
    session: pytest.Session,
) -> TestNode:
    prev_folder_node: TestNode = file_node

    # Begin the i_path iteration one level above the current file.
    iterator_path: pathlib.Path = file_module.path.parent
    while iterator_path != session.path:
        curr_folder_name: str = iterator_path.name
        try:
            curr_folder_node: TestNode = created_files_folders_dict[curr_folder_name]
        except KeyError:
            curr_folder_node: TestNode = create_folder_node(
                curr_folder_name, iterator_path
            )
            created_files_folders_dict[curr_folder_name] = curr_folder_node
        if prev_folder_node not in curr_folder_node["children"]:
            curr_folder_node["children"].append(prev_folder_node)
        iterator_path = iterator_path.parent
        prev_folder_node = curr_folder_node
    return prev_folder_node


def create_test_node(
    test_case: pytest.Item,
) -> TestItem:
    test_case_loc: str = (
        "" if test_case.location[1] is None else str(test_case.location[1] + 1)
    )
    return {
        "name": test_case.name,
        "path": str(test_case.path),
        "lineno": test_case_loc,
        "type_": TestNodeTypeEnum.test,
        "id_": test_case.nodeid,
        "runID": test_case.nodeid,
    }


def create_session_node(session: pytest.Session) -> TestNode:
    return {
        "name": session.name,
        "path": str(session.path),
        "type_": TestNodeTypeEnum.folder,
        "children": [],
        "id_": str(session.path),
    }


def create_class_node(class_module: pytest.Class) -> TestNode:
    return {
        "name": class_module.name,
        "path": str(class_module.path),
        "type_": TestNodeTypeEnum.class_,
        "children": [],
        "id_": class_module.nodeid,
    }


def create_file_node(file_module: pytest.Module) -> TestNode:
    return {
        "name": str(file_module.path.name),
        "path": str(file_module.path),
        "type_": TestNodeTypeEnum.file,
        "id_": str(file_module.path),
        "children": [],
    }


def create_doc_file_node(file_module: pytest.Module) -> TestNode:
    return {
        "name": str(file_module.path.name),
        "path": str(file_module.path),
        "type_": TestNodeTypeEnum.doc_file,
        "id_": str(file_module.path),
        "children": [],
    }


def create_folder_node(folderName: str, path_iterator: pathlib.Path) -> TestNode:
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


def sendPost(cwd: str, tests: TestNode) -> None:
    # Sends a post request as a response to the server.
    payload: PayloadDict = {"cwd": cwd, "status": "success", "tests": tests}
    testPort: Union[str, int] = os.getenv("TEST_PORT", 45454)
    testuuid: Union[str, None] = os.getenv("TEST_UUID")
    addr = "localhost", int(testPort)
    data = json.dumps(payload)
    request = f"""POST / HTTP/1.1
Host: localhost:{testPort}
Content-Length: {len(data)}
Content-Type: application/json
Request-uuid: {testuuid}

{data}"""
    with socket_manager.SocketManager(addr) as s:
        if s.socket is not None:
            s.socket.sendall(request.encode("utf-8"))  # type: ignore

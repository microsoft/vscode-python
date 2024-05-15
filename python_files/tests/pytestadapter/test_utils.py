# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import pathlib
import tempfile
import os
import sys
import json


from .helpers import (  # noqa: E402
    TEST_DATA_PATH,
)

script_dir = pathlib.Path(__file__).parent.parent.parent
sys.path.append(os.fspath(script_dir))
from vscode_pytest import has_symlink_parent  # noqa: E402


def test_has_symlink_parent_with_symlink():
    # Create a temporary directory and a file in it
    with tempfile.TemporaryDirectory() as temp_dir:
        file_path = pathlib.Path(temp_dir) / "file"
        file_path.touch()

        # Create a symbolic link to the temporary directory
        symlink_path = pathlib.Path(temp_dir) / "symlink"
        symlink_path.symlink_to(temp_dir)

        # Check that has_symlink_parent correctly identifies the symbolic link
        assert has_symlink_parent(symlink_path / "file")


def test_has_symlink_parent_without_symlink():
    folder_path = TEST_DATA_PATH / "unittest_folder" / "test_add.py"
    # Check that has_symlink_parent correctly identifies that there are no symbolic links
    assert not has_symlink_parent(folder_path)


def get_absolute_test_id(test_id, path):
    return f"{path}::{test_id}"


def generate_expected_const(json_str, test_data_path_str, test_data_path):
    data = json.loads(json_str)

    def convert_node(node):
        if node["type_"] == "folder":
            converted = {
                "name": node["name"],
                "path": os.fspath(test_data_path / node["name"]),
                "type_": "folder",
                "id_": os.fspath(test_data_path / node["name"]),
                "children": [convert_node(child) for child in node["children"]],
            }
        elif node["type_"] == "file":
            converted = {
                "name": node["name"],
                "path": os.fspath(test_data_path / node["name"]),
                "type_": "file",
                "id_": os.fspath(test_data_path / node["name"]),
                "children": [convert_node(child) for child in node["children"]],
            }
        elif node["type_"] == "class":
            converted = {
                "name": node["name"],
                "path": os.fspath(test_data_path / node["name"]),
                "type_": "class",
                "children": [convert_node(child) for child in node["children"]],
            }
        elif node["type_"] == "function":
            converted = {
                "name": node["name"],
                "path": os.fspath(test_data_path / node["name"]),
                "type_": "function",
                "children": [convert_node(child) for child in node["children"]],
            }
        elif node["type_"] == "test":
            converted = {
                "name": node["name"],
                "path": os.fspath(test_data_path / node["name"]),
                "lineno": node["lineno"],
                "type_": "test",
                "id_": get_absolute_test_id(node["id_"], test_data_path / node["name"]),
                "runID": get_absolute_test_id(node["runID"], test_data_path / node["name"]),
            }
        return converted

    root = convert_node(data)
    root["path"] = test_data_path_str
    root["id_"] = test_data_path_str
    return root

# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
import json
import os
import pathlib
import shutil
import sys
from typing import Any, Dict, List, Optional

import pytest

script_dir = pathlib.Path(__file__).parent.parent
sys.path.append(os.fspath(script_dir))

from tests.tree_comparison_helper import is_same_tree

from . import expected_discovery_test_output
from .helpers import TEST_DATA_PATH, runner, runner_with_cwd, create_symlink


@pytest.mark.skipif(
    sys.platform == "win32",
    reason="See https://github.com/microsoft/vscode-python/issues/22965",
)
def test_import_error(tmp_path):
    """Test pytest discovery on a file that has a pytest marker but does not import pytest.

    Copies the contents of a .txt file to a .py file in the temporary directory
    to then run pytest discovery on.

    The json should still be returned but the errors list should be present.

    Keyword arguments:
    tmp_path -- pytest fixture that creates a temporary directory.
    """
    # Saving some files as .txt to avoid that file displaying a syntax error for
    # the extension as a whole. Instead, rename it before running this test
    # in order to test the error handling.
    file_path = TEST_DATA_PATH / "error_pytest_import.txt"
    temp_dir = tmp_path / "temp_data"
    temp_dir.mkdir()
    p = temp_dir / "error_pytest_import.py"
    shutil.copyfile(file_path, p)
    actual: Optional[List[Dict[str, Any]]] = runner(["--collect-only", os.fspath(p)])
    assert actual
    actual_list: List[Dict[str, Any]] = actual
    if actual_list is not None:
        assert actual_list.pop(-1).get("eot")
        for actual_item in actual_list:
            assert all(
                item in actual_item.keys() for item in ("status", "cwd", "error")
            )
            assert actual_item.get("status") == "error"
            assert actual_item.get("cwd") == os.fspath(TEST_DATA_PATH)

            # Ensure that 'error' is a list and then check its length
            error_content = actual_item.get("error")
            if error_content is not None and isinstance(
                error_content, (list, tuple, str)
            ):  # You can add other types if needed
                assert len(error_content) == 2
            else:
                assert False


@pytest.mark.skipif(
    sys.platform == "win32",
    reason="See https://github.com/microsoft/vscode-python/issues/22965",
)
def test_syntax_error(tmp_path):
    """Test pytest discovery on a file that has a syntax error.

    Copies the contents of a .txt file to a .py file in the temporary directory
    to then run pytest discovery on.

    The json should still be returned but the errors list should be present.

    Keyword arguments:
    tmp_path -- pytest fixture that creates a temporary directory.
    """
    # Saving some files as .txt to avoid that file displaying a syntax error for
    # the extension as a whole. Instead, rename it before running this test
    # in order to test the error handling.
    file_path = TEST_DATA_PATH / "error_syntax_discovery.txt"
    temp_dir = tmp_path / "temp_data"
    temp_dir.mkdir()
    p = temp_dir / "error_syntax_discovery.py"
    shutil.copyfile(file_path, p)
    actual = runner(["--collect-only", os.fspath(p)])
    assert actual
    actual_list: List[Dict[str, Any]] = actual
    if actual_list is not None:
        assert actual_list.pop(-1).get("eot")
        for actual_item in actual_list:
            assert all(
                item in actual_item.keys() for item in ("status", "cwd", "error")
            )
            assert actual_item.get("status") == "error"
            assert actual_item.get("cwd") == os.fspath(TEST_DATA_PATH)

            # Ensure that 'error' is a list and then check its length
            error_content = actual_item.get("error")
            if error_content is not None and isinstance(
                error_content, (list, tuple, str)
            ):  # You can add other types if needed
                assert len(error_content) == 2
            else:
                assert False


def test_parameterized_error_collect():
    """Tests pytest discovery on specific file that incorrectly uses parametrize.

    The json should still be returned but the errors list should be present.
    """
    file_path_str = "error_parametrize_discovery.py"
    actual = runner(["--collect-only", file_path_str])
    assert actual
    actual_list: List[Dict[str, Any]] = actual
    if actual_list is not None:
        assert actual_list.pop(-1).get("eot")
        for actual_item in actual_list:
            assert all(
                item in actual_item.keys() for item in ("status", "cwd", "error")
            )
            assert actual_item.get("status") == "error"
            assert actual_item.get("cwd") == os.fspath(TEST_DATA_PATH)

            # Ensure that 'error' is a list and then check its length
            error_content = actual_item.get("error")
            if error_content is not None and isinstance(
                error_content, (list, tuple, str)
            ):  # You can add other types if needed
                assert len(error_content) == 2
            else:
                assert False


@pytest.mark.parametrize(
    "file, expected_const",
    [
        (
            "test_multi_class_nest.py",
            expected_discovery_test_output.nested_classes_expected_test_output,
        ),
        (
            "unittest_skiptest_file_level.py",
            expected_discovery_test_output.unittest_skip_file_level_expected_output,
        ),
        (
            "param_same_name",
            expected_discovery_test_output.param_same_name_expected_output,
        ),
        (
            "parametrize_tests.py",
            expected_discovery_test_output.parametrize_tests_expected_output,
        ),
        (
            "empty_discovery.py",
            expected_discovery_test_output.empty_discovery_pytest_expected_output,
        ),
        (
            "simple_pytest.py",
            expected_discovery_test_output.simple_discovery_pytest_expected_output,
        ),
        (
            "unittest_pytest_same_file.py",
            expected_discovery_test_output.unit_pytest_same_file_discovery_expected_output,
        ),
        (
            "unittest_folder",
            expected_discovery_test_output.unittest_folder_discovery_expected_output,
        ),
        (
            "dual_level_nested_folder",
            expected_discovery_test_output.dual_level_nested_folder_expected_output,
        ),
        (
            "folder_a",
            expected_discovery_test_output.double_nested_folder_expected_output,
        ),
        (
            "text_docstring.txt",
            expected_discovery_test_output.doctest_pytest_expected_output,
        ),
    ],
)
def test_pytest_collect(file, expected_const):
    """
    Test to test pytest discovery on a variety of test files/ folder structures.
    Uses variables from expected_discovery_test_output.py to store the expected dictionary return.
    Only handles discovery and therefore already contains the arg --collect-only.
    All test discovery will succeed, be in the correct cwd, and match expected test output.

    Keyword arguments:
    file -- a string with the file or folder to run pytest discovery on.
    expected_const -- the expected output from running pytest discovery on the file.
    """
    actual = runner(
        [
            "--collect-only",
            os.fspath(TEST_DATA_PATH / file),
        ]
    )

    assert actual
    actual_list: List[Dict[str, Any]] = actual
    if actual_list is not None:
        assert actual_list.pop(-1).get("eot")
        actual_item = actual_list.pop(0)
        assert all(item in actual_item.keys() for item in ("status", "cwd", "error"))
        assert actual_item.get("status") == "success"
        assert actual_item.get("cwd") == os.fspath(TEST_DATA_PATH)
        assert is_same_tree(actual_item.get("tests"), expected_const)


def test_symlink_root_dir():
    """
    Test to test pytest discovery with the command line arg --rootdir specified as a symlink path.
    Discovery should succeed and testids should be relative to the symlinked root directory.
    """
    with create_symlink(TEST_DATA_PATH, "root", "symlink_folder") as (
        source,
        destination,
    ):
        assert destination.is_symlink()

        # Run pytest with the cwd being the resolved symlink path (as it will be when we run the subprocess from node).
        actual = runner_with_cwd(
            ["--collect-only", f"--rootdir={os.fspath(destination)}"], source
        )
        expected = expected_discovery_test_output.symlink_expected_discovery_output
        assert actual
        actual_list: List[Dict[str, Any]] = actual
        if actual_list is not None:
            assert actual_list.pop(-1).get("eot")
            actual_item = actual_list.pop(0)
            try:
                # Check if all requirements
                assert all(
                    item in actual_item.keys() for item in ("status", "cwd", "error")
                ), "Required keys are missing"
                assert actual_item.get("status") == "success", "Status is not 'success'"
                assert actual_item.get("cwd") == os.fspath(
                    destination
                ), f"CWD does not match: {os.fspath(destination)}"
                assert (
                    actual_item.get("tests") == expected
                ), "Tests do not match expected value"
            except AssertionError as e:
                # Print the actual_item in JSON format if an assertion fails
                print(json.dumps(actual_item, indent=4))
                pytest.fail(str(e))


def test_pytest_root_dir():
    """
    Test to test pytest discovery with the command line arg --rootdir specified to be a subfolder
    of the workspace root. Discovery should succeed and testids should be relative to workspace root.
    """
    rd = f"--rootdir={TEST_DATA_PATH / 'root' / 'tests'}"
    actual = runner_with_cwd(
        [
            "--collect-only",
            rd,
        ],
        TEST_DATA_PATH / "root",
    )
    assert actual
    actual_list: List[Dict[str, Any]] = actual
    if actual_list is not None:
        assert actual_list.pop(-1).get("eot")
        actual_item = actual_list.pop(0)
        assert all(item in actual_item.keys() for item in ("status", "cwd", "error"))
        assert actual_item.get("status") == "success"
        assert actual_item.get("cwd") == os.fspath(TEST_DATA_PATH / "root")
        assert is_same_tree(
            actual_item.get("tests"),
            expected_discovery_test_output.root_with_config_expected_output,
        )


def test_pytest_config_file():
    """
    Test to test pytest discovery with the command line arg -c with a specified config file which
    changes the workspace root. Discovery should succeed and testids should be relative to workspace root.
    """
    actual = runner_with_cwd(
        [
            "--collect-only",
            "tests/",
        ],
        TEST_DATA_PATH / "root",
    )
    assert actual
    actual_list: List[Dict[str, Any]] = actual
    if actual_list is not None:
        assert actual_list.pop(-1).get("eot")
        actual_item = actual_list.pop(0)
        assert all(item in actual_item.keys() for item in ("status", "cwd", "error"))
        assert actual_item.get("status") == "success"
        assert actual_item.get("cwd") == os.fspath(TEST_DATA_PATH / "root")
        assert is_same_tree(
            actual_item.get("tests"),
            expected_discovery_test_output.root_with_config_expected_output,
        )

# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
import os
import shutil
from typing import Any, Dict, List, Optional

import pytest

from . import expected_discovery_test_output
from .helpers import TEST_DATA_PATH, runner


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
    actual_list: Optional[List[Dict[str, Any]]] = runner(
        ["--collect-only", os.fspath(p)]
    )
    assert actual_list
    for actual in actual_list:
        assert all(item in actual for item in ("status", "cwd", "error"))
        assert actual["status"] == "error"
        assert actual["cwd"] == os.fspath(TEST_DATA_PATH)
        assert len(actual["error"]) == 2


def test_parameterized_error_collect():
    """Tests pytest discovery on specific file that incorrectly uses parametrize.

    The json should still be returned but the errors list should be present.
    """
    file_path_str = "error_parametrize_discovery.py"
    actual_list: Optional[List[Dict[str, Any]]] = runner(
        ["--collect-only", file_path_str]
    )
    assert actual_list
    for actual in actual_list:
        assert all(item in actual for item in ("status", "cwd", "error"))
        assert actual["status"] == "error"
        assert actual["cwd"] == os.fspath(TEST_DATA_PATH)
        assert len(actual["error"]) == 2


@pytest.mark.parametrize(
    "file, expected_const",
    [
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
            "double_nested_folder",
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
    actual_list: Optional[List[Dict[str, Any]]] = runner(
        [
            "--collect-only",
            os.fspath(TEST_DATA_PATH / file),
        ]
    )
    assert actual_list
    for actual in actual_list:
        assert all(item in actual for item in ("status", "cwd", "tests"))
        assert actual["status"] == "success"
        assert actual["cwd"] == os.fspath(TEST_DATA_PATH)
        assert actual["tests"] == expected_const

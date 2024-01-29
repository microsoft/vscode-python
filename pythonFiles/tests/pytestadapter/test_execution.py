# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
import os
import shutil
from typing import Any, Dict, List

import pytest

from tests.pytestadapter import expected_execution_test_output

from .helpers import TEST_DATA_PATH, runner, runner_with_cwd


def test_config_file():
    """Test pytest execution when a config file is specified."""
    args = [
        "-c",
        "tests/pytest.ini",
        str(TEST_DATA_PATH / "root" / "tests" / "test_a.py::test_a_function"),
    ]
    new_cwd = TEST_DATA_PATH / "root"
    actual = runner_with_cwd(args, new_cwd)
    expected_const = (
        expected_execution_test_output.config_file_pytest_expected_execution_output
    )
    assert actual
    actual_list: List[Dict[str, Any]] = actual
    assert actual_list.pop(-1).get("eot")
    assert len(actual_list) == len(expected_const)
    actual_result_dict = dict()
    if actual_list is not None:
        for actual_item in actual_list:
            assert all(
                item in actual_item.keys() for item in ("status", "cwd", "result")
            )
            assert actual_item.get("status") == "success"
            assert actual_item.get("cwd") == os.fspath(new_cwd)
            actual_result_dict.update(actual_item["result"])
        assert actual_result_dict == expected_const


def test_rootdir_specified():
    """Test pytest execution when a --rootdir is specified."""
    rd = f"--rootdir={TEST_DATA_PATH / 'root' / 'tests'}"
    args = [rd, "tests/test_a.py::test_a_function"]
    new_cwd = TEST_DATA_PATH / "root"
    actual = runner_with_cwd(args, new_cwd)
    expected_const = (
        expected_execution_test_output.config_file_pytest_expected_execution_output
    )
    assert actual
    actual_list: List[Dict[str, Any]] = actual
    assert actual_list.pop(-1).get("eot")
    assert len(actual_list) == len(expected_const)
    actual_result_dict = dict()
    if actual_list is not None:
        for actual_item in actual_list:
            assert all(
                item in actual_item.keys() for item in ("status", "cwd", "result")
            )
            assert actual_item.get("status") == "success"
            assert actual_item.get("cwd") == os.fspath(new_cwd)
            actual_result_dict.update(actual_item["result"])
        assert actual_result_dict == expected_const


def test_syntax_error_execution(tmp_path):
    """Test pytest execution on a file that has a syntax error.

    Copies the contents of a .txt file to a .py file in the temporary directory
    to then run pytest execution on.

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
    actual = runner(["error_syntax_discover.py::test_function"])
    assert actual
    actual_list: List[Dict[str, Any]] = actual
    assert actual_list.pop(-1).get("eot")
    if actual_list is not None:
        for actual_item in actual_list:
            assert all(
                item in actual_item.keys() for item in ("status", "cwd", "error")
            )
            assert actual_item.get("status") == "error"
            assert actual_item.get("cwd") == os.fspath(TEST_DATA_PATH)
            error_content = actual_item.get("error")
            if error_content is not None and isinstance(
                error_content, (list, tuple, str)
            ):  # You can add other types if needed
                assert len(error_content) == 1
            else:
                assert False


def test_bad_id_error_execution():
    """Test pytest discovery with a non-existent test_id.

    The json should still be returned but the errors list should be present.
    """
    actual = runner(["not/a/real::test_id"])
    assert actual
    actual_list: List[Dict[str, Any]] = actual
    assert actual_list.pop(-1).get("eot")
    if actual_list is not None:
        for actual_item in actual_list:
            assert all(
                item in actual_item.keys() for item in ("status", "cwd", "error")
            )
            assert actual_item.get("status") == "error"
            assert actual_item.get("cwd") == os.fspath(TEST_DATA_PATH)
            error_content = actual_item.get("error")
            if error_content is not None and isinstance(
                error_content, (list, tuple, str)
            ):  # You can add other types if needed
                assert len(error_content) == 1
            else:
                assert False


@pytest.mark.parametrize(
    "test_ids, expected_const",
    [
        (
            [
                "test_env_vars.py::test_clear_env",
                "test_env_vars.py::test_check_env",
            ],
            expected_execution_test_output.safe_clear_env_vars_expected_execution_output,
        ),
        (
            [
                "skip_tests.py::test_something",
                "skip_tests.py::test_another_thing",
                "skip_tests.py::test_decorator_thing",
                "skip_tests.py::test_decorator_thing_2",
                "skip_tests.py::TestClass::test_class_function_a",
                "skip_tests.py::TestClass::test_class_function_b",
            ],
            expected_execution_test_output.skip_tests_execution_expected_output,
        ),
        (
            ["error_raise_exception.py::TestSomething::test_a"],
            expected_execution_test_output.error_raised_exception_execution_expected_output,
        ),
        (
            [
                "unittest_folder/test_add.py::TestAddFunction::test_add_positive_numbers",
                "unittest_folder/test_add.py::TestAddFunction::test_add_negative_numbers",
                "unittest_folder/test_subtract.py::TestSubtractFunction::test_subtract_positive_numbers",
                "unittest_folder/test_subtract.py::TestSubtractFunction::test_subtract_negative_numbers",
            ],
            expected_execution_test_output.uf_execution_expected_output,
        ),
        (
            [
                "unittest_folder/test_add.py::TestAddFunction::test_add_positive_numbers",
                "unittest_folder/test_add.py::TestAddFunction::test_add_negative_numbers",
            ],
            expected_execution_test_output.uf_single_file_expected_output,
        ),
        (
            [
                "unittest_folder/test_add.py::TestAddFunction::test_add_positive_numbers",
            ],
            expected_execution_test_output.uf_single_method_execution_expected_output,
        ),
        (
            [
                "unittest_folder/test_add.py::TestAddFunction::test_add_positive_numbers",
                "unittest_folder/test_subtract.py::TestSubtractFunction::test_subtract_positive_numbers",
            ],
            expected_execution_test_output.uf_non_adjacent_tests_execution_expected_output,
        ),
        (
            [
                "unittest_pytest_same_file.py::TestExample::test_true_unittest",
                "unittest_pytest_same_file.py::test_true_pytest",
            ],
            expected_execution_test_output.unit_pytest_same_file_execution_expected_output,
        ),
        (
            [
                "dual_level_nested_folder/test_top_folder.py::test_top_function_t",
                "dual_level_nested_folder/test_top_folder.py::test_top_function_f",
                "dual_level_nested_folder/z_nested_folder_one/test_bottom_folder.py::test_bottom_function_t",
                "dual_level_nested_folder/z_nested_folder_one/test_bottom_folder.py::test_bottom_function_f",
            ],
            expected_execution_test_output.dual_level_nested_folder_execution_expected_output,
        ),
        (
            ["folder_a/folder_b/folder_a/test_nest.py::test_function"],
            expected_execution_test_output.double_nested_folder_expected_execution_output,
        ),
        (
            [
                "parametrize_tests.py::test_adding[3+5-8]",
                "parametrize_tests.py::test_adding[2+4-6]",
                "parametrize_tests.py::test_adding[6+9-16]",
            ],
            expected_execution_test_output.parametrize_tests_expected_execution_output,
        ),
        (
            [
                "parametrize_tests.py::test_adding[3+5-8]",
            ],
            expected_execution_test_output.single_parametrize_tests_expected_execution_output,
        ),
        (
            [
                "text_docstring.txt::text_docstring.txt",
            ],
            expected_execution_test_output.doctest_pytest_expected_execution_output,
        ),
        (
            ["test_logging.py::test_logging2", "test_logging.py::test_logging"],
            expected_execution_test_output.logging_test_expected_execution_output,
        ),
    ],
)
def test_pytest_execution(test_ids, expected_const):
    """
    Test that pytest discovery works as expected where run pytest is always successful
    but the actual test results are both successes and failures.:
    1: skip_tests_execution_expected_output: test run on a file with skipped tests.
    2. error_raised_exception_execution_expected_output: test run on a file that raises an exception.
    3. uf_execution_expected_output: unittest tests run on multiple files.
    4. uf_single_file_expected_output: test run on a single file.
    5. uf_single_method_execution_expected_output: test run on a single method in a file.
    6. uf_non_adjacent_tests_execution_expected_output: test run on unittests in two files with single selection in test explorer.
    7. unit_pytest_same_file_execution_expected_output: test run on a file with both unittest and pytest tests.
    8. dual_level_nested_folder_execution_expected_output: test run on a file with one test file
    at the top level and one test file in a nested folder.
    9. double_nested_folder_expected_execution_output: test run on a double nested folder.
    10. parametrize_tests_expected_execution_output: test run on a parametrize test with 3 inputs.
    11. single_parametrize_tests_expected_execution_output: test run on single parametrize test.
    12. doctest_pytest_expected_execution_output: test run on doctest file.
    13. logging_test_expected_execution_output: test run on a file with logging.


    Keyword arguments:
    test_ids -- an array of test_ids to run.
    expected_const -- a dictionary of the expected output from running pytest discovery on the files.
    """
    args = test_ids
    actual = runner(args)
    assert actual
    actual_list: List[Dict[str, Any]] = actual
    assert actual_list.pop(-1).get("eot")
    assert len(actual_list) == len(expected_const)
    actual_result_dict = dict()
    if actual_list is not None:
        for actual_item in actual_list:
            assert all(
                item in actual_item.keys() for item in ("status", "cwd", "result")
            )
            assert actual_item.get("status") == "success"
            assert actual_item.get("cwd") == os.fspath(TEST_DATA_PATH)
            actual_result_dict.update(actual_item["result"])
    for key in actual_result_dict:
        if (
            actual_result_dict[key]["outcome"] == "failure"
            or actual_result_dict[key]["outcome"] == "error"
        ):
            actual_result_dict[key]["message"] = "ERROR MESSAGE"
        if actual_result_dict[key]["traceback"] is not None:
            actual_result_dict[key]["traceback"] = "TRACEBACK"
    assert actual_result_dict == expected_const

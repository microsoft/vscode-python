# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
import os
import shutil

import pytest

from tests.pytestadapter import expected_execution_test_output

from .helpers import TEST_DATA_PATH, runner


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
    if actual:
        actual = actual[0]
        assert actual
        assert all(item in actual for item in ("status", "cwd", "error"))
        assert actual["status"] == "error"
        assert actual["cwd"] == os.fspath(TEST_DATA_PATH)
        assert len(actual["error"]) == 1


def test_bad_id_error_execution():
    """Test pytest discovery with a non-existent test_id.

    The json should still be returned but the errors list should be present.
    """
    actual = runner(["not/a/real::test_id"])
    if actual:
        actual = actual[0]
        assert actual
        assert all(item in actual for item in ("status", "cwd", "error"))
        assert actual["status"] == "error"
        assert actual["cwd"] == os.fspath(TEST_DATA_PATH)
        assert len(actual["error"]) == 1


@pytest.mark.parametrize(
    "test_ids, expected_const",
    [
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
                "dual_level_nested_folder/nested_folder_one/test_bottom_folder.py::test_bottom_function_t",
                "dual_level_nested_folder/nested_folder_one/test_bottom_folder.py::test_bottom_function_f",
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
    ],
)
def test_pytest_execution(test_ids, expected_const):
    """
    Test that pytest discovery works as expected where run pytest is always successful
    but the actual test results are both successes and failures.:
    1. uf_execution_expected_output: unittest tests run on multiple files.
    2. uf_single_file_expected_output: test run on a single file.
    3. uf_single_method_execution_expected_output: test run on a single method in a file.
    4. uf_non_adjacent_tests_execution_expected_output: test run on unittests in two files with single selection in test explorer.
    5. unit_pytest_same_file_execution_expected_output: test run on a file with both unittest and pytest tests.
    6. dual_level_nested_folder_execution_expected_output: test run on a file with one test file at the top level and one test file in a nested folder.
    7. double_nested_folder_expected_execution_output: test run on a double nested folder.
    8. parametrize_tests_expected_execution_output: test run on a parametrize test with 3 inputs.
    9. single_parametrize_tests_expected_execution_output: test run on single parametrize test.
    10. doctest_pytest_expected_execution_output: test run on doctest file.


    Keyword arguments:
    test_ids -- an array of test_ids to run.
    expected_const -- a dictionary of the expected output from running pytest discovery on the files.
    """  # noqa: E501
    args = test_ids
    actual = runner(args)
    assert actual
    print(actual)
    assert len(actual) == len(expected_const)
    actual_result_dict = dict()
    for a in actual:
        assert all(item in a for item in ("status", "cwd", "result"))
        assert a["status"] == "success"
        assert a["cwd"] == os.fspath(TEST_DATA_PATH)
        actual_result_dict.update(a["result"])
    for key in actual_result_dict:
        if (
            actual_result_dict[key]["outcome"] == "failure"
            or actual_result_dict[key]["outcome"] == "error"
        ):
            actual_result_dict[key]["message"] = "ERROR MESSAGE"
        if actual_result_dict[key]["traceback"] is not None:
            actual_result_dict[key]["traceback"] = "TRACEBACK"
    assert actual_result_dict == expected_const

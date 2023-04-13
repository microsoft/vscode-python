# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
import json
import os
import shutil

import pytest

from pythonFiles.tests.pytestadapter import expected_execution_test_output

from .helpers import TEST_DATA_PATH, runner

test_add_positive_numbers_id = (
    "unittest_folder.test_add.TestAddFunction.test_add_positive_numbers"
)
test_add_negative_numbers_id = (
    "unittest_folder.test_add.TestAddFunction.test_add_negative_numbers"
)
test_subtract_positive_numbers_id = (
    "unittest_folder.test_subtract.TestSubtractFunction.test_subtract_positive_numbers"
)
test_subtract_negative_numbers_id = (
    "unittest_folder.test_subtract.TestSubtractFunction.test_subtract_negative_numbers"
)


@pytest.mark.parametrize(
    "test_ids, expected_const",
    [
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
            [
                "double_nested_folder/nested_folder_one/nested_folder_two/test_nest.py::test_function"
            ],
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
    FILL IN

    Keyword arguments:
    file -- a string with the file or folder to run pytest execution on.
    expected_const -- the expected output from running pytest discovery on the file.
    """
    args = test_ids  # [""]
    actual = runner(args)
    assert actual
    assert all(item in actual for item in ("status", "cwd", "result"))
    assert actual["status"] == "success"
    assert actual["cwd"] == os.fspath(TEST_DATA_PATH)
    assert actual["result"] == expected_const

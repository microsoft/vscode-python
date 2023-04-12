# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
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
        # (
        #     [
        #         test_add_positive_numbers_id,
        #         test_add_negative_numbers_id,
        #         test_subtract_negative_numbers_id,
        #         test_subtract_positive_numbers_id,
        #     ],
        #     expected_execution_test_output.uf_execution_expected_output,
        # ),
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

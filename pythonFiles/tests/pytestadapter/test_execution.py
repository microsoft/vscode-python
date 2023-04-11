# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
import os
import shutil

import pytest

from pythonFiles.tests.pytestadapter import expected_execution_test_output

from .helpers import TEST_DATA_PATH, runner


@pytest.mark.parametrize(
    "file, expected_const",
    [
        (
            "unittest_folder",
            expected_execution_test_output.uf_execution_expected_output,
        ),
        (
            "unittest_folder",
            expected_execution_test_output.uf_execution_expected_output,
        ),
    ],
)
def test_pytest_execution(file, expected_const):
    """
    FILL IN
    
    Keyword arguments:
    file -- a string with the file or folder to run pytest execution on.
    expected_const -- the expected output from running pytest discovery on the file.
    """
    actual = runner(
        [
            "",
            os.fspath(TEST_DATA_PATH / file),
        ]
    )
    assert actual
    assert all(item in actual for item in ("status", "cwd", "result"))
    assert actual["status"] == "success"
    assert actual["cwd"] == os.fspath(TEST_DATA_PATH)
    assert actual["result"] == expected_const

# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os
import pathlib
import sys

sys.path.append(os.fspath(pathlib.Path(__file__).parent))

python_files_path = pathlib.Path(__file__).parent.parent.parent
sys.path.insert(0, os.fspath(python_files_path))
sys.path.insert(0, os.fspath(python_files_path / "lib" / "python"))

from tests.pytestadapter import helpers  # noqa: E402

TEST_DATA_PATH = pathlib.Path(__file__).parent / ".data"


def test_basic_coverage():
    """This test runs on a simple django project with three tests, two of which pass and one that fails."""
    coverage_ex_folder: pathlib.Path = TEST_DATA_PATH / "coverage_ex"
    execution_script: pathlib.Path = python_files_path / "unittestadapter" / "execution.py"
    test_ids = [
        "test_reverse.TestReverseFunctions.test_reverse_sentence",
        "test_reverse.TestReverseFunctions.test_reverse_sentence_error",
        "test_reverse.TestReverseFunctions.test_reverse_string",
    ]
    argv = [os.fsdecode(execution_script), "--udiscovery", "-vv", "-s", ".", "-p", "*test*.py"]
    argv = argv + test_ids

    actual = helpers.runner_with_cwd_env(
        argv,
        coverage_ex_folder,
        {"COVERAGE_ENABLED": os.fspath(coverage_ex_folder), "_TEST_VAR_UNITTEST": "True"},
    )

    assert actual
    coverage = actual[-1]
    assert coverage
    results = coverage["result"]
    assert results
    assert len(results) == 3
    focal_function_coverage = results.get(os.fspath(TEST_DATA_PATH / "coverage_ex" / "reverse.py"))
    assert focal_function_coverage
    assert focal_function_coverage.get("lines_covered") is not None
    assert focal_function_coverage.get("lines_missed") is not None
    assert set(focal_function_coverage.get("lines_covered")) == {4, 5, 7, 9, 10, 11, 12, 13, 14}
    assert set(focal_function_coverage.get("lines_missed")) == {6}

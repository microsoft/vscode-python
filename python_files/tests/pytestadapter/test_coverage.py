# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
import os
import pathlib
import sys

script_dir = pathlib.Path(__file__).parent.parent
sys.path.append(os.fspath(script_dir))

from .helpers import (  # noqa: E402
    TEST_DATA_PATH,
    runner_with_cwd_env,
)


def test_simple_pytest_coverage():
    """
    Test coverage payload is correct for simple pytest example. Output of coverage run is below.

    Name              Stmts   Miss Branch BrPart  Cover
    ---------------------------------------------------
    __init__.py           0      0      0      0   100%
    reverse.py           13      3      8      2    76%
    test_reverse.py      11      0      0      0   100%
    ---------------------------------------------------
    TOTAL                24      3      8      2    84%

    """
    args = []
    env_add = {"COVERAGE_ENABLED": "True"}
    cov_folder_path = TEST_DATA_PATH / "coverage_gen"
    actual = runner_with_cwd_env(args, cov_folder_path, env_add)
    assert actual
    coverage = actual[-1]
    assert coverage
    results = coverage["result"]
    assert results
    assert len(results) == 3
    focal_function_coverage = results.get(os.fspath(TEST_DATA_PATH / "coverage_gen" / "reverse.py"))
    assert focal_function_coverage
    assert focal_function_coverage.get("lines_covered") is not None
    assert focal_function_coverage.get("lines_missed") is not None
    assert set(focal_function_coverage.get("lines_covered")) == {4, 5, 7, 9, 10, 11, 12, 13, 14, 17}
    assert set(focal_function_coverage.get("lines_missed")) == {18, 19, 6}
    assert (
        focal_function_coverage.get("executed_branches") > 0
    ), "executed_branches are a number greater than 0."
    assert (
        focal_function_coverage.get("total_branches") > 0
    ), "total_branches are a number greater than 0."

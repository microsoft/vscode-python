# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

from typing import List

import pytest
from unittestadapter.execution import parse_execution_cli_args, run_tests

TEST_DATA_FOLDER_PATH = 'pythonFiles/tests/unittestadapter/.data'

@pytest.mark.parametrize(
    "args, expected",
    [
        (
            ['--port', '111', '--uuid', 'fake-uuid', '--testids', 'test_file.test_class.test_method'],
            (111, "fake-uuid", ["test_file.test_class.test_method"]),
        ),
        (
            ['--port', '111', '--uuid', 'fake-uuid', '--testids', ''],
            (111, "fake-uuid", [""]),
        ),
        (
            ['--port', '111', '--uuid', 'fake-uuid', '--testids', 'test_file.test_class.test_method', '-v', '-s'],
            (111, "fake-uuid", ["test_file.test_class.test_method"]),
        ),
    ],
)
def test_parse_execution_cli_args(args: List[str], expected: List[str]) -> None:
    """The parse_execution_cli_args function should return values for the port, uuid, and testids arguments
    when passed as command-line options, and ignore unrecognized arguments.
    """
    actual = parse_execution_cli_args(args)
    assert actual == expected



def test_no_ids_run() -> None:
    """This test runs on an empty array of test_ids, therefore it should return
    an empty dict for the result.
    """
    start_dir = TEST_DATA_FOLDER_PATH
    testids = []
    pattern = 'discovery_simple*'
    actual = run_tests(start_dir, testids, pattern, None, 'fake-uuid')
    assert actual
    assert all(item in actual for item in ("cwd", "status", "result"))
    assert actual["status"] == "success"
    assert actual["cwd"] == '/Users/eleanorboyd/vscode-python/pythonFiles/tests/unittestadapter/.data'
    assert len(actual["result"]) == 0

def test_single_ids_run() -> None:
    """This test runs on a single test_id, therefore it should return
    a dict with a single key-value pair for the result. 
    
    This single test passes so the outcome should be 'success'.
    """
    start_dir = TEST_DATA_FOLDER_PATH
    id = 'discovery_simple.DiscoverySimple.test_one'
    testids = [id]
    pattern = 'discovery_simple*'
    top_level_dir = None
    uuid = 'fake-uuid'
    actual = run_tests(start_dir, testids, pattern, top_level_dir, uuid)
    assert actual
    assert all(item in actual for item in ("cwd", "status", "result"))
    assert actual["status"] == "success"
    assert actual["cwd"] == '/Users/eleanorboyd/vscode-python/pythonFiles/tests/unittestadapter/.data'
    assert len(actual["result"]) == 1
    assert actual["result"][id]
    assert actual["result"][id]['outcome'] == 'success'
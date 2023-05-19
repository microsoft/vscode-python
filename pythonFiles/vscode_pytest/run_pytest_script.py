# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
import json
import os
import pathlib
import sys

import pytest

# This script handles running pytest via pytest.main(). It is called via run in the
# pytest execution adapter and gets the test_ids to run via stdin and the rest of the
# args through sys.argv. It then runs pytest.main() with the args and test_ids.

if __name__ == "__main__":
    # Add the root directory to the path so that we can import the plugin.
    directory_path = pathlib.Path(__file__).parent.parent
    sys.path.append(os.fspath(directory_path))
    # Get the rest of the args to run with pytest.
    args = sys.argv[1:]
    try:
        # Load test_ids from stdin.
        test_ids = json.loads(sys.stdin.read())
        arg_array = ["-p", "vscode_pytest"] + args + test_ids
        pytest.main(arg_array)
    except json.JSONDecodeError:
        print("Error: Could not parse test ids from stdin")

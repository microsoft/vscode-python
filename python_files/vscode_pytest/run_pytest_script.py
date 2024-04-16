# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.
import json
import os
import pathlib
import socket
import sys

import pytest

script_dir = pathlib.Path(__file__).parent.parent
sys.path.append(os.fspath(script_dir))
sys.path.append(os.fspath(script_dir / "lib" / "python"))
from testing_tools import process_json_util  # noqa: E402
from testing_tools import socket_manager  # noqa: E402


# This script handles running pytest via pytest.main(). It is called via run in the
# pytest execution adapter and gets the test_ids to run via stdin and the rest of the
# args through sys.argv. It then runs pytest.main() with the args and test_ids.

if __name__ == "__main__":
    # Add the root directory to the path so that we can import the plugin.
    directory_path = pathlib.Path(__file__).parent.parent
    sys.path.append(os.fspath(directory_path))
    sys.path.insert(0, os.getcwd())
    # Get the rest of the args to run with pytest.
    args = sys.argv[1:]
    run_test_ids_pipe = os.environ.get("RUN_TEST_IDS_PIPE")
    if not run_test_ids_pipe:
        print("Error[vscode-pytest]: RUN_TEST_IDS_PIPE env var is not set.")
    raw_json = {}
    try:
        socket_name = os.environ.get("RUN_TEST_IDS_PIPE")
        with socket_manager.PipeManager(socket_name) as sock:
            buffer = ""
            while True:
                # Receive the data from the client as a string
                data = sock.read(3000)
                if not data:
                    break

                # Append the received data to the buffer
                buffer += data

                try:
                    # Try to parse the buffer as JSON
                    raw_json = process_json_util.process_rpc_json(buffer)
                    # Clear the buffer as complete JSON object is received
                    buffer = ""
                    print("Received JSON data in run script")
                    break
                except json.JSONDecodeError:
                    # JSON decoding error, the complete JSON object is not yet received
                    continue
                except UnicodeDecodeError:
                    continue
    except socket.error as e:
        print(f"Error: Could not connect to runTestIdsPort: {e}")
        print("Error: Could not connect to runTestIdsPort")
    try:
        test_ids_from_buffer = raw_json["params"]
        if test_ids_from_buffer:
            arg_array = ["-p", "vscode_pytest"] + args + test_ids_from_buffer
            print("Running pytest with args: " + str(arg_array))
            pytest.main(arg_array)
        else:
            print(
                "Error: No test ids received from stdin, could be an error or a run request without ids provided.",
            )
            print("Running pytest with no test ids as args. Args being used: ", args)
            arg_array = ["-p", "vscode_pytest"] + args
            pytest.main(arg_array)
    except json.JSONDecodeError:
        print(
            "Error: Could not parse test ids from stdin. Raw json received from socket: \n",
            raw_json,
        )

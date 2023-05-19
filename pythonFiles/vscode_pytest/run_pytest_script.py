# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.
import json
import os
import pathlib
import socket
import sys

import pytest

# Path to the directory you want to append
directory_path = pathlib.Path(__file__).parent.parent / "lib" / "python"
import os

sys.path.append(os.fspath(directory_path))
print(sys.path)

# Disable Flake8 rule for the next import statement
# flake8: noqa: E402
import debugpy

debugpy.connect(5678)
debugpy.breakpoint()

# This script handles running pytest via pytest.main(). It is called via run in the
# pytest execution adapter and gets the test_ids to run via stdin and the rest of the
# args through sys.argv. It then runs pytest.main() with the args and test_ids.

if __name__ == "__main__":
    # Add the root directory to the path so that we can import the plugin.
    directory_path = pathlib.Path(__file__).parent.parent
    sys.path.append(os.fspath(directory_path))
    # Get the rest of the args to run with pytest.
    args = sys.argv[1:]
    run_test_ids_port = os.environ.get("RUN_TEST_IDS_PORT")
    run_test_ids_port_int = 0
    if run_test_ids_port is not None:
        run_test_ids_port_int = int(run_test_ids_port)
    try:
        client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

        # Bind the socket to a specific address and port
        client_socket.connect(("localhost", run_test_ids_port_int))

        # Listen for incoming connections
        # client_socket.listen(1)
        print(f"Server listening on port {run_test_ids_port_int}...")

        while True:
            # Receive the data from the client
            # data = client_socket.recv(1024).decode("utf-8")
            data: bytes = client_socket.recv(1024 * 1024)
            print(f"Received data: {data}")

            # Close the client connection
            client_socket.close()
    except socket.error as e:
        print(f"Error: Could not connect to runTestIdsPort: {e}")
        print("Error: Could not connect to runTestIdsPort")
    try:
        # Load test_ids from stdin.
        test_ids = json.loads(sys.stdin.read())
        arg_array = ["-p", "vscode_pytest"] + args + test_ids
        pytest.main(arg_array)
    except json.JSONDecodeError:
        print("Error: Could not parse test ids from stdin")
    finally:
        print("PSTHAFS", os.environ.get("TEST_PORT"))

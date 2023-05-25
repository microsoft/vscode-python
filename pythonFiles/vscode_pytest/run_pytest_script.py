# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.
import io
import json
import os
import pathlib
import socket
import sys
from typing import List

import pytest

CONTENT_LENGTH: str = "Content-Length:"


def process_rpc_json(data: str) -> List[str]:
    """Process the JSON data which comes from the server which runs the pytest discovery."""
    str_stream: io.StringIO = io.StringIO(data)

    length: int = 0

    while True:
        line: str = str_stream.readline()
        if CONTENT_LENGTH.lower() in line.lower():
            length = int(line[len(CONTENT_LENGTH) :])
            break

        if not line or line.isspace():
            raise ValueError("Header does not contain Content-Length")

    while True:
        line: str = str_stream.readline()
        if not line or line.isspace():
            break

    raw_json: str = str_stream.read(length)
    return json.loads(raw_json)


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
    run_test_ids_port_int = (
        int(run_test_ids_port) if run_test_ids_port is not None else 0
    )
    test_ids_from_buffer = []
    try:
        client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        client_socket.connect(("localhost", run_test_ids_port_int))
        print(f"CLIENT: Server listening on port {run_test_ids_port_int}...")
        buffer = b""

        while True:
            # Receive the data from the client
            data = client_socket.recv(1024 * 1024)
            if not data:
                break

            # Append the received data to the buffer
            buffer += data

            try:
                # Try to parse the buffer as JSON
                test_ids_from_buffer = process_rpc_json(buffer.decode("utf-8"))
                # Clear the buffer as complete JSON object is received
                buffer = b""

                # Process the JSON data
                print(f"Received JSON data: {test_ids_from_buffer}")
                break
            except json.JSONDecodeError:
                # JSON decoding error, the complete JSON object is not yet received
                continue
    except socket.error as e:
        print(f"Error: Could not connect to runTestIdsPort: {e}")
        print("Error: Could not connect to runTestIdsPort")
    try:
        if test_ids_from_buffer:
            arg_array = ["-p", "vscode_pytest"] + args + test_ids_from_buffer
            pytest.main(arg_array)
    except json.JSONDecodeError:
        print("Error: Could not parse test ids from stdin")

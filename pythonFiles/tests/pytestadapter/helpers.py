# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
import io
import json
import os
import pathlib
import socket
import subprocess
import sys
import threading
import uuid
from typing import Any, Dict, List, Optional, Tuple

TEST_DATA_PATH = pathlib.Path(__file__).parent / ".data"
from typing_extensions import TypedDict


def create_server(
    host: str = "127.0.0.1",
    port: int = 0,
    backlog: int = socket.SOMAXCONN,
    timeout: int = 1000,
) -> socket.socket:
    """Return a local server socket listening on the given port."""
    server: socket.socket = _new_sock()
    if port:
        # If binding to a specific port, make sure that the user doesn't have
        # to wait until the OS times out waiting for socket in order to use
        # that port again if the server or the adapter crash or are force-killed.
        if sys.platform == "win32":
            server.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        else:
            try:
                server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            except (AttributeError, OSError):
                pass  # Not available everywhere
    server.bind((host, port))
    if timeout:
        server.settimeout(timeout)
    server.listen(backlog)
    return server


def _new_sock() -> socket.socket:
    sock: socket.socket = socket.socket(
        socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP
    )
    options = [
        ("SOL_SOCKET", "SO_KEEPALIVE", 1),
        ("IPPROTO_TCP", "TCP_KEEPIDLE", 1),
        ("IPPROTO_TCP", "TCP_KEEPINTVL", 3),
        ("IPPROTO_TCP", "TCP_KEEPCNT", 5),
    ]

    for level, name, value in options:
        try:
            sock.setsockopt(getattr(socket, level), getattr(socket, name), value)
        except (AttributeError, OSError):
            pass  # May not be available everywhere.

    return sock


CONTENT_LENGTH: str = "Content-Length:"
Env_Dict = TypedDict(
    "Env_Dict", {"TEST_UUID": str, "TEST_PORT": str, "PYTHONPATH": str}
)


def process_rpc_message(data: str) -> Tuple[Dict[str, Any], str]:
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
    dict_json: Dict[str, Any] = json.loads(raw_json)
    return dict_json, str_stream.read()


def runner(args: List[str]) -> Optional[List[Dict[str, Any]]]:
    """Run the pytest discovery and return the JSON data from the server."""
    process_args: List[str] = [
        sys.executable,
        "-m",
        "pytest",
        "-p",
        "vscode_pytest",
    ] + args
    listener: socket.socket = create_server()
    _, port = listener.getsockname()
    listener.listen()

    env = os.environ.copy()
    env.update(
        {
            "TEST_UUID": str(uuid.uuid4()),
            "TEST_PORT": str(port),
            "PYTHONPATH": os.fspath(pathlib.Path(__file__).parent.parent.parent),
        }
    )

    result: list = []
    t1: threading.Thread = threading.Thread(
        target=_listen_on_socket, args=(listener, result)
    )
    t1.start()

    t2 = threading.Thread(
        target=lambda proc_args, proc_env, proc_cwd: subprocess.run(
            proc_args, env=proc_env, cwd=proc_cwd
        ),
        args=(process_args, env, TEST_DATA_PATH),
    )
    t2.start()

    t1.join()
    t2.join()

    a = process_rpc_json(result[0])
    return a if result else None


def process_rpc_json(data: str) -> List[Dict[str, Any]]:
    """Process the JSON data which comes from the server which runs the pytest discovery."""
    json_messages = []
    remaining = data
    while remaining:
        json_data, remaining = process_rpc_message(remaining)
        json_messages.append(json_data)

    return json_messages


def _listen_on_socket(listener: socket.socket, result: List[str]):
    """Listen on the socket for the JSON data from the server.
    Created as a seperate function for clarity in threading.
    """
    sock, (other_host, other_port) = listener.accept()
    all_data: list = []
    while True:
        data: bytes = sock.recv(1024 * 1024)
        if not data:
            break
        all_data.append(data.decode("utf-8"))
    result.append("".join(all_data))


def find_test_line_number(test_name: str, test_file_path) -> str:
    """Function which finds the correct line number for a test by looking for the "test_marker--[test_name]" string.

    The test_name is split on the "[" character to remove the parameterization information.

    Args:
    test_name: The name of the test to find the line number for, will be unique per file.
    test_file_path: The path to the test file where the test is located.
    """
    test_file_unique_id: str = "test_marker--" + test_name.split("[")[0]
    with open(test_file_path) as f:
        for i, line in enumerate(f):
            if test_file_unique_id in line:
                return str(i + 1)
    error_str: str = f"Test {test_name!r} not found on any line in {test_file_path}"
    raise ValueError(error_str)

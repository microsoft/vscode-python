# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import contextlib
import io
import json
import os
import pathlib
import socket
import subprocess
import sys
import tempfile
import threading
from typing import Any, Dict, List, Optional, Tuple
import uuid

# CHECK THIS
if os.name == "nt":
    from namedpipe import NPopen


script_dir = pathlib.Path(__file__).parent.parent.parent
script_dir_child = pathlib.Path(__file__).parent.parent
sys.path.append(os.fspath(script_dir))
sys.path.append(os.fspath(script_dir_child))
sys.path.append(os.fspath(script_dir / "lib" / "python"))
print("sys add path", script_dir)
TEST_DATA_PATH = pathlib.Path(__file__).parent / ".data"


# class PipeManager:
#     def __init__(self, name):
#         self.name = name

#     def __enter__(self):
#         return self.listen()

#     def __exit__(self, *_):
#         self.close()

#     def listen(self):
#         # find library that creates named pipes for windows
#         if sys.platform == "win32":
#             print("current not enabled for windows")

#         else:
#             server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
#             server.listen(self.name)  # self.name = named pipe
#             (
#                 _sock,
#                 _,
#             ) = server.accept()  # occurs when client connects, returns a socket (_sock) which will be used for this specific
#             # client and server connection
#             self._socket = _sock
#         return self

#     def close(self):
#         if sys.platform == "win32":
#             self._writer.close()
#             # close the streams and the pipe
#         else:
#             # add exception catch
#             self._socket.close()

#     def write(self, data: str):
#         # must include the carriage-return defined (as \r\n) for unix systems
#         request = f"""content-length: {len(data)}\r\ncontent-type: application/json\r\n\r\n{data}"""
#         if sys.platform == "win32":
#             # this should work
#             self._writer.write(request)
#             self._writer.flush()
#         else:
#             self._socket.send(request.encode("utf-8"))
#             # does this also need a flush on the socket?

#     def read(self, bufsize=1024):
#         """Read data from the socket.

#         Args:
#             bufsize (int): Number of bytes to read from the socket.

#         Returns:
#             data (bytes): Data received from the socket.
#         """
#         if sys.platform == "win32":
#             # this should work
#             return self._reader.read(bufsize)
#         else:
#             data = b""
#             while True:
#                 part = self._socket.recv(bufsize)
#                 data += part
#                 if len(part) < bufsize:
#                     # No more data, or less than bufsize data received
#                     break
#             return data


# async def create_pipe(test_run_pipe: str) -> PipeManager:
#     __pipe = PipeManager(test_run_pipe)
#     return __pipe


CONTENT_LENGTH: str = "Content-Length:"
CONTENT_TYPE: str = "Content-Type:"


@contextlib.contextmanager
def create_symlink(root: pathlib.Path, target_ext: str, destination_ext: str):
    destination = None
    try:
        destination = root / destination_ext
        target = root / target_ext
        if destination and destination.exists():
            print("destination already exists", destination)
        try:
            destination.symlink_to(target)
        except Exception as e:
            print("error occurred when attempting to create a symlink", e)
        yield target, destination
    finally:
        if destination and destination.exists():
            destination.unlink()
        print("destination unlinked", destination)


def process_data_received(data: str) -> List[Dict[str, Any]]:
    """Process the all JSON data which comes from the server. After listen is finished, this function will be called.
    Here the data must be split into individual JSON messages and then parsed.

    This function also:
    - Checks that the jsonrpc value is 2.0
    - Checks that the last JSON message contains the `eot` token.

    """
    json_messages = []
    remaining = data
    while remaining:
        json_data, remaining = parse_rpc_message(remaining)
        # here json_data is a single rpc payload, now check its jsonrpc 2 and save the param data
        if "params" not in json_data or "jsonrpc" not in json_data:
            raise ValueError("Invalid JSON-RPC message received, missing params or jsonrpc key")
        elif json_data["jsonrpc"] != "2.0":
            raise ValueError("Invalid JSON-RPC version received, not version 2.0")
        else:
            json_messages.append(json_data["params"])

    last_json = json_messages.pop(-1)
    if "eot" not in last_json:
        raise ValueError("Last JSON messages does not contain 'eot' as its last payload.")
    return (
        json_messages  # return the list of json messages, only the params part with the EOT token
    )


def parse_rpc_message(data: str) -> Tuple[Dict[str, str], str]:
    """Process the JSON data which comes from the server.
    returns:
    json_data: A single rpc payload of JSON data from the server.
    remaining: The remaining data after the JSON data."""
    str_stream: io.StringIO = io.StringIO(data)

    # 'content-length: 1944\r\ncontent-type: application/json\r\n\r\n{"jsonrpc": "2.0", "params": {"command_type": "discovery",
    # ...]}}content-length: 72\r\ncontent-type: application/json\r\n\r\n{"jsonrpc": "2.0", "params": {"command_type": "discovery", "eot": true}}'

    length: int = 0
    while True:
        line: str = str_stream.readline()
        if CONTENT_LENGTH.lower() in line.lower():
            length = int(line[len(CONTENT_LENGTH) :])

            line: str = str_stream.readline()
            if CONTENT_TYPE.lower() not in line.lower():
                raise ValueError("Header does not contain Content-Type")

            line = str_stream.readline()
            if line not in ["\r\n", "\n"]:
                raise ValueError("Header does not contain space to separate header and body")
            # if it passes all these checks then it has the right headers
            break

        if not line or line.isspace():
            raise ValueError("Header does not contain Content-Length")

    while True:  # keep reading until the number of bytes is the CONTENT_LENGTH
        line: str = str_stream.readline(length)
        try:
            # try to parse the json, if successful it is single payload so return with remaining data
            json_data: dict[str, str] = json.loads(line)
            return json_data, str_stream.read()
        except json.JSONDecodeError:
            print("json decode error")


# def listen_on_pipe_manager():


def _listen_on_pipe_new(listener, result: List[str], completed: threading.Event):
    """Listen on the named pipe or Unix domain socket for JSON data from the server.
    Created as a separate function for clarity in threading context.
    """
    # Accept a connection. Note: For named pipes, the accept method might be different.
    if os.name == "nt":
        # windows design
        print("listen on pipe new for windows")
        # accept a connection
        # set a timeout
        # create a data array
        all_data: list = []
        stream = listener.wait()
        while True:
            # Read data from collection
            close = stream.closed
            if close:
                break
            data = stream.readlines()
            if not data:
                if completed.is_set():
                    break  # Exit loop if completed event is set
            else:
                try:
                    # Attempt to accept another connection if the current one closes unexpectedly
                    print("attempt another connection")
                except socket.timeout:
                    # On timeout, append all collected data to result and return
                    # result.append("".join(all_data))
                    return
            data_decoded = "".join(data)
            all_data.append(data_decoded)
        # Append all collected data to result array
        result.append("".join(all_data))
        #
    else:
        connection, _ = listener.socket.accept()
        listener.socket.settimeout(1)
        all_data: list = []
        while True:
            # Reading from connection
            data: bytes = connection.recv(
                1024 * 1024
            )  # You might replace this with connection.read() based on your abstraction
            if not data:
                if completed.is_set():
                    break  # Exit loop if completed event is set
                else:
                    try:
                        # Attempt to accept another connection if the current one closes unexpectedly
                        connection, _ = listener.socket.accept()
                    except socket.timeout:
                        # On timeout, append all collected data to result and return
                        result.append("".join(all_data))
                        return
            all_data.append(data.decode("utf-8"))
        # Append all collected data to result array
        result.append("".join(all_data))


def _run_test_code(proc_args: List[str], proc_env, proc_cwd: str, completed: threading.Event):
    result = subprocess.run(proc_args, env=proc_env, cwd=proc_cwd)
    completed.set()
    return result


def runner(args: List[str]) -> Optional[List[Dict[str, Any]]]:
    """Run the pytest discovery and return the JSON data from the server."""
    print("\n TEST_DATA_PATH::: ", TEST_DATA_PATH)
    print("args to run with::: ", args)
    return runner_with_cwd(args, TEST_DATA_PATH)


def runner_with_cwd(args: List[str], path: pathlib.Path) -> Optional[List[Dict[str, Any]]]:
    """Run the pytest discovery and return the JSON data from the server."""
    process_args: List[str] = [
        sys.executable,
        "-m",
        "pytest",
        "-p",
        "vscode_pytest",
        "-s",
    ] + args

    # already windows compatible name
    pipe_name = generate_random_pipe_name("pytest-discovery-test")
    print("pipe name generated", pipe_name)

    # unix
    if os.name == "nt":
        #     # TODO: for windows
        #     print("windows machine detected")
        with NPopen("rt", name=pipe_name) as pipe:  # Added a `name` parameter
            env = os.environ.copy()
            env.update(
                {
                    "TEST_RUN_PIPE": pipe.path,
                    "PYTHONPATH": os.fspath(pathlib.Path(__file__).parent.parent.parent),
                }
            )
            completed = threading.Event()

            result = []  # result is a string array to store the data during threading
            t1: threading.Thread = threading.Thread(
                target=_listen_on_pipe_new, args=(pipe, result, completed)
            )
            t1.start()

            t2 = threading.Thread(
                target=_run_test_code,
                args=(process_args, env, path, completed),
            )
            t2.start()

            t1.join()
            t2.join()

            return process_data_received(result[0]) if result else None
    else:
        # unix etc
        server = UnixPipeServer(pipe_name)
        server.start()

        #

        env = os.environ.copy()
        env.update(
            {
                "TEST_RUN_PIPE": pipe_name,
                "PYTHONPATH": os.fspath(pathlib.Path(__file__).parent.parent.parent),
            }
        )
        completed = threading.Event()

        result = []  # result is a string array to store the data during threading
        t1: threading.Thread = threading.Thread(
            target=_listen_on_pipe_new, args=(server, result, completed)
        )
        t1.start()

        t2 = threading.Thread(
            target=_run_test_code,
            args=(process_args, env, path, completed),
        )
        t2.start()

        t1.join()
        t2.join()

        return process_data_received(result[0]) if result else None


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


def get_absolute_test_id(test_id: str, testPath: pathlib.Path) -> str:
    split_id = test_id.split("::")[1:]
    absolute_test_id = "::".join([str(testPath), *split_id])
    print("absolute path", absolute_test_id)
    return absolute_test_id


def generate_random_pipe_name(prefix=""):
    # Generate a random suffix using UUID4, ensuring uniqueness.
    random_suffix = uuid.uuid4().hex[:10]
    # Default prefix if not provided.
    if not prefix:
        prefix = "python-ext-rpc"

    # For Windows, named pipes have a specific naming convention.
    if os.name == "nt":
        return f"\\\\.\\pipe\\{prefix}-{random_suffix}-sock"

    # For Unix-like systems, use either the XDG_RUNTIME_DIR or a temporary directory.
    xdg_runtime_dir = os.getenv("XDG_RUNTIME_DIR")
    if xdg_runtime_dir:
        return os.path.join(xdg_runtime_dir, f"{prefix}-{random_suffix}.sock")
    else:
        return os.path.join(tempfile.gettempdir(), f"{prefix}-{random_suffix}.sock")


# Create a server socket for the given pipe name.
class UnixPipeServer:
    def __init__(self, name):
        self.name = name
        self.is_windows = sys.platform == "win32"
        if self.is_windows:
            raise NotImplementedError(
                "This class is only intended for Unix-like systems, not Windows."
            )
        else:
            # For Unix-like systems, use a Unix domain socket.
            self.socket = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            # Ensure the socket does not already exist
            try:
                os.unlink(self.name)
            except OSError:
                if os.path.exists(self.name):
                    raise

    def start(self):
        if self.is_windows:
            raise NotImplementedError(
                "This class is only intended for Unix-like systems, not Windows."
            )
        else:
            # Bind the socket to the address and listen for incoming connections.
            self.socket.bind(self.name)
            self.socket.listen(1)
            print(f"Server listening on {self.name}")

            # Accept a single connection. remove for now to use the listener
            # self.handle_single_connection()

    # def handle_single_connection(self):
    #     """Accept and handle a single connection."""
    #     connection = None
    #     try:
    #         # Accept a connection.
    #         connection, client_address = self.socket.accept()
    #         print(f"Client connected from {client_address}")

    #         # Enter a loop to read and respond to messages from the client.
    #         while True:
    #             data = connection.recv(1024)
    #             if data:
    #                 message = data.decode("utf-8")
    #                 print(f"Received: {message}")
    #                 # Echo the received data back to the client as an example response.
    #                 connection.sendall(data)
    #             else:
    #                 # No more data from the client, break the loop.
    #                 break
    #     finally:
    #         # Clean up the connection.
    #         if connection:
    #             connection.close()
    #         print("Client disconnected.")

    #         # After handling the single connection, the server stops listening.
    #         self.stop()

    def stop(self):
        # Clean up the server socket.
        self.socket.close()
        print("Server stopped.")

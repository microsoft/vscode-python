# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import contextlib
import socket
import sys

# set the socket before it gets blocked or overwritten by a user tests
_SOCKET = socket.socket


class PipeManager:
    def __init__(self, name):
        self.name = name

    def __enter__(self):
        return self.connect()

    def __exit__(self, *_):
        self.close()

    def connect(self):
        if sys.platform == "win32":
            self._writer = open(self.name, "w", encoding="utf-8")  # noqa: SIM115, PTH123
            # reader created in read method
        else:
            self._socket = _SOCKET(socket.AF_UNIX, socket.SOCK_STREAM)
            self._socket.connect(self.name)
        return self

    def close(self):
        if sys.platform == "win32":
            self._writer.close()
        else:
            # add exception catch
            self._socket.close()

    def write(self, data: str):
        if sys.platform == "win32":
            try:
                # for windows, is should only use \n\n
                request = (
                    f"""content-length: {len(data)}\ncontent-type: application/json\n\n{data}"""
                )
                self._writer.write(request)
                self._writer.flush()
            except Exception as e:
                print("error attempting to write to pipe", e)
                raise (e)
        else:
            # must include the carriage-return defined (as \r\n) for unix systems
            request = (
                f"""content-length: {len(data)}\r\ncontent-type: application/json\r\n\r\n{data}"""
            )
            self._socket.send(request.encode("utf-8"))

    def read(self, bufsize=1024) -> str:
        """Read data from the socket.

        Args:
            bufsize (int): Number of bytes to read from the socket.

        Returns:
            data (str): Data received from the socket.
        """
        if sys.platform == "win32":
            # returns a string automatically from read
            if not hasattr(self, "_reader"):
                self._reader = open(self.name, encoding="utf-8")  # noqa: SIM115, PTH123
            return self._reader.read(bufsize)
        else:
            # receive bytes and convert to string
            while True:
                part: bytes = self._socket.recv(bufsize)
                data: str = part.decode("utf-8")
                return data


class SocketManager:
    """Create a socket and connect to the given address.

    The address is a (host: str, port: int) tuple.
    Example usage:

    ```
    with SocketManager(("localhost", 6767)) as sock:
        request = json.dumps(payload)
        result = s.socket.sendall(request.encode("utf-8"))
    ```
    """

    def __init__(self, addr):
        self.addr = addr
        self.socket = None

    def __enter__(self):
        return self.connect()

    def __exit__(self, *_):
        self.close()

    def connect(self):
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP)
        if sys.platform == "win32":
            addr_use = socket.SO_EXCLUSIVEADDRUSE
        else:
            addr_use = socket.SO_REUSEADDR
        self.socket.setsockopt(socket.SOL_SOCKET, addr_use, 1)
        self.socket.connect(self.addr)

        return self

    def close(self):
        if self.socket:
            with contextlib.suppress(Exception):
                self.socket.shutdown(socket.SHUT_RDWR)
            self.socket.close()

# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import socket
import sys


class SocketManager(object):
    def __init__(self, addr):
        self.socket = None
        self.addr = addr

    def __enter__(self):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP)
        if sys.platform == "win32":
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        else:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.socket = sock
        sock.connect(self.addr)

        return self

    def __exit__(self, type, value, tb):
        if self.socket:
            try:
                self.socket.shutdown(socket.SHUT_RDWR)
            except Exception:
                pass
            self.socket.close()

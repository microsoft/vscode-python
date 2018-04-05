from __future__ import absolute_import

import contextlib
import errno
import socket


NOT_CONNECTED = (
    errno.ENOTCONN,
    errno.EBADF,
)


def create_server(port):
    """Return a local server socket listening on the given port."""
    server = _new_sock()
    server.bind(('127.0.0.1', port))
    server.listen(1)
    return server


def create_client():
    """Return a client socket that may be connected to a remote address."""
    return _new_sock()


def _new_sock():
    sock = socket.socket(socket.AF_INET,
                         socket.SOCK_STREAM,
                         socket.IPPROTO_TCP)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    return sock


@contextlib.contextmanager
def ignored_errno(*ignored):
    """A context manager that ignores the given errnos."""
    try:
        yield
    except OSError as exc:
        if exc.errno not in ignored:
            raise


def shut_down(sock, how=socket.SHUT_RDWR, ignored=NOT_CONNECTED):
    """Shut down the given socket."""
    with ignored_errno(*ignored or ()):
        sock.shutdown(how)


def close_socket(sock):
    """Shutdown and close the socket."""
    try:
        shut_down(sock)
    except Exception:
        pass
    sock.close()

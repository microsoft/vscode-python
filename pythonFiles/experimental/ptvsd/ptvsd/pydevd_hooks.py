import sys

from _pydevd_bundle import pydevd_comm

from ptvsd.socket import create_server, create_client
from ptvsd.daemon import Daemon


def start_server(daemon, port):
    """Return a socket to a (new) local pydevd-handling daemon.

    The daemon supports the pydevd client wire protocol, sending
    requests and handling responses (and events).

    This is a replacement for _pydevd_bundle.pydevd_comm.start_server.
    """
    server = create_server(port)
    client, _ = server.accept()

    pydevd = daemon.start(server)
    daemon.set_connection(client)
    return pydevd


def start_client(daemon, host, port):
    """Return a socket to an existing "remote" pydevd-handling daemon.

    The daemon supports the pydevd client wire protocol, sending
    requests and handling responses (and events).

    This is a replacement for _pydevd_bundle.pydevd_comm.start_client.
    """
    client = create_client()
    client.connect((host, port))

    pydevd = daemon.start()
    daemon.set_connection(client)
    return pydevd


def install(pydevd, start_server=start_server, start_client=start_client):
    """Configure pydevd to use our wrapper.

    This is a bit of a hack to allow us to run our VSC debug adapter
    in the same process as pydevd.  Note that, as with most hacks,
    this is somewhat fragile (since the monkeypatching sites may
    change).
    """
    daemon = Daemon()

    _start_server = (lambda p: start_server(daemon, p))
    _start_server.orig = start_server
    _start_client = (lambda h, p: start_client(daemon, h, p))
    _start_client.orig = start_client

    # These are the functions pydevd invokes to get a socket to the client.
    pydevd_comm.start_server = _start_server
    pydevd_comm.start_client = _start_client

    # Ensure that pydevd is using our functions.
    pydevd.start_server = _start_server
    pydevd.start_client = _start_client
    __main__ = sys.modules['__main__']
    if __main__ is not pydevd and __main__.__file__ == pydevd.__file__:
        __main__.start_server = _start_server
        __main__.start_client = _start_client
    return daemon

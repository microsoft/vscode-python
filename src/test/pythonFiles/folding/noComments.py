__author__ = "Microsoft Corporation <ptvshelp@microsoft.com>"
__version__ = "3.0.0.0"

__all__ = ['enable_attach', 'wait_for_attach', 'break_into_debugger', 'settrace', 'is_attached', 'AttachAlreadyEnabledError']

import atexit
import getpass
import os
import os.path
import platform
import socket
import struct
import sys
import threading
try:
    import thread
except ImportError:
    import _thread as thread
try:
    import ssl
except ImportError:
    ssl = None

import ptvsd.visualstudio_py_debugger as vspd
import ptvsd.visualstudio_py_repl as vspr
from ptvsd.visualstudio_py_util import to_bytes, read_bytes, read_int, read_string, write_bytes, write_int, write_string

PTVS_VER = '2.2'
DEFAULT_PORT = 5678
PTVSDBG_VER = 6
PTVSDBG = to_bytes('PTVSDBG')
ACPT = to_bytes('ACPT')
RJCT = to_bytes('RJCT')
INFO = to_bytes('INFO')
ATCH = to_bytes('ATCH')
REPL = to_bytes('REPL')

_attach_enabled = False
_attached = threading.Event()
vspd.DONT_DEBUG.append(os.path.normcase(__file__))


class AttachAlreadyEnabledError(Exception):
    """`ptvsd.enable_attach` has already been called in this process."""


def enable_attach(secret, address = ('0.0.0.0', DEFAULT_PORT), certfile = None, keyfile = None, redirect_output = True):
    """Enables Python Tools for Visual Studio to attach to this process remotely
    to debug Python code.

    Parameters
    ----------
    secret : str
        Used to validate the clients - only those clients providing the valid
        secret will be allowed to connect to this server. On client side, the
        secret is prepended to the Qualifier string, separated from the
        hostname by ``'@'``, e.g.: ``'secret@myhost.cloudapp.net:5678'``. If
        secret is ``None``, there's no validation, and any client can connect
        freely.
    address : (str, int), optional
        Specifies the interface and port on which the debugging server should
        listen for TCP connections. It is in the same format as used for
        regular sockets of the `socket.AF_INET` family, i.e. a tuple of
        ``(hostname, port)``. On client side, the server is identified by the
        Qualifier string in the usual ``'hostname:port'`` format, e.g.:
        ``'myhost.cloudapp.net:5678'``. Default is ``('0.0.0.0', 5678)``.
    certfile : str, optional
        Used to enable SSL. If not specified, or if set to ``None``, the
        connection between this program and the debugger will be unsecure,
        and can be intercepted on the wire. If specified, the meaning of this
        parameter is the same as for `ssl.wrap_socket`.
    keyfile : str, optional
        Used together with `certfile` when SSL is enabled. Its meaning is the
        same as for ``ssl.wrap_socket``.
    redirect_output : bool, optional
        Specifies whether any output (on both `stdout` and `stderr`) produced
        by this program should be sent to the debugger. Default is ``True``.

    Notes
    -----
    This function returns immediately after setting up the debugging server,
    and does not block program execution. If you need to block until debugger
    is attached, call `ptvsd.wait_for_attach`. The debugger can be detached
    and re-attached multiple times after `enable_attach` is called.

    This function can only be called once during the lifetime of the process.
    On a second call, `AttachAlreadyEnabledError` is raised. In circumstances
    where the caller does not control how many times the function will be
    called (e.g. when a script with a single call is run more than once by
    a hosting app or framework), the call should be wrapped in ``try..except``.

    Only the thread on which this function is called, and any threads that are
    created after it returns, will be visible in the debugger once it is
    attached. Any threads that are already running before this function is
    called will not be visible.
    """

    if not ssl and (certfile or keyfile):
        raise ValueError('could not import the ssl module - SSL is not supported on this version of Python')

    if sys.platform == 'cli':
        import clr
        x_tracing = clr.GetCurrentRuntime().GetLanguageByExtension('py').Options.Tracing
        x_frames = clr.GetCurrentRuntime().GetLanguageByExtension('py').Options.Frames
        if not x_tracing or not x_frames:
            raise RuntimeError('IronPython must be started with -X:Tracing and -X:Frames options to support PTVS remote debugging.')

    global _attach_enabled
    if _attach_enabled:
        raise AttachAlreadyEnabledError('ptvsd.enable_attach() has already been called in this process.')
    _attach_enabled = True

    atexit.register(vspd.detach_process_and_notify_debugger)

    server = socket.socket(proto=socket.IPPROTO_TCP)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(address)
    server.listen(1)
    def server_thread_func():
        while True:
            client = None
            raw_client = None
            try:
                client, addr = server.accept()
                if certfile:
                    client = ssl.wrap_socket(client, server_side = True, ssl_version = ssl.PROTOCOL_TLSv1, certfile = certfile, keyfile = keyfile)
                write_bytes(client, PTVSDBG)
                write_int(client, PTVSDBG_VER)

                response = read_bytes(client, 7)
                if response != PTVSDBG:
                    continue
                dbg_ver = read_int(client)
                if dbg_ver != PTVSDBG_VER:
                    continue

                client_secret = read_string(client)
                if secret is None or secret == client_secret:
                    write_bytes(client, ACPT)
                else:
                    write_bytes(client, RJCT)
                    continue

                response = read_bytes(client, 4)

                if response == INFO:
                    try:
                        pid = os.getpid()
                    except AttributeError:
                        pid = 0
                    write_int(client, pid)

                    exe = sys.executable or ''
                    write_string(client, exe)

                    try:
                        username = getpass.getuser()
                    except AttributeError:
                        username = ''
                    write_string(client, username)

                    try:
                        impl = platform.python_implementation()
                    except AttributeError:
                        try:
                            impl = sys.implementation.name
                        except AttributeError:
                            impl = 'Python'

                    major, minor, micro, release_level, serial = sys.version_info

                    os_and_arch = platform.system()
                    if os_and_arch == "":
                        os_and_arch = sys.platform
                    try:
                        if sys.maxsize > 2**32:
                            os_and_arch += ' 64-bit'
                        else:
                            os_and_arch += ' 32-bit'
                    except AttributeError:
                        pass

                    version = '%s %s.%s.%s (%s)' % (impl, major, minor, micro, os_and_arch)
                    write_string(client, version)

                    client.recv(1)

                elif response == ATCH:
                    debug_options = vspd.parse_debug_options(read_string(client))
                    if redirect_output:
                        debug_options.add('RedirectOutput')

                    if vspd.DETACHED:
                        write_bytes(client, ACPT)
                        try:
                            pid = os.getpid()
                        except AttributeError:
                            pid = 0
                        write_int(client, pid)

                        major, minor, micro, release_level, serial = sys.version_info
                        write_int(client, major)
                        write_int(client, minor)
                        write_int(client, micro)

                        vspd.attach_process_from_socket(client, debug_options, report = True)
                        vspd.mark_all_threads_for_break(vspd.STEPPING_ATTACH_BREAK)
                        _attached.set()
                        client = None
                    else:
                        write_bytes(client, RJCT)

                elif response == REPL:
                    if not vspd.DETACHED:
                        write_bytes(client, ACPT)
                        vspd.connect_repl_using_socket(client)
                        client = None
                    else:
                        write_bytes(client, RJCT)

            except (socket.error, OSError):
                pass
            finally:
                if client is not None:
                    client.close()

    server_thread = threading.Thread(target = server_thread_func)
    server_thread.setDaemon(True)
    server_thread.start()

    frames = []
    f = sys._getframe()
    while True:
        f = f.f_back
        if f is None:
            break
        frames.append(f)
    frames.reverse()
    cur_thread = vspd.new_thread()
    for f in frames:
        cur_thread.push_frame(f)
    def replace_trace_func():
        for f in frames:
            f.f_trace = cur_thread.trace_func
    replace_trace_func()
    sys.settrace(cur_thread.trace_func)
    vspd.intercept_threads(for_attach = True)


settrace = enable_attach


def wait_for_attach(timeout = None):
    """If a PTVS remote debugger is attached, returns immediately. Otherwise,
    blocks until a remote debugger attaches to this process, or until the
    optional timeout occurs.

    Parameters
    ----------
    timeout : float, optional
        The timeout for the operation in seconds (or fractions thereof).
    """
    if vspd.DETACHED:
        _attached.clear()
        _attached.wait(timeout)


def break_into_debugger():
    """If a PTVS remote debugger is attached, pauses execution of all threads,
    and breaks into the debugger with current thread as active.
    """
    if not vspd.DETACHED:
        vspd.SEND_BREAK_COMPLETE = thread.get_ident()
        vspd.mark_all_threads_for_break()

def is_attached():
    """Returns ``True`` if debugger is attached, ``False`` otherwise."""
    return not vspd.DETACHED

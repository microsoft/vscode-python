# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os
import sys
import logging
from datascience.daemon.daemon_constants import IS_PY2, IS_PY3
from threading import Lock

log = logging.getLogger(__name__)


class IORedirector:
    """
    This class works to wrap a stream (stdout/stderr) with an additional redirect.
    """

    def __init__(self, original, new_redirect, wrap_buffer=False):
        """
        :param stream original:
            The stream to be wrapped (usually stdout/stderr, but could be None).

        :param stream new_redirect:

        :param bool wrap_buffer:
            Whether to create a buffer attribute (needed to mimick python 3 s
            tdout/stderr which has a buffer to write binary data).
        """
        self._lock = Lock()
        self._writing = False
        self._original = original
        self._new_redirect = new_redirect
        self._redirect_to = (new_redirect,)
        if wrap_buffer and hasattr(original, "buffer"):
            self.buffer = IORedirector(original.buffer, new_redirect.buffer, False)

    def disable_redirection(self):
        """ Restores the original stream, thereby temporarily disabling the redirection."""
        self._redirect_to = (self._original,)

    def enable_redirection(self):
        """ Restores the redirection stream."""
        self._redirect_to = (self._new_redirect,)

    def write(self, s):
        # Note that writing to the original stream may fail for some reasons
        # (such as trying to write something that's not a string or having it closed).
        with self._lock:
            if self._writing:
                return
            self._writing = True
            try:
                for r in self._redirect_to:
                    if hasattr(r, "write"):
                        r.write(s)
            finally:
                self._writing = False

    def isatty(self):
        for r in self._redirect_to:
            if hasattr(r, "isatty"):
                return r.isatty()
        return False

    def flush(self):
        for r in self._redirect_to:
            if hasattr(r, "flush"):
                r.flush()

    def __getattr__(self, name):
        log.info("getting attr for stdout: " + name)
        for r in self._redirect_to:
            if hasattr(r, name):
                return getattr(r, name)
        raise AttributeError(name)


class CustomWriter(object):
    def __init__(self, wrap_stream, wrap_buffer, on_write=None):
        """
        :param wrap_stream:
            Either sys.stdout or sys.stderr.

        :param bool wrap_buffer:
            If True the buffer attribute (which wraps writing bytes) should be
            wrapped.

        :param callable(str) on_write:
            Call back with the string that has been written.
        """
        encoding = getattr(wrap_stream, "encoding", None)
        self._enabled = True
        if not encoding:
            encoding = os.environ.get("PYTHONIOENCODING", "utf-8")
        self.encoding = encoding
        self._wrap_buffer = wrap_buffer
        if wrap_buffer:
            log.info('wrap')
            self.buffer = CustomWriter(
                wrap_stream, wrap_buffer=False, on_write=on_write
            )
        self._on_write = on_write

    def disable_redirection(self):
        """ Restores the original stream, thereby temporarily disabling the redirection."""
        log.info('Disable redirection')
        if self._wrap_buffer:
            self.buffer.disable_redirection()
        self._enabled = False

    def enable_redirection(self):
        """ Restores the redirection stream."""
        if self._wrap_buffer:
            self.buffer.enable_redirection()
        self._enabled = True

    def flush(self):
        pass  # no-op here

    def write(self, s):
        log.info('Enabled %s', self._enabled)
        if self._enabled and s:
            if IS_PY2:
                # Need s in utf-8 bytes
                if isinstance(s, unicode):  # noqa
                    s = s.encode("utf-8", "replace")
                else:
                    s = s.decode(self.encoding, "replace").encode("utf-8", "replace")

            else:
                # Need s in str
                if isinstance(s, bytes):
                    s = s.decode(self.encoding, errors="replace")
            log.info("write to stdout/stderr: " + s)
            if self._on_write is not None:
                self._on_write(s)


def _binary_stdio():
    """Construct binary stdio streams (not text mode).
    check `from_stdio` in https://github.com/microsoft/ptvsd/blob/fad3c4f8785cf185cdb4c9c769467c1e27784cf0/src/ptvsd/common/messaging.py#L76
    """

    if IS_PY3:
        # pylint: disable=no-member
        stdin, stdout = sys.stdin.buffer, sys.stdout.buffer
    else:
        # Python 2 on Windows opens sys.stdin in text mode, and
        # binary data that read from it becomes corrupted on \r\n
        if sys.platform == "win32":
            # set sys.stdin to binary mode
            # pylint: disable=no-member,import-error
            import os
            import msvcrt

            msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
            msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)
        stdin, stdout = sys.stdin, sys.stdout

    return stdin, stdout


_stdin, _stdout = _binary_stdio()

def get_io_buffers():
    return _stdin, _stdout


def redirect_output(stdout_handler, stderr_handler):
    log.info("Redirect stdout/stderr")
    wrap_buffer = True if not IS_PY2 else False

    sys._vsc_out_buffer_ = CustomWriter(sys.stdout, wrap_buffer, stdout_handler)
    sys.stdout_original = sys.stdout
    _stdout_redirector = sys.stdout = IORedirector(sys.stdout, sys._vsc_out_buffer_, wrap_buffer)

    sys._vsc_err_buffer_ = CustomWriter(sys.stderr, wrap_buffer, stderr_handler)
    sys.stderr_original = sys.stderr
    _stderr_redirector = sys.stderr = IORedirector(sys.stderr, sys._vsc_err_buffer_, wrap_buffer)


def disable_redirection():
    log.info("Disable redirecting stdout/stderr")
    sys._vsc_out_buffer_.disable_redirection()
    sys._vsc_err_buffer_.disable_redirection()
    sys.stdout.disable_redirection()
    sys.stderr.disable_redirection()

def enable_redirection():
    log.info("Enable redirecting stdout/stderr")
    sys._vsc_out_buffer_.enable_redirection()
    sys._vsc_err_buffer_.enable_redirection()
    sys.stdout.enable_redirection()
    sys.stderr.enable_redirection()

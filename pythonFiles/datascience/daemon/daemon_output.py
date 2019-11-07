# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

# Code borrowed from `pydevd` (https://github.com/microsoft/ptvsd/blob/608803cb99b450aedecc45167a7339b9b7b93b75/src/ptvsd/_vendored/pydevd/pydevd.py)

import os
import sys
import logging
from threading import Lock

log = logging.getLogger(__name__)


class IORedirector:
    """
    This class works to wrap a stream (stdout/stderr) with an additional redirect.
    """

    def __init__(self, name, original, new_redirect, wrap_buffer=False):
        """
        :param stream original:
            The stream to be wrapped (usually stdout/stderr, but could be None).

        :param stream new_redirect:

        :param bool wrap_buffer:
            Whether to create a buffer attribute (needed to mimick python 3 s
            tdout/stderr which has a buffer to write binary data).
        """
        self._name = name
        self._lock = Lock()
        self._writing = False
        self._redirect_to = (new_redirect,)
        if wrap_buffer and hasattr(original, "buffer"):
            self.buffer = IORedirector(
                name, original.buffer, new_redirect.buffer, False
            )

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
        log.info("getting attr for %s: %s", self._name, name)
        for r in self._redirect_to:
            if hasattr(r, name):
                return getattr(r, name)
        raise AttributeError(name)


class CustomWriter(object):
    def __init__(self, name, wrap_stream, wrap_buffer, on_write=None):
        """
        :param wrap_stream:
            Either sys.stdout or sys.stderr.

        :param bool wrap_buffer:
            If True the buffer attribute (which wraps writing bytes) should be
            wrapped.

        :param callable(str) on_write:
            Call back with the string that has been written.
        """
        self._name = name
        encoding = getattr(wrap_stream, "encoding", None)
        if not encoding:
            encoding = os.environ.get("PYTHONIOENCODING", "utf-8")
        self.encoding = encoding
        if wrap_buffer:
            self.buffer = CustomWriter(
                name, wrap_stream, wrap_buffer=False, on_write=on_write
            )
        self._on_write = on_write

    def flush(self):
        pass  # no-op here

    def write(self, s):
        if s:
            # Need s in str
            if isinstance(s, bytes):
                s = s.decode(self.encoding, errors="replace")
            log.info("write to %s: %s", self._name, s)
            if self._on_write is not None:
                self._on_write(s)


_stdin = sys.stdin.buffer
_stdout = sys.stdout.buffer


def get_io_buffers():
    return _stdin, _stdout


def redirect_output(stdout_handler, stderr_handler):
    log.info("Redirect stdout/stderr")

    sys._vsc_out_buffer_ = CustomWriter("stdout", sys.stdout, True, stdout_handler)
    sys.stdout_original = sys.stdout
    _stdout_redirector = sys.stdout = IORedirector(
        "stdout", sys.stdout, sys._vsc_out_buffer_, True
    )

    sys._vsc_err_buffer_ = CustomWriter("stderr", sys.stderr, True, stderr_handler)
    sys.stderr_original = sys.stderr
    _stderr_redirector = sys.stderr = IORedirector(
        "stderr", sys.stderr, sys._vsc_err_buffer_, True
    )


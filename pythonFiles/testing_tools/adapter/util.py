# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import contextlib
try:
    from io import StringIO
except ImportError:
    from StringIO import StringIO  # 2.7
import sys


@contextlib.contextmanager
def noop_cm():
    yield


@contextlib.contextmanager
def hide_stdio():
    """Swallow stdout and stderr."""
    ignored = IgnoredIO()
    sys.stdout = ignored
    sys.stderr = ignored
    try:
        yield
    finally:
        sys.stdout = sys.__stdout__
        sys.stderr = sys.__stderr__


class IgnoredIO(StringIO):
    """A noop "file"."""
    def write(self, msg):
        pass

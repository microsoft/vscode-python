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
    buf = StringIO()
    sys.stdout = buf
    sys.stderr = buf
    try:
        yield buf
    finally:
        sys.stdout = sys.__stdout__
        sys.stderr = sys.__stderr__

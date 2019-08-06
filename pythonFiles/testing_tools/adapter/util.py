# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import contextlib
try:
    from io import StringIO
except ImportError:
    from StringIO import StringIO  # 2.7
import os.path
import sys


@contextlib.contextmanager
def noop_cm():
    yield


def group_attr_names(attrnames):
    grouped = {
            'dunder': [],
            'private': [],
            'constants': [],
            'classes': [],
            'vars': [],
            'other': [],
            }
    for name in attrnames:
        if name.startswith('__') and name.endswith('__'):
            group = 'dunder'
        elif name.startswith('_'):
            group = 'private'
        elif name.isupper():
            group = 'constants'
        elif name.islower():
            group = 'vars'
        elif name == name.capitalize():
            group = 'classes'
        else:
            group = 'other'
        grouped[group].append(name)
    return grouped


#############################
# file paths

def fix_path(path, *,
             _pathsep=os.path.sep):
    """Return a platform-appropriate path for the given path."""
    return path.replace('/', _pathsep)


def fix_relpath(path, *,
                _fix_path=fix_path,
                _path_isabs=os.path.isabs,
                _pathsep=os.path.sep
                ):
    """Return a ./-prefixed, platform-appropriate path for the given path."""
    path = _fix_path(path)
    if not _path_isabs(path):
        if not path.startswith('.' + _pathsep):
            path = '.' + _pathsep + path
    return path


def fix_fileid(fileid, rootdir=None, *,
               _normcase=os.path.normcase,
               _path_isabs=os.path.isabs,
               _pathsep=os.path.sep,
               ):
    """Return a "/" separated file ID ("./"-prefixed) for the given value.

    The file ID may be absolute.  If so and "rootdir" is
    provided then make the file ID relative.  If absolute but "rootdir"
    is not provided then leave it absolute.
    """
    if fileid == '.':
        return fileid
    _fileid = _normcase(fileid)
    isabs = False
    if _path_isabs(_fileid):
        isabs = True
        if rootdir is not None:
            rootdir = _normcase(rootdir)
            if not rootdir.endswith(_pathsep):
                rootdir += _pathsep
            if _fileid.startswith(rootdir):
                # This assumes pathsep has length 1.
                fileid = fileid[len(rootdir):]
                isabs = False
    fileid = fileid.replace(_pathsep, '/').lower()
    if not isabs:
        if not fileid.startswith('./'):
            fileid = './' + fileid
    return fileid


#############################
# stdio

@contextlib.contextmanager
def hide_stdio():
    """Swallow stdout and stderr."""
    ignored = StdioStream()
    sys.stdout = ignored
    sys.stderr = ignored
    try:
        yield ignored
    finally:
        sys.stdout = sys.__stdout__
        sys.stderr = sys.__stderr__


if sys.version_info < (3,):
    class StdioStream(StringIO):
        def write(self, msg):
            StringIO.write(self, msg.decode())
else:
    StdioStream = StringIO


#############################
# shell

def shlex_unsplit(argv):
    """Return the shell-safe string for the given arguments.

    This effectively the equivalent of reversing shlex.split().
    """
    argv = [_quote_arg(a) for a in argv]
    return ' '.join(argv)


try:
    from shlex import quote as _quote_arg
except ImportError:
    def _quote_arg(arg):
        parts = None
        for i, c in enumerate(arg):
            if c.isspace():
                pass
            elif c == '"':
                pass
            elif c == "'":
                c = "'\"'\"'"
            else:
                continue
            if parts is None:
                parts = list(arg)
            parts[i] = c
        if parts is not None:
            arg = "'" + ''.join(parts) + "'"
        return arg

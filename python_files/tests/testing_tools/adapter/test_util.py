# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
# ruff:noqa: PT009, PTH100, PTH118, PTH120, PTH123

import ntpath
import os
import os.path
import posixpath
import shlex
import sys

import pytest

# Pytest 3.7 and later uses pathlib/pathlib2 for path resolution.
try:
    from pathlib import Path
except ImportError:
    from pathlib2 import Path  # type: ignore (for Pylance)

from testing_tools.adapter.util import (
    fix_fileid,
    fix_path,
    fix_relpath,
    shlex_unsplit,
)


def is_python313_or_later():
    return sys.version_info >= (3, 13)


def test_isolated_imports():
    import testing_tools.adapter
    from testing_tools.adapter import util

    from . import test_functional

    ignored = {
        str(Path(os.path.abspath(__file__)).resolve()),
        str(Path(os.path.abspath(util.__file__)).resolve()),
        str(Path(os.path.abspath(test_functional.__file__)).resolve()),
    }
    adapter = os.path.abspath(os.path.dirname(testing_tools.adapter.__file__))
    tests = os.path.join(
        os.path.abspath(os.path.dirname(os.path.dirname(testing_tools.__file__))),
        "tests",
        "testing_tools",
        "adapter",
    )
    found = []
    for root in [adapter, tests]:
        for dirname, _, files in os.walk(root):
            if ".data" in dirname:
                continue
            for basename in files:
                if not basename.endswith(".py"):
                    continue
                filename = os.path.join(dirname, basename)
                if filename in ignored:
                    continue
                with open(filename) as srcfile:
                    for line in srcfile:
                        if line.strip() == "import os.path":
                            found.append(filename)
                            break

    if found:
        pytest.fail(
            os.linesep.join(
                [
                    "",
                    "Please only use path-related API from testing_tools.adapter.util.",
                    'Found use of "os.path" in the following files:',
                ]
                + ["  " + file for file in found]
            )
        )


@pytest.mark.parametrize(
    ("path", "expected"),
    [
        ("./spam.py", r".\spam.py"),
        ("./some-dir", r".\some-dir"),
        ("./some-dir/", ".\\some-dir\\"),
        ("./some-dir/eggs", r".\some-dir\eggs"),
        ("./some-dir/eggs/spam.py", r".\some-dir\eggs\spam.py"),
        ("X/y/Z/a.B.c.PY", r"X\y\Z\a.B.c.PY"),
        ("/", "\\"),
        ("/spam", r"\spam"),
        ("C:/spam", r"C:\spam"),
        ("", "."),
        (None, "."),
        (".", "."),
        ("..", ".."),
        ("some-dir", "some-dir"),
        ("spam.py", "spam.py"),
    ],
)
def test_fix_path(path, expected):
    fixed = fix_path(path, _pathsep=ntpath.sep)
    assert fixed == expected

    unchanged = fix_path(path, _pathsep=posixpath.sep)
    expected = "." if path is None or path == "" else path
    assert unchanged == expected


@pytest.mark.parametrize(
    ("path", "os_path", "expected"),
    [
        ("spam.py", posixpath, "./spam.py"),
        ("eggs/spam.py", posixpath, "./eggs/spam.py"),
        ("eggs/spam/", posixpath, "./eggs/spam/"),
        (r"\spam.py", posixpath, r"./\spam.py"),
        ("spam.py", ntpath, r".\spam.py"),
        (r"eggs\spam.py", ntpath, r".\eggs\spam.py"),
        ("eggs\\spam\\", ntpath, ".\\eggs\\spam\\"),
        (
            "/spam.py",
            ntpath,
            r".\\spam.py" if is_python313_or_later() else r"\spam.py",
        ),  # Note the fixed "/".
        # absolute
        ("/", posixpath, "/"),
        ("/spam.py", posixpath, "/spam.py"),
        ("\\", ntpath, ".\\\\" if is_python313_or_later() else "\\"),
        (r"\spam.py", ntpath, r".\\spam.py" if is_python313_or_later() else r"\spam.py"),
        (r"C:\spam.py", ntpath, r"C:\spam.py"),
        # no-op
        ("./spam.py", posixpath, "./spam.py"),
        (r".\spam.py", ntpath, r".\spam.py"),
        (".", posixpath, "."),
        ("..", posixpath, ".."),
        (".", ntpath, "."),
        ("..", ntpath, ".."),
    ],
)
def test_fix_relpath(path, os_path, expected):
    fixed = fix_relpath(
        path,
        # Capture the loop variants as default parameters to make sure they
        # don't change between iterations.
        _fix_path=(lambda p, _sep=os_path.sep: fix_path(p, _pathsep=_sep)),
        _path_isabs=os_path.isabs,
        _pathsep=os_path.sep,
    )
    assert fixed == expected


@pytest.mark.parametrize(
    ("fileid", "os_path", "expected"),
    [
        ("spam.py", posixpath, "./spam.py"),
        ("eggs/spam.py", posixpath, "./eggs/spam.py"),
        ("eggs/spam/", posixpath, "./eggs/spam/"),
        # absolute (no-op)
        ("/", posixpath, "/"),
        ("//", posixpath, "//"),
        ("/spam.py", posixpath, "/spam.py"),
        # no-op
        (None, posixpath, None),
        ("", posixpath, ""),
        (".", posixpath, "."),
        ("./spam.py", posixpath, "./spam.py"),
        (r"\spam.py", posixpath, r"./\spam.py"),
        ("spam.py", ntpath, "./spam.py"),
        ("eggs/spam.py", ntpath, "./eggs/spam.py"),
        ("eggs/spam/", ntpath, "./eggs/spam/"),
        # absolute (no-op)
        ("/", ntpath, ".//" if is_python313_or_later() else "/"),
        ("//", ntpath, "//"),
        ("/spam.py", ntpath, ".//spam.py" if is_python313_or_later() else "/spam.py"),
        # no-op
        (None, ntpath, None),
        ("", ntpath, ""),
        (".", ntpath, "."),
        ("./spam.py", ntpath, "./spam.py"),
        (r"eggs\spam.py", ntpath, "./eggs/spam.py"),
        ("eggs\\spam\\", ntpath, "./eggs/spam/"),
        (r".\spam.py", ntpath, r"./spam.py"),
        # absolute
        (r"\spam.py", ntpath, ".//spam.py" if is_python313_or_later() else "/spam.py"),
        (r"C:\spam.py", ntpath, "C:/spam.py"),
        ("\\", ntpath, ".//" if is_python313_or_later() else "/"),
        ("\\\\", ntpath, "//"),
        ("C:\\\\", ntpath, "C://"),
        ("C:/", ntpath, "C:/"),
        ("C://", ntpath, "C://"),
        ("C:/spam.py", ntpath, "C:/spam.py"),
    ],
)
def test_fix_fileid(fileid, os_path, expected):
    fixed = fix_fileid(
        fileid,
        _path_isabs=os_path.isabs,
        _normcase=os_path.normcase,
        _pathsep=os_path.sep,
    )
    assert fixed == expected


@pytest.mark.parametrize(
    ("fileid", "rootdir", "os_path", "expected"),
    [
        ("spam.py", "/eggs", posixpath, "./spam.py"),
        ("spam.py", r"\eggs", posixpath, "./spam.py"),
        # absolute
        ("/spam.py", "/", posixpath, "./spam.py"),
        ("/eggs/spam.py", "/eggs", posixpath, "./spam.py"),
        ("/eggs/spam.py", "/eggs/", posixpath, "./spam.py"),
        # no-op
        ("/spam.py", "/eggs", posixpath, "/spam.py"),
        ("/spam.py", "/eggs/", posixpath, "/spam.py"),
        # root-only (no-op)
        ("/", "/", posixpath, "/"),
        ("/", "/spam", posixpath, "/"),
        ("//", "/", posixpath, "//"),
        ("//", "//", posixpath, "//"),
        ("//", "//spam", posixpath, "//"),
        ("spam.py", "/eggs", ntpath, "./spam.py"),
        ("spam.py", r"\eggs", ntpath, "./spam.py"),
        # absolute
        ("/spam.py", "/", ntpath, "./spam.py"),
        ("/eggs/spam.py", "/eggs", ntpath, "./spam.py"),
        ("/eggs/spam.py", "/eggs/", ntpath, "./spam.py"),
        # no-op
        ("/spam.py", "/eggs", ntpath, ".//spam.py" if is_python313_or_later() else "/spam.py"),
        ("/spam.py", "/eggs/", ntpath, ".//spam.py" if is_python313_or_later() else "/spam.py"),
        # root-only (no-op)
        ("/", "/", ntpath, "/"),
        ("/", "/spam", ntpath, ".//" if is_python313_or_later() else "/"),
        ("//", "/", ntpath, "//"),
        ("//", "//", ntpath, "//"),
        ("//", "//spam", ntpath, "//"),
        # absolute
        (r"\spam.py", "\\", ntpath, r"./spam.py"),
        (r"C:\spam.py", "C:\\", ntpath, r"./spam.py"),
        (r"\eggs\spam.py", r"\eggs", ntpath, r"./spam.py"),
        (r"\eggs\spam.py", "\\eggs\\", ntpath, r"./spam.py"),
        # normcase
        (r"C:\spam.py", "c:\\", ntpath, r"./spam.py"),
        (r"\Eggs\Spam.py", "\\eggs", ntpath, r"./Spam.py"),
        (r"\eggs\spam.py", "\\Eggs", ntpath, r"./spam.py"),
        (r"\eggs\Spam.py", "\\Eggs", ntpath, r"./Spam.py"),
        # no-op
        (r"\spam.py", r"\eggs", ntpath, ".//spam.py" if is_python313_or_later() else r"/spam.py"),
        (r"C:\spam.py", r"C:\eggs", ntpath, r"C:/spam.py"),
        # TODO: Should these be supported.
        (r"C:\spam.py", "\\", ntpath, r"C:/spam.py"),
        (r"\spam.py", "C:\\", ntpath, ".//spam.py" if is_python313_or_later() else r"/spam.py"),
        # root-only
        ("\\", "\\", ntpath, "/"),
        ("\\\\", "\\", ntpath, "//"),
        ("C:\\", "C:\\eggs", ntpath, "C:/"),
        ("C:\\", "C:\\", ntpath, "C:/"),
        (r"C:\spam.py", "D:\\", ntpath, r"C:/spam.py"),
    ],
)
def test_fix_fileid_rootdir(fileid, rootdir, os_path, expected):
    fixed = fix_fileid(
        fileid,
        rootdir,
        _path_isabs=os_path.isabs,
        _normcase=os_path.normcase,
        _pathsep=os_path.sep,
    )
    assert fixed == expected


def test_no_args():
    argv = []
    joined = shlex_unsplit(argv)

    assert joined == ""
    assert shlex.split(joined) == argv


def test_one_arg():
    argv = ["spam"]
    joined = shlex_unsplit(argv)

    assert joined == "spam"
    assert shlex.split(joined) == argv


def test_multiple_args():
    argv = [
        "-x",
        "X",
        "-xyz",
        "spam",
        "eggs",
    ]
    joined = shlex_unsplit(argv)

    assert joined == "-x X -xyz spam eggs"
    assert shlex.split(joined) == argv


def test_whitespace():
    argv = [
        "-x",
        "X Y Z",
        "spam spam\tspam",
        "eggs",
    ]
    joined = shlex_unsplit(argv)

    assert joined == "-x 'X Y Z' 'spam spam\tspam' eggs"
    assert shlex.split(joined) == argv


def test_quotation_marks():
    argv = [
        "-x",
        "'<quoted>'",
        'spam"spam"spam',
        "ham'ham'ham",
        "eggs",
    ]
    joined = shlex_unsplit(argv)

    assert joined == "-x ''\"'\"'<quoted>'\"'\"'' 'spam\"spam\"spam' 'ham'\"'\"'ham'\"'\"'ham' eggs"
    assert shlex.split(joined) == argv

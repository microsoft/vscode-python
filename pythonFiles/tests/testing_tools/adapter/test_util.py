# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

from __future__ import absolute_import, print_function

import ntpath
import os
import os.path
import posixpath
import shlex
import sys
import unittest

import pytest

# Pytest 3.7 and later uses pathlib/pathlib2 for path resolution.
try:
    from pathlib import Path
except ImportError:
    from pathlib2 import Path  # type: ignore (for Pylance)

from testing_tools.adapter.util import (
    fix_path,
    fix_relpath,
    fix_fileid,
    shlex_unsplit,
)


@unittest.skipIf(sys.version_info < (3,), "Python 2 does not have subTest")
class FilePathTests(unittest.TestCase):
    def test_isolated_imports(self):
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
            self.fail(
                os.linesep.join(
                    [
                        "",
                        "Please only use path-related API from testing_tools.adapter.util.",
                        'Found use of "os.path" in the following files:',
                    ]
                    + ["  " + file for file in found]
                )
            )

    def test_fix_path(self):
        tests = [
            ("./spam.py", r".\spam.py"),
            ("./some-dir", r".\some-dir"),
            ("./some-dir/", ".\\some-dir\\"),
            ("./some-dir/eggs", r".\some-dir\eggs"),
            ("./some-dir/eggs/spam.py", r".\some-dir\eggs\spam.py"),
            ("X/y/Z/a.B.c.PY", r"X\y\Z\a.B.c.PY"),
            ("/", "\\"),
            ("/spam", r"\spam"),
            ("C:/spam", r"C:\spam"),
        ]
        for path, expected in tests:
            pathsep = ntpath.sep
            with self.subTest(r"fixed for \: {!r}".format(path)):
                fixed = fix_path(path, _pathsep=pathsep)
                self.assertEqual(fixed, expected)

            pathsep = posixpath.sep
            with self.subTest("unchanged for /: {!r}".format(path)):
                unchanged = fix_path(path, _pathsep=pathsep)
                self.assertEqual(unchanged, path)

        # no path -> "."
        for path in ["", None]:
            for pathsep in [ntpath.sep, posixpath.sep]:
                with self.subTest(r"fixed for {}: {!r}".format(pathsep, path)):
                    fixed = fix_path(path, _pathsep=pathsep)
                    self.assertEqual(fixed, ".")

        # no-op paths
        paths = [path for _, path in tests]
        paths.extend(
            [
                ".",
                "..",
                "some-dir",
                "spam.py",
            ]
        )
        for path in paths:
            for pathsep in [ntpath.sep, posixpath.sep]:
                with self.subTest(r"unchanged for {}: {!r}".format(pathsep, path)):
                    unchanged = fix_path(path, _pathsep=pathsep)
                    self.assertEqual(unchanged, path)

    def test_fix_relpath(self):
        tests = [
            ("spam.py", posixpath, "./spam.py"),
            ("eggs/spam.py", posixpath, "./eggs/spam.py"),
            ("eggs/spam/", posixpath, "./eggs/spam/"),
            (r"\spam.py", posixpath, r"./\spam.py"),
            ("spam.py", ntpath, r".\spam.py"),
            (r"eggs\spam.py", ntpath, r".\eggs\spam.py"),
            ("eggs\\spam\\", ntpath, ".\\eggs\\spam\\"),
            ("/spam.py", ntpath, r"\spam.py"),  # Note the fixed "/".
            # absolute
            ("/", posixpath, "/"),
            ("/spam.py", posixpath, "/spam.py"),
            ("\\", ntpath, "\\"),
            (r"\spam.py", ntpath, r"\spam.py"),
            (r"C:\spam.py", ntpath, r"C:\spam.py"),
            # no-op
            ("./spam.py", posixpath, "./spam.py"),
            (r".\spam.py", ntpath, r".\spam.py"),
        ]
        # no-op
        for path in [".", ".."]:
            tests.extend(
                [
                    (path, posixpath, path),
                    (path, ntpath, path),
                ]
            )
        for path, _os_path, expected in tests:
            with self.subTest((path, _os_path.sep)):
                fixed = fix_relpath(
                    path,
                    _fix_path=(lambda p: fix_path(p, _pathsep=_os_path.sep)),
                    _path_isabs=_os_path.isabs,
                    _pathsep=_os_path.sep,
                )
                self.assertEqual(fixed, expected)

    def test_fix_fileid(self):
        common = [
            ("spam.py", "./spam.py"),
            ("eggs/spam.py", "./eggs/spam.py"),
            ("eggs/spam/", "./eggs/spam/"),
            # absolute (no-op)
            ("/", "/"),
            ("//", "//"),
            ("/spam.py", "/spam.py"),
            # no-op
            (None, None),
            ("", ""),
            (".", "."),
            ("./spam.py", "./spam.py"),
        ]
        tests = [(p, posixpath, e) for p, e in common]
        tests.extend(
            (p, posixpath, e)
            for p, e in [
                (r"\spam.py", r"./\spam.py"),
            ]
        )
        tests.extend((p, ntpath, e) for p, e in common)
        tests.extend(
            (p, ntpath, e)
            for p, e in [
                (r"eggs\spam.py", "./eggs/spam.py"),
                ("eggs\\spam\\", "./eggs/spam/"),
                (r".\spam.py", r"./spam.py"),
                # absolute
                (r"\spam.py", "/spam.py"),
                (r"C:\spam.py", "C:/spam.py"),
                ("\\", "/"),
                ("\\\\", "//"),
                ("C:\\\\", "C://"),
                ("C:/", "C:/"),
                ("C://", "C://"),
                ("C:/spam.py", "C:/spam.py"),
            ]
        )
        for fileid, _os_path, expected in tests:
            pathsep = _os_path.sep
            with self.subTest(r"for {}: {!r}".format(pathsep, fileid)):
                fixed = fix_fileid(
                    fileid,
                    _path_isabs=_os_path.isabs,
                    _normcase=_os_path.normcase,
                    _pathsep=pathsep,
                )
                self.assertEqual(fixed, expected)

        # with rootdir
        common = [
            ("spam.py", "/eggs", "./spam.py"),
            ("spam.py", r"\eggs", "./spam.py"),
            # absolute
            ("/spam.py", "/", "./spam.py"),
            ("/eggs/spam.py", "/eggs", "./spam.py"),
            ("/eggs/spam.py", "/eggs/", "./spam.py"),
            # no-op
            ("/spam.py", "/eggs", "/spam.py"),
            ("/spam.py", "/eggs/", "/spam.py"),
            # root-only (no-op)
            ("/", "/", "/"),
            ("/", "/spam", "/"),
            ("//", "/", "//"),
            ("//", "//", "//"),
            ("//", "//spam", "//"),
        ]
        tests = [(p, r, posixpath, e) for p, r, e in common]
        tests = [(p, r, ntpath, e) for p, r, e in common]
        tests.extend(
            (p, r, ntpath, e)
            for p, r, e in [
                ("spam.py", r"\eggs", "./spam.py"),
                # absolute
                (r"\spam.py", "\\", r"./spam.py"),
                (r"C:\spam.py", "C:\\", r"./spam.py"),
                (r"\eggs\spam.py", r"\eggs", r"./spam.py"),
                (r"\eggs\spam.py", "\\eggs\\", r"./spam.py"),
                # normcase
                (r"C:\spam.py", "c:\\", r"./spam.py"),
                (r"\Eggs\Spam.py", "\\eggs", r"./Spam.py"),
                (r"\eggs\spam.py", "\\Eggs", r"./spam.py"),
                (r"\eggs\Spam.py", "\\Eggs", r"./Spam.py"),
                # no-op
                (r"\spam.py", r"\eggs", r"/spam.py"),
                (r"C:\spam.py", r"C:\eggs", r"C:/spam.py"),
                # TODO: Should these be supported.
                (r"C:\spam.py", "\\", r"C:/spam.py"),
                (r"\spam.py", "C:\\", r"/spam.py"),
                # root-only
                ("\\", "\\", "/"),
                ("\\\\", "\\", "//"),
                ("C:\\", "C:\\eggs", "C:/"),
                ("C:\\", "C:\\", "C:/"),
                (r"C:\spam.py", "D:\\", r"C:/spam.py"),
            ]
        )
        for fileid, rootdir, _os_path, expected in tests:
            pathsep = _os_path.sep
            with self.subTest(
                r"for {} (with rootdir {!r}): {!r}".format(pathsep, rootdir, fileid)
            ):
                fixed = fix_fileid(
                    fileid,
                    rootdir,
                    _path_isabs=_os_path.isabs,
                    _normcase=_os_path.normcase,
                    _pathsep=pathsep,
                )
                self.assertEqual(fixed, expected)


class ShlexUnsplitTests(unittest.TestCase):
    def test_no_args(self):
        argv = []
        joined = shlex_unsplit(argv)

        self.assertEqual(joined, "")
        self.assertEqual(shlex.split(joined), argv)

    def test_one_arg(self):
        argv = ["spam"]
        joined = shlex_unsplit(argv)

        self.assertEqual(joined, "spam")
        self.assertEqual(shlex.split(joined), argv)

    def test_multiple_args(self):
        argv = [
            "-x",
            "X",
            "-xyz",
            "spam",
            "eggs",
        ]
        joined = shlex_unsplit(argv)

        self.assertEqual(joined, "-x X -xyz spam eggs")
        self.assertEqual(shlex.split(joined), argv)

    def test_whitespace(self):
        argv = [
            "-x",
            "X Y Z",
            "spam spam\tspam",
            "eggs",
        ]
        joined = shlex_unsplit(argv)

        self.assertEqual(joined, "-x 'X Y Z' 'spam spam\tspam' eggs")
        self.assertEqual(shlex.split(joined), argv)

    def test_quotation_marks(self):
        argv = [
            "-x",
            "'<quoted>'",
            'spam"spam"spam',
            "ham'ham'ham",
            "eggs",
        ]
        joined = shlex_unsplit(argv)

        self.assertEqual(
            joined,
            "-x ''\"'\"'<quoted>'\"'\"'' 'spam\"spam\"spam' 'ham'\"'\"'ham'\"'\"'ham' eggs",
        )
        self.assertEqual(shlex.split(joined), argv)

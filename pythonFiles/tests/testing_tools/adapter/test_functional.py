# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import json
import os
import os.path
import subprocess
import sys
import unittest

import pytest

from ...__main__ import TESTING_TOOLS_ROOT


CWD = os.getcwd()
DATA_DIR = os.path.join(os.path.dirname(__file__), '.data')
SCRIPT = os.path.join(TESTING_TOOLS_ROOT, 'run_adapter.py')


def resolve_testroot(name):
    projroot = os.path.join(DATA_DIR, name)
    return projroot, os.path.join(projroot, 'tests')


def run_adapter(cmd, tool, *cliargs):
    try:
        return _run_adapter(cmd, tool, *cliargs)
    except subprocess.CalledProcessError as exc:
        return _run_adapter(cmd, tool, *cliargs, hidestdio=False)


def _run_adapter(cmd, tool, *cliargs, hidestdio=True):
    argv = [sys.executable, SCRIPT, cmd, tool, '--'] + list(cliargs)
    if not hidestdio:
        argv.insert(4, '--no-hide-stdio')
    print('running {!r}'.format(' '.join(arg.rpartition(CWD + '/')[-1] for arg in argv)))
    return subprocess.check_output(argv, text=True)


def fix_path(nodeid):
    return nodeid.replace('/', os.path.sep)


@pytest.mark.functional
class PytestTests(unittest.TestCase):

    def test_discover_simple(self):
        projroot, testroot = resolve_testroot('simple')

        out = run_adapter('discover', 'pytest',
                          '--rootdir', projroot,
                          testroot)
        result = json.loads(out)

        self.maxDiff = None
        self.assertEqual(result, [{
            'root': projroot,
            'rootid': '.',
            'parents': [
                {'id': fix_path('./tests'),
                 'kind': 'folder',
                 'name': 'tests',
                 'parentid': '.',
                 },
                {'id': fix_path('./tests/test_spam.py'),
                 'kind': 'file',
                 'name': 'test_spam.py',
                 'parentid': fix_path('./tests'),
                 },
                ],
            'tests': [
                {'id': fix_path('./tests/test_spam.py::test_simple'),
                 'name': 'test_simple',
                 'source': fix_path('tests/test_spam.py:2'),
                 'markers': [],
                 'parentid': fix_path('./tests/test_spam.py'),
                 },
                ],
            }])

    def test_discover_complex(self):
        projroot, testroot = resolve_testroot('complex')

        out = run_adapter('discover', 'pytest',
                          '--rootdir', projroot,
                          testroot)
        result = json.loads(out)

        self.maxDiff = None
        self.assertEqual(result, [{
            'root': projroot,
            'rootid': '.',
            'parents': [
                {'id': fix_path('./tests'),
                 'kind': 'folder',
                 'name': 'tests',
                 'parentid': '.',
                 },

                {'id': fix_path('./tests/test_42-43.py'),
                 'kind': 'file',
                 'name': 'test_42-43.py',
                 'parentid': fix_path('./tests'),
                 },
                {'id': fix_path('./tests/test_42.py'),
                 'kind': 'file',
                 'name': 'test_42.py',
                 'parentid': fix_path('./tests'),
                 },
#                {'id': fix_path('./tests/test_doctest.txt'),
#                 'kind': 'file',
#                 'name': 'test_doctest.txt',
#                 'parentid': fix_path('./tests'),
#                 },
                {'id': fix_path('./tests/test_foo.py'),
                 'kind': 'file',
                 'name': 'test_foo.py',
                 'parentid': fix_path('./tests'),
                 },
#                {'id': fix_path('./tests/test_mixed.py'),
#                 'kind': 'file',
#                 'name': 'test_mixed.py',
#                 'parentid': fix_path('./tests'),
#                 },
                {'id': fix_path('./tests/test_pytest.py'),
                 'kind': 'file',
                 'name': 'test_pytest.py',
                 'parentid': fix_path('./tests'),
                 },
#                {'id': fix_path('./tests/test_unittest.py'),
#                 'kind': 'file',
#                 'name': 'test_unittest.py',
#                 'parentid': fix_path('./tests'),
#                 },

                {'id': fix_path('./tests/v'),
                 'kind': 'folder',
                 'name': 'v',
                 'parentid': fix_path('./tests'),
                 },
                {'id': fix_path('./tests/v/test_eggs.py'),
                 'kind': 'file',
                 'name': 'test_eggs.py',
                 'parentid': fix_path('./tests/v'),
                 },
                {'id': fix_path('./tests/v/test_eggs.py::TestSimple'),
                 'kind': 'suite',
                 'name': 'TestSimple',
                 'parentid': fix_path('./tests/v/test_eggs.py'),
                 },
                {'id': fix_path('./tests/v/test_ham.py'),
                 'kind': 'file',
                 'name': 'test_ham.py',
                 'parentid': fix_path('./tests/v'),
                 },
                {'id': fix_path('./tests/v/test_spam.py'),
                 'kind': 'file',
                 'name': 'test_spam.py',
                 'parentid': fix_path('./tests/v'),
                 },

                {'id': fix_path('./tests/w'),
                 'kind': 'folder',
                 'name': 'w',
                 'parentid': fix_path('./tests'),
                 },
                {'id': fix_path('./tests/w/test_spam.py'),
                 'kind': 'file',
                 'name': 'test_spam.py',
                 'parentid': fix_path('./tests/w'),
                 },
                {'id': fix_path('./tests/w/test_spam_ex.py'),
                 'kind': 'file',
                 'name': 'test_spam_ex.py',
                 'parentid': fix_path('./tests/w'),
                 },

                {'id': fix_path('./tests/x'),
                 'kind': 'folder',
                 'name': 'x',
                 'parentid': fix_path('./tests'),
                 },
                {'id': fix_path('./tests/x/y'),
                 'kind': 'folder',
                 'name': 'y',
                 'parentid': fix_path('./tests/x'),
                 },
                {'id': fix_path('./tests/x/y/z'),
                 'kind': 'folder',
                 'name': 'z',
                 'parentid': fix_path('./tests/x/y'),
                 },
                {'id': fix_path('./tests/x/y/z/a'),
                 'kind': 'folder',
                 'name': 'a',
                 'parentid': fix_path('./tests/x/y/z'),
                 },
                {'id': fix_path('./tests/x/y/z/a/test_spam.py'),
                 'kind': 'file',
                 'name': 'test_spam.py',
                 'parentid': fix_path('./tests/x/y/z/a'),
                 },
                {'id': fix_path('./tests/x/y/z/b'),
                 'kind': 'folder',
                 'name': 'b',
                 'parentid': fix_path('./tests/x/y/z'),
                 },
                {'id': fix_path('./tests/x/y/z/b/test_spam.py'),
                 'kind': 'file',
                 'name': 'test_spam.py',
                 'parentid': fix_path('./tests/x/y/z/b'),
                 },
                {'id': fix_path('./tests/x/y/z/test_ham.py'),
                 'kind': 'file',
                 'name': 'test_ham.py',
                 'parentid': fix_path('./tests/x/y/z'),
                 },
                ],
            'tests': [
                {'id': fix_path('./tests/test_42-43.py::test_simple'),
                 'name': 'test_simple',
                 'source': fix_path('tests/test_42-43.py:2'),
                 'markers': [],
                 'parentid': fix_path('./tests/test_42-43.py'),
                 },
                {'id': fix_path('./tests/test_42.py::test_simple'),
                 'name': 'test_simple',
                 'source': fix_path('tests/test_42.py:2'),
                 'markers': [],
                 'parentid': fix_path('./tests/test_42.py'),
                 },
                {'id': fix_path('./tests/test_foo.py::test_simple'),
                 'name': 'test_simple',
                 'source': fix_path('tests/test_foo.py:3'),
                 'markers': [],
                 'parentid': fix_path('./tests/test_foo.py'),
                 },
                {'id': fix_path('./tests/test_pytest.py::test_simple'),
                 'name': 'test_simple',
                 'source': fix_path('tests/test_pytest.py:4'),
                 'markers': [],
                 'parentid': fix_path('./tests/test_pytest.py'),
                 },

                {'id': fix_path('./tests/v/test_eggs.py::test_simple'),
                 'name': 'test_simple',
                 'source': fix_path('tests/v/spam.py:2'),
                 'markers': [],
                 'parentid': fix_path('./tests/v/test_eggs.py'),
                 },
                {'id': fix_path('./tests/v/test_eggs.py::TestSimple::test_simple'),
                 'name': 'test_simple',
                 'source': fix_path('tests/v/spam.py:8'),
                 'markers': [],
                 'parentid': fix_path('./tests/v/test_eggs.py::TestSimple'),
                 },
                {'id': fix_path('./tests/v/test_ham.py::test_simple'),
                 'name': 'test_simple',
                 'source': fix_path('tests/v/spam.py:2'),
                 'markers': [],
                 'parentid': fix_path('./tests/v/test_ham.py'),
                 },
                {'id': fix_path('./tests/v/test_ham.py::test_not_hard'),
                 'name': 'test_not_hard',
                 'source': fix_path('tests/v/spam.py:2'),
                 'markers': [],
                 'parentid': fix_path('./tests/v/test_ham.py'),
                 },
                {'id': fix_path('./tests/v/test_spam.py::test_simple'),
                 'name': 'test_simple',
                 'source': fix_path('tests/v/spam.py:2'),
                 'markers': [],
                 'parentid': fix_path('./tests/v/test_spam.py'),
                 },
                {'id': fix_path('./tests/v/test_spam.py::test_simpler'),
                 'name': 'test_simpler',
                 'source': fix_path('tests/v/test_spam.py:4'),
                 'markers': [],
                 'parentid': fix_path('./tests/v/test_spam.py'),
                 },

                {'id': fix_path('./tests/w/test_spam.py::test_simple'),
                 'name': 'test_simple',
                 'source': fix_path('tests/w/test_spam.py:4'),
                 'markers': [],
                 'parentid': fix_path('./tests/w/test_spam.py'),
                 },
                {'id': fix_path('./tests/w/test_spam_ex.py::test_simple'),
                 'name': 'test_simple',
                 'source': fix_path('tests/w/test_spam_ex.py:4'),
                 'markers': [],
                 'parentid': fix_path('./tests/w/test_spam_ex.py'),
                 },

                {'id': fix_path('./tests/x/y/z/test_ham.py::test_simple'),
                 'name': 'test_simple',
                 'source': fix_path('tests/x/y/z/test_ham.py:2'),
                 'markers': [],
                 'parentid': fix_path('./tests/x/y/z/test_ham.py'),
                 },
                {'id': fix_path('./tests/x/y/z/a/test_spam.py::test_simple'),
                 'name': 'test_simple',
                 'source': fix_path('tests/x/y/z/a/test_spam.py:11'),
                 'markers': [],
                 'parentid': fix_path('./tests/x/y/z/a/test_spam.py'),
                 },
                {'id': fix_path('./tests/x/y/z/b/test_spam.py::test_simple'),
                 'name': 'test_simple',
                 'source': fix_path('tests/x/y/z/b/test_spam.py:7'),
                 'markers': [],
                 'parentid': fix_path('./tests/x/y/z/b/test_spam.py'),
                 },
                ],
            }])

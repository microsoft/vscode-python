# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import json
import os.path
import subprocess
import sys
import unittest

import pytest

from ...__main__ import TESTING_TOOLS_ROOT


DATA_DIR = os.path.join(os.path.dirname(__file__), '.data')
SCRIPT = os.path.join(TESTING_TOOLS_ROOT, 'run_adapter.py')


def resolve_testroot(name):
    projroot = os.path.join(DATA_DIR, name)
    return projroot, os.path.join(projroot, 'tests')


def run_adapter(cmd, tool, *cliargs):
    argv = [sys.executable, SCRIPT, cmd, tool, '--'] + list(cliargs)
    print('running {!r}'.format(' '.join(argv)))
    return subprocess.check_output(argv, text=True)


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
                {'id': os.path.join('.', 'tests'),
                 'kind': 'folder',
                 'name': 'tests',
                 'parentid': '.',
                 },
                {'id': os.path.join('.', 'tests', 'test_spam.py'),
                 'kind': 'file',
                 'name': 'test_spam.py',
                 'parentid': os.path.join('.', 'tests'),
                 },
                ],
            'tests': [
                {'id': os.path.join('.', 'tests', 'test_spam.py::test_simple'),
                 'name': 'test_simple',
                 'source': os.path.join('tests', 'test_spam.py:2'),
                 'markers': [],
                 'parentid': os.path.join('.', 'tests', 'test_spam.py'),
                 },
                ],
            }])

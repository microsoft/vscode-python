# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os
import os.path
import shlex
import unittest

import pytest

from testing_tools.adapter.util import shlex_unsplit


class FilePathTests(unittest.TestCase):

    @pytest.mark.functional
    def test_isolated_imports(self):
        import testing_tools.adapter
        from testing_tools.adapter import util
        from . import test_functional
        ignored = {
                os.path.abspath(__file__),
                os.path.abspath(util.__file__),
                os.path.abspath(test_functional.__file__),
                }
        adapter = os.path.abspath(
                os.path.dirname(testing_tools.adapter.__file__))
        tests = os.path.join(
                os.path.abspath(
                    os.path.dirname(
                        os.path.dirname(testing_tools.__file__))),
                'tests',
                'testing_tools',
                'adapter',
                )
        found = []
        for root in [adapter, tests]:
            for dirname, _, files in os.walk(root):
                if '.data' in dirname:
                    continue
                for basename in files:
                    if not basename.endswith('.py'):
                        continue
                    filename = os.path.join(dirname, basename)
                    if filename in ignored:
                        continue
                    with open(filename) as srcfile:
                        for line in srcfile:
                            if line.strip() == 'import os.path':
                                found.append(filename)
                                break

        if found:
            self.fail(os.linesep.join([
                '',
                'Please only use path-related API from testing_tools.adapter.util.',
                'Found use of "os.path" in the following files:',
                ] + ['  ' + file for file in found]))


class ShlexUnsplitTests(unittest.TestCase):

    def test_no_args(self):
        argv = []
        joined = shlex_unsplit(argv)

        self.assertEqual(joined, '')
        self.assertEqual(shlex.split(joined), argv)

    def test_one_arg(self):
        argv = ['spam']
        joined = shlex_unsplit(argv)

        self.assertEqual(joined, 'spam')
        self.assertEqual(shlex.split(joined), argv)

    def test_multiple_args(self):
        argv = [
                '-x', 'X',
                '-xyz',
                'spam',
                'eggs',
                ]
        joined = shlex_unsplit(argv)

        self.assertEqual(joined, '-x X -xyz spam eggs')
        self.assertEqual(shlex.split(joined), argv)

    def test_whitespace(self):
        argv = [
                '-x', 'X Y Z',
                'spam spam\tspam',
                'eggs',
                ]
        joined = shlex_unsplit(argv)

        self.assertEqual(joined, "-x 'X Y Z' 'spam spam\tspam' eggs")
        self.assertEqual(shlex.split(joined), argv)

    def test_quotation_marks(self):
        argv = [
                '-x', "'<quoted>'",
                'spam"spam"spam',
                "ham'ham'ham",
                'eggs',
                ]
        joined = shlex_unsplit(argv)

        self.assertEqual(joined, "-x ''\"'\"'<quoted>'\"'\"'' 'spam\"spam\"spam' 'ham'\"'\"'ham'\"'\"'ham' eggs")
        self.assertEqual(shlex.split(joined), argv)

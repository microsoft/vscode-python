# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import shlex
import unittest

from testing_tools.adapter.util import shlex_unsplit


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

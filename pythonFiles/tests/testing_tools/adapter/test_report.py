# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import json
import os.path
import unittest

from ...util import StubProxy
from testing_tools.adapter.info import TestInfo, TestPath
from testing_tools.adapter.report import report_discovered


class StubSender(StubProxy):

    def send(self, outstr):
        self.add_call('send', (outstr,), None)


##################################
# tests

class ReportTests(unittest.TestCase):

    def test_basic(self):
        stub = StubSender()
        testroot = '/a/b/c'.replace('/', os.path.sep)
        relfile = 'x/y/z/test_spam.py'.replace('/', os.path.sep)
        tests = [
            TestInfo(
                id='test#1',
                name='test_spam_1',
                path=TestPath(
                    root=testroot,
                    relfile=relfile,
                    func='MySuite.test_spam_1',
                    sub=None,
                    ),
                lineno=10,
                markers=None,
                ),
            ]
        expected = [{
            'id': 'test#1',
            'name': 'test_spam_1',
            'testroot': testroot,
            'relfile': relfile,
            'lineno': 10,
            'testfunc': 'MySuite.test_spam_1',
            'subtest': None,
            'markers': None,
            }]

        report_discovered(tests, _send=stub.send)

        self.assertEqual(stub.calls, [
            ('send', (json.dumps(expected),), None),
            ])

    def test_complex(self):
        """
        /a/b/c/
          test_ham.py
            MySuite
              test_x1
              test_x2
        /a/b/e/f/g/
          w/
            test_ham.py
              test_ham1
              HamTests
                test_uh_oh
                test_whoa
              MoreHam
                test_yay
                  sub1
                  sub2
                    sub3
            test_eggs.py
              SpamTests
                test_okay
          x/
            y/
              a/
                test_spam.py
                  SpamTests
                    test_okay
              b/
                test_spam.py
                  SpamTests
                    test_okay
          test_spam.py
              SpamTests
                test_okay
        """
        stub = StubSender()
        testroot1 = '/a/b/c'.replace('/', os.path.sep)
        relfile1 = './test_ham.py'.replace('/', os.path.sep)
        testroot2 = '/a/b/e/f/g'.replace('/', os.path.sep)
        relfile2 = './test_spam.py'.replace('/', os.path.sep)
        relfile3 = 'w/test_ham.py'.replace('/', os.path.sep)
        relfile4 = 'w/test_eggs.py'.replace('/', os.path.sep)
        relfile5 = 'x/y/a/test_spam.py'.replace('/', os.path.sep)
        relfile6 = 'x/y/b/test_spam.py'.replace('/', os.path.sep)
        tests = [
            # under first root folder
            TestInfo(
                id='test#1',
                name='test_x1',
                path=TestPath(
                    root=testroot1,
                    relfile=relfile1,
                    func='MySuite.test_x1',
                    sub=None,
                    ),
                lineno=10,
                markers=None,
                ),
            TestInfo(
                id='test#2',
                name='test_x2',
                path=TestPath(
                    root=testroot1,
                    relfile=relfile1,
                    func='MySuite.test_x2',
                    sub=None,
                    ),
                lineno=21,
                markers=None,
                ),
            # under second root folder
            TestInfo(
                id='test#3',
                name='test_okay',
                path=TestPath(
                    root=testroot2,
                    relfile=relfile2,
                    func='SpamTests.test_okay',
                    sub=None,
                    ),
                lineno=17,
                markers=None,
                ),
            TestInfo(
                id='test#4',
                name='test_ham1',
                path=TestPath(
                    root=testroot2,
                    relfile=relfile3,
                    func='test_ham1',
                    sub=None,
                    ),
                lineno=8,
                markers=None,
                ),
            TestInfo(
                id='test#5',
                name='test_uh_oh',
                path=TestPath(
                    root=testroot2,
                    relfile=relfile3,
                    func='HamTests.test_uh_oh',
                    sub=None,
                    ),
                lineno=19,
                markers=['expected-failure'],
                ),
            TestInfo(
                id='test#6',
                name='test_whoa',
                path=TestPath(
                    root=testroot2,
                    relfile=relfile3,
                    func='HamTests.test_whoa',
                    sub=None,
                    ),
                lineno=35,
                markers=None,
                ),
            TestInfo(
                id='test#7',
                name='test_yay (sub1)',
                path=TestPath(
                    root=testroot2,
                    relfile=relfile3,
                    func='MoreHam.test_yay',
                    sub=['sub1'],
                    ),
                lineno=57,
                markers=None,
                ),
            TestInfo(
                id='test#8',
                name='test_yay (sub2) (sub3)',
                path=TestPath(
                    root=testroot2,
                    relfile=relfile3,
                    func='MoreHam.test_yay',
                    sub=['sub2', 'sub3'],
                    ),
                lineno=72,
                markers=None,
                ),
            TestInfo(
                id='test#9',
                name='test_okay',
                path=TestPath(
                    root=testroot2,
                    relfile=relfile4,
                    func='SpamTests.test_okay',
                    sub=None,
                    ),
                lineno=15,
                markers=None,
                ),
            TestInfo(
                id='test#10',
                name='test_okay',
                path=TestPath(
                    root=testroot2,
                    relfile=relfile5,
                    func='SpamTests.test_okay',
                    sub=None,
                    ),
                lineno=12,
                markers=None,
                ),
            TestInfo(
                id='test#11',
                name='test_okay',
                path=TestPath(
                    root=testroot2,
                    relfile=relfile6,
                    func='SpamTests.test_okay',
                    sub=None,
                    ),
                lineno=27,
                markers=None,
                ),
            ]
        expected = [{
            'id': 'test#1',
            'name': 'test_x1',
            'testroot': testroot1,
            'relfile': relfile1,
            'lineno': 10,
            'testfunc': 'MySuite.test_x1',
            'subtest': None,
            'markers': None,
            }, {
            'id': 'test#2',
            'name': 'test_x2',
            'testroot': testroot1,
            'relfile': relfile1,
            'lineno': 21,
            'testfunc': 'MySuite.test_x2',
            'subtest': None,
            'markers': None,
            }, {
            'id': 'test#3',
            'name': 'test_okay',
            'testroot': testroot2,
            'relfile': relfile2,
            'lineno': 17,
            'testfunc': 'SpamTests.test_okay',
            'subtest': None,
            'markers': None,
            }, {
            'id': 'test#4',
            'name': 'test_ham1',
            'testroot': testroot2,
            'relfile': relfile3,
            'lineno': 8,
            'testfunc': 'test_ham1',
            'subtest': None,
            'markers': None,
            }, {
            'id': 'test#5',
            'name': 'test_uh_oh',
            'testroot': testroot2,
            'relfile': relfile3,
            'lineno': 19,
            'testfunc': 'HamTests.test_uh_oh',
            'subtest': None,
            'markers': ['expected-failure'],
            }, {
            'id': 'test#6',
            'name': 'test_whoa',
            'testroot': testroot2,
            'relfile': relfile3,
            'lineno': 35,
            'testfunc': 'HamTests.test_whoa',
            'subtest': None,
            'markers': None,
            }, {
            'id': 'test#7',
            'name': 'test_yay (sub1)',
            'testroot': testroot2,
            'relfile': relfile3,
            'lineno': 57,
            'testfunc': 'MoreHam.test_yay',
            'subtest': ['sub1'],
            'markers': None,
            }, {
            'id': 'test#8',
            'name': 'test_yay (sub2) (sub3)',
            'testroot': testroot2,
            'relfile': relfile3,
            'lineno': 72,
            'testfunc': 'MoreHam.test_yay',
            'subtest': ['sub2', 'sub3'],
            'markers': None,
            }, {
            'id': 'test#9',
            'name': 'test_okay',
            'testroot': testroot2,
            'relfile': relfile4,
            'lineno': 15,
            'testfunc': 'SpamTests.test_okay',
            'subtest': None,
            'markers': None,
            }, {
            'id': 'test#10',
            'name': 'test_okay',
            'testroot': testroot2,
            'relfile': relfile5,
            'lineno': 12,
            'testfunc': 'SpamTests.test_okay',
            'subtest': None,
            'markers': None,
            }, {
            'id': 'test#11',
            'name': 'test_okay',
            'testroot': testroot2,
            'relfile': relfile6,
            'lineno': 27,
            'testfunc': 'SpamTests.test_okay',
            'subtest': None,
            'markers': None,
            }]

        report_discovered(tests, _send=stub.send)

        self.maxDiff = None
        self.assertEqual(stub.calls, [
            ('send', (json.dumps(expected),), None),
            ])

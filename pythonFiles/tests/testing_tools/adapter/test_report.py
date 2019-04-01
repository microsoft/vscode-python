# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import json
import os.path
import unittest

from ...util import StubProxy
from testing_tools.adapter.info import TestInfo, TestPath, ParentInfo
from testing_tools.adapter.report import report_discovered


class StubSender(StubProxy):

    def send(self, outstr):
        self.add_call('send', (json.loads(outstr),), None)


##################################
# tests

class ReportDiscoveredTests(unittest.TestCase):

    def test_basic(self):
        stub = StubSender()
        testroot = '/a/b/c'.replace('/', os.path.sep)
        relfile = 'test_spam.py'
        tests = [
            TestInfo(
                id='test#1',
                name='test_spam',
                path=TestPath(
                    root=testroot,
                    relfile=relfile,
                    func='test_spam',
                    ),
                source='{}:{}'.format(relfile, 10),
                markers=[],
                parentid='file#1',
                ),
            ]
        parents = [
            ParentInfo(
                id='<root>',
                kind='folder',
                name=testroot,
                ),
            ParentInfo(
                id='file#1',
                kind='file',
                name=relfile,
                root=testroot,
                parentid='<root>',
                ),
            ]
        expected = [{
            'rootid': '<root>',
            'root': testroot,
            'parents': [
                {'id': 'file#1',
                 'kind': 'file',
                 'name': relfile,
                 'parentid': '<root>',
                 },
                ],
            'tests': [{
                'id': 'test#1',
                'name': 'test_spam',
                'source': '{}:{}'.format(relfile, 10),
                'markers': [],
                'parentid': 'file#1',
                }],
            }]

        report_discovered(tests, parents, _send=stub.send)

        self.maxDiff = None
        self.assertEqual(stub.calls, [
            ('send', (expected,), None),
            ])

    def test_multiroot(self):
        stub = StubSender()
        # the first root
        testroot1 = '/a/b/c'.replace('/', os.path.sep)
        relfile1 = 'test_spam.py'
        relfileid1 = os.path.join('.', relfile1)
        tests = [
            TestInfo(
                id=relfileid1 + '::test_spam',
                name='test_spam',
                path=TestPath(
                    root=testroot1,
                    relfile=relfile1,
                    func='test_spam',
                    ),
                source='{}:{}'.format(relfile1, 10),
                markers=[],
                parentid=relfileid1,
                ),
            ]
        parents = [
            ParentInfo(
                id='.',
                kind='folder',
                name=testroot1,
                ),
            ParentInfo(
                id=relfileid1,
                kind='file',
                name=os.path.basename(relfile1),
                root=testroot1,
                parentid=os.path.dirname(relfileid1),
                ),
            ]
        expected = [
            {'rootid': '.',
             'root': testroot1,
             'parents': [
                 {'id': relfileid1,
                  'kind': 'file',
                  'name': relfile1,
                  'parentid': '.',
                  },
                 ],
             'tests': [{
                 'id': relfileid1 + '::test_spam',
                 'name': 'test_spam',
                 'source': '{}:{}'.format(relfile1, 10),
                 'markers': [],
                 'parentid': relfileid1,
                 }],
             },
            ]
        # the second root
        testroot2 = '/x/y/z'.replace('/', os.path.sep)
        relfile2 = 'w/test_eggs.py'
        relfileid2 = os.path.join('.', relfile2)
        tests.extend([
            TestInfo(
                id=relfileid2 + '::BasicTests::test_first',
                name='test_first',
                path=TestPath(
                    root=testroot2,
                    relfile=relfile2,
                    func='BasicTests.test_first',
                    ),
                source='{}:{}'.format(relfile2, 61),
                markers=[],
                parentid=relfileid2 + '::BasicTests',
                ),
            ])
        parents.extend([
            ParentInfo(
                id='.',
                kind='folder',
                name=testroot2,
                ),
            ParentInfo(
                id='./w'.replace('/', os.path.sep),
                kind='folder',
                name='w',
                root=testroot2,
                parentid='.',
                ),
            ParentInfo(
                id=relfileid2,
                kind='file',
                name=os.path.basename(relfile2),
                root=testroot2,
                parentid=os.path.dirname(relfileid2),
                ),
            ParentInfo(
                id=relfileid2 + '::BasicTests',
                kind='suite',
                name='BasicTests',
                root=testroot2,
                parentid=relfileid2,
                ),
            ])
        expected.extend([
            {'rootid': '.',
             'root': testroot2,
             'parents': [
                 {'id': os.path.dirname(relfileid2),
                  'kind': 'folder',
                  'name': 'w',
                  'parentid': '.',
                  },
                 {'id': relfileid2,
                  'kind': 'file',
                  'name': os.path.basename(relfile2),
                  'parentid': os.path.dirname(relfileid2),
                  },
                 {'id': relfileid2 + '::BasicTests',
                  'kind': 'suite',
                  'name': 'BasicTests',
                  'parentid': relfileid2,
                  },
                 ],
             'tests': [{
                 'id': relfileid2 + '::BasicTests::test_first',
                 'name': 'test_first',
                 'source': '{}:{}'.format(relfile2, 61),
                 'markers': [],
                 'parentid': relfileid2 + '::BasicTests',
                 }],
             },
            ])

        report_discovered(tests, parents, _send=stub.send)

        self.maxDiff = None
        self.assertEqual(stub.calls, [
            ('send', (expected,), None),
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
        testroot = '/a/b/c'.replace('/', os.path.sep)
        relfile1 = './test_ham.py'.replace('/', os.path.sep)
        relfile2 = './test_spam.py'.replace('/', os.path.sep)
        relfile3 = './w/test_ham.py'.replace('/', os.path.sep)
        relfile4 = './w/test_eggs.py'.replace('/', os.path.sep)
        relfile5 = './x/y/a/test_spam.py'.replace('/', os.path.sep)
        relfile6 = './x/y/b/test_spam.py'.replace('/', os.path.sep)
        tests = [
            TestInfo(
                id=relfile1 + '::MySuite::test_x1',
                name='test_x1',
                path=TestPath(
                    root=testroot,
                    relfile=relfile1,
                    func='MySuite.test_x1',
                    ),
                source='{}:{}'.format(relfile1, 10),
                markers=None,
                parentid=relfile1 + '::MySuite',
                ),
            TestInfo(
                id=relfile1 + '::MySuite::test_x2',
                name='test_x2',
                path=TestPath(
                    root=testroot,
                    relfile=relfile1,
                    func='MySuite.test_x2',
                    ),
                source='{}:{}'.format(relfile1, 21),
                markers=None,
                parentid=relfile1 + '::MySuite',
                ),
            TestInfo(
                id=relfile2 + '::SpamTests::test_okay',
                name='test_okay',
                path=TestPath(
                    root=testroot,
                    relfile=relfile2,
                    func='SpamTests.test_okay',
                    ),
                source='{}:{}'.format(relfile2, 17),
                markers=None,
                parentid=relfile2 + '::SpamTests',
                ),
            TestInfo(
                id=relfile3 + '::test_ham1',
                name='test_ham1',
                path=TestPath(
                    root=testroot,
                    relfile=relfile3,
                    func='test_ham1',
                    ),
                source='{}:{}'.format(relfile3, 8),
                markers=None,
                parentid=relfile3,
                ),
            TestInfo(
                id=relfile3 + '::HamTests::test_uh_oh',
                name='test_uh_oh',
                path=TestPath(
                    root=testroot,
                    relfile=relfile3,
                    func='HamTests.test_uh_oh',
                    ),
                source='{}:{}'.format(relfile3, 19),
                markers=['expected-failure'],
                parentid=relfile3 + '::HamTests',
                ),
            TestInfo(
                id=relfile3 + '::HamTests::test_whoa',
                name='test_whoa',
                path=TestPath(
                    root=testroot,
                    relfile=relfile3,
                    func='HamTests.test_whoa',
                    ),
                source='{}:{}'.format(relfile3, 35),
                markers=None,
                parentid=relfile3 + '::HamTests',
                ),
            TestInfo(
                id=relfile3 + '::MoreHam::test_yay[1-2]',
                name='test_yay[1-2]',
                path=TestPath(
                    root=testroot,
                    relfile=relfile3,
                    func='MoreHam.test_yay',
                    sub=['[1-2]'],
                    ),
                source='{}:{}'.format(relfile3, 57),
                markers=None,
                parentid=relfile3 + '::MoreHam::test_yay',
                ),
            TestInfo(
                id=relfile3 + '::MoreHam::test_yay[1-2][3-4]',
                name='test_yay[1-2][3-4]',
                path=TestPath(
                    root=testroot,
                    relfile=relfile3,
                    func='MoreHam.test_yay',
                    sub=['[1-2]', '[3=4]'],
                    ),
                source='{}:{}'.format(relfile3, 72),
                markers=None,
                parentid=relfile3 + '::MoreHam::test_yay[1-2]',
                ),
            TestInfo(
                id=relfile4 + '::SpamTests::test_okay',
                name='test_okay',
                path=TestPath(
                    root=testroot,
                    relfile=relfile4,
                    func='SpamTests.test_okay',
                    ),
                source='{}:{}'.format(relfile4, 15),
                markers=None,
                parentid=relfile4 + '::SpamTests',
                ),
            TestInfo(
                id=relfile5 + '::SpamTests::test_okay',
                name='test_okay',
                path=TestPath(
                    root=testroot,
                    relfile=relfile5,
                    func='SpamTests.test_okay',
                    ),
                source='{}:{}'.format(relfile5, 12),
                markers=None,
                parentid=relfile5 + '::SpamTests',
                ),
            TestInfo(
                id=relfile6 + '::SpamTests::test_okay',
                name='test_okay',
                path=TestPath(
                    root=testroot,
                    relfile=relfile6,
                    func='SpamTests.test_okay',
                    ),
                source='{}:{}'.format(relfile6, 27),
                markers=None,
                parentid=relfile6 + '::SpamTests',
                ),
            ]
        parents = [
            ParentInfo(
                id='.',
                kind='folder',
                name=testroot,
                ),

            ParentInfo(
                id=relfile1,
                kind='file',
                name=os.path.basename(relfile1),
                root=testroot,
                parentid='.',
                ),
            ParentInfo(
                id=relfile1 + '::MySuite',
                kind='suite',
                name='MySuite',
                root=testroot,
                parentid=relfile1,
                ),

            ParentInfo(
                id=relfile2,
                kind='file',
                name=os.path.basename(relfile2),
                root=testroot,
                parentid='.',
                ),
            ParentInfo(
                id=relfile2 + '::SpamTests',
                kind='suite',
                name='SpamTests',
                root=testroot,
                parentid=relfile2,
                ),

            ParentInfo(
                id='./w'.replace('/', os.path.sep),
                kind='folder',
                name='w',
                root=testroot,
                parentid='.',
                ),
            ParentInfo(
                id=relfile3,
                kind='file',
                name=os.path.basename(relfile3),
                root=testroot,
                parentid=os.path.dirname(relfile3),
                ),
            ParentInfo(
                id=relfile3 + '::HamTests',
                kind='suite',
                name='HamTests',
                root=testroot,
                parentid=relfile3,
                ),
            ParentInfo(
                id=relfile3 + '::MoreHam',
                kind='suite',
                name='MoreHam',
                root=testroot,
                parentid=relfile3,
                ),
            ParentInfo(
                id=relfile3 + '::MoreHam::test_yay',
                kind='function',
                name='test_yay',
                root=testroot,
                parentid=relfile3 + '::MoreHam',
                ),
            ParentInfo(
                id=relfile3 + '::MoreHam::test_yay[1-2]',
                kind='subtest',
                name='test_yay[1-2]',
                root=testroot,
                parentid=relfile3 + '::MoreHam::test_yay',
                ),

            ParentInfo(
                id=relfile4,
                kind='file',
                name=os.path.basename(relfile4),
                root=testroot,
                parentid=os.path.dirname(relfile4),
                ),
            ParentInfo(
                id=relfile4 + '::SpamTests',
                kind='suite',
                name='SpamTests',
                root=testroot,
                parentid=relfile4,
                ),

            ParentInfo(
                id='./x'.replace('/', os.path.sep),
                kind='folder',
                name='x',
                root=testroot,
                parentid='.',
                ),
            ParentInfo(
                id='./x/y'.replace('/', os.path.sep),
                kind='folder',
                name='y',
                root=testroot,
                parentid='./x'.replace('/', os.path.sep),
                ),
            ParentInfo(
                id='./x/y/a'.replace('/', os.path.sep),
                kind='folder',
                name='a',
                root=testroot,
                parentid='./x/y'.replace('/', os.path.sep),
                ),
            ParentInfo(
                id=relfile5,
                kind='file',
                name=os.path.basename(relfile5),
                root=testroot,
                parentid=os.path.dirname(relfile5),
                ),
            ParentInfo(
                id=relfile5 + '::SpamTests',
                kind='suite',
                name='SpamTests',
                root=testroot,
                parentid=relfile5,
                ),

            ParentInfo(
                id='./x/y/b'.replace('/', os.path.sep),
                kind='folder',
                name='b',
                root=testroot,
                parentid='./x/y'.replace('/', os.path.sep),
                ),
            ParentInfo(
                id=relfile6,
                kind='file',
                name=os.path.basename(relfile6),
                root=testroot,
                parentid=os.path.dirname(relfile6),
                ),
            ParentInfo(
                id=relfile6 + '::SpamTests',
                kind='suite',
                name='SpamTests',
                root=testroot,
                parentid=relfile6,
                ),
            ]
        expected = [{
            'rootid': '.',
            'root': testroot,
            'parents': [
                 {'id': relfile1,
                  'kind': 'file',
                  'name': os.path.basename(relfile1),
                  'parentid': '.',
                  },
                 {'id': relfile1 + '::MySuite',
                  'kind': 'suite',
                  'name': 'MySuite',
                  'parentid': relfile1,
                  },

                 {'id': relfile2,
                  'kind': 'file',
                  'name': os.path.basename(relfile2),
                  'parentid': '.',
                  },
                 {'id': relfile2 + '::SpamTests',
                  'kind': 'suite',
                  'name': 'SpamTests',
                  'parentid': relfile2,
                  },

                 {'id': './w'.replace('/', os.path.sep),
                  'kind': 'folder',
                  'name': 'w',
                  'parentid': '.',
                  },
                 {'id': relfile3,
                  'kind': 'file',
                  'name': os.path.basename(relfile3),
                  'parentid': os.path.dirname(relfile3),
                  },
                 {'id': relfile3 + '::HamTests',
                  'kind': 'suite',
                  'name': 'HamTests',
                  'parentid': relfile3,
                  },
                 {'id': relfile3 + '::MoreHam',
                  'kind': 'suite',
                  'name': 'MoreHam',
                  'parentid': relfile3,
                  },
                 {'id': relfile3 + '::MoreHam::test_yay',
                  'kind': 'function',
                  'name': 'test_yay',
                  'parentid': relfile3 + '::MoreHam',
                  },
                 {'id': relfile3 + '::MoreHam::test_yay[1-2]',
                  'kind': 'subtest',
                  'name': 'test_yay[1-2]',
                  'parentid': relfile3 + '::MoreHam::test_yay',
                  },

                 {'id': relfile4,
                  'kind': 'file',
                  'name': os.path.basename(relfile4),
                  'parentid': os.path.dirname(relfile4),
                  },
                 {'id': relfile4 + '::SpamTests',
                  'kind': 'suite',
                  'name': 'SpamTests',
                  'parentid': relfile4,
                  },

                 {'id': './x'.replace('/', os.path.sep),
                  'kind': 'folder',
                  'name': 'x',
                  'parentid': '.',
                  },
                 {'id': './x/y'.replace('/', os.path.sep),
                  'kind': 'folder',
                  'name': 'y',
                  'parentid': './x'.replace('/', os.path.sep),
                  },
                 {'id': './x/y/a'.replace('/', os.path.sep),
                  'kind': 'folder',
                  'name': 'a',
                  'parentid': './x/y'.replace('/', os.path.sep),
                  },
                 {'id': relfile5,
                  'kind': 'file',
                  'name': os.path.basename(relfile5),
                  'parentid': os.path.dirname(relfile5),
                  },
                 {'id': relfile5 + '::SpamTests',
                  'kind': 'suite',
                  'name': 'SpamTests',
                  'parentid': relfile5,
                  },

                 {'id': './x/y/b'.replace('/', os.path.sep),
                  'kind': 'folder',
                  'name': 'b',
                  'parentid': './x/y'.replace('/', os.path.sep),
                  },
                 {'id': relfile6,
                  'kind': 'file',
                  'name': os.path.basename(relfile6),
                  'parentid': os.path.dirname(relfile6),
                  },
                 {'id': relfile6 + '::SpamTests',
                  'kind': 'suite',
                  'name': 'SpamTests',
                  'parentid': relfile6,
                  },
                ],
            'tests': [
                {'id': relfile1 + '::MySuite::test_x1',
                 'name': 'test_x1',
                 'source': '{}:{}'.format(relfile1, 10),
                 'markers': [],
                 'parentid': relfile1 + '::MySuite',
                 },
                {'id': relfile1 + '::MySuite::test_x2',
                 'name': 'test_x2',
                 'source': '{}:{}'.format(relfile1, 21),
                 'markers': [],
                 'parentid': relfile1 + '::MySuite',
                 },
                {'id': relfile2 + '::SpamTests::test_okay',
                 'name': 'test_okay',
                 'source': '{}:{}'.format(relfile2, 17),
                 'markers': [],
                 'parentid': relfile2 + '::SpamTests',
                 },
                {'id': relfile3 + '::test_ham1',
                 'name': 'test_ham1',
                 'source': '{}:{}'.format(relfile3, 8),
                 'markers': [],
                 'parentid': relfile3,
                 },
                {'id': relfile3 + '::HamTests::test_uh_oh',
                 'name': 'test_uh_oh',
                 'source': '{}:{}'.format(relfile3, 19),
                 'markers': ['expected-failure'],
                 'parentid': relfile3 + '::HamTests',
                 },
                {'id': relfile3 + '::HamTests::test_whoa',
                 'name': 'test_whoa',
                 'source': '{}:{}'.format(relfile3, 35),
                 'markers': [],
                 'parentid': relfile3 + '::HamTests',
                 },
                {'id': relfile3 + '::MoreHam::test_yay[1-2]',
                 'name': 'test_yay[1-2]',
                 'source': '{}:{}'.format(relfile3, 57),
                 'markers': [],
                 'parentid': relfile3 + '::MoreHam::test_yay',
                 },
                {'id': relfile3 + '::MoreHam::test_yay[1-2][3-4]',
                 'name': 'test_yay[1-2][3-4]',
                 'source': '{}:{}'.format(relfile3, 72),
                 'markers': [],
                 'parentid': relfile3 + '::MoreHam::test_yay[1-2]',
                 },
                {'id': relfile4 + '::SpamTests::test_okay',
                 'name': 'test_okay',
                 'source': '{}:{}'.format(relfile4, 15),
                 'markers': [],
                 'parentid': relfile4 + '::SpamTests',
                 },
                {'id': relfile5 + '::SpamTests::test_okay',
                 'name': 'test_okay',
                 'source': '{}:{}'.format(relfile5, 12),
                 'markers': [],
                 'parentid': relfile5 + '::SpamTests',
                 },
                {'id': relfile6 + '::SpamTests::test_okay',
                 'name': 'test_okay',
                 'source': '{}:{}'.format(relfile6, 27),
                 'markers': [],
                 'parentid': relfile6 + '::SpamTests',
                 },
                ],
            }]

        report_discovered(tests, parents, _send=stub.send)

        self.maxDiff = None
        self.assertEqual(stub.calls, [
            ('send', (expected,), None),
            ])

    def test_simple_basic(self):
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
                source='{}:{}'.format(relfile, 10),
                markers=None,
                parentid='suite#1',
                ),
            ]
        parents = None
        expected = [{
            'id': 'test#1',
            'name': 'test_spam_1',
            'testroot': testroot,
            'relfile': relfile,
            'lineno': 10,
            'testfunc': 'MySuite.test_spam_1',
            'subtest': None,
            'markers': [],
            }]

        report_discovered(tests, parents, simple=True,
                          _send=stub.send)

        self.maxDiff = None
        self.assertEqual(stub.calls, [
            ('send', (expected,), None),
            ])

    def test_simple_complex(self):
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
                source='{}:{}'.format(relfile1, 10),
                markers=None,
                parentid='suite#1',
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
                source='{}:{}'.format(relfile1, 21),
                markers=None,
                parentid='suite#1',
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
                source='{}:{}'.format(relfile2, 17),
                markers=None,
                parentid='suite#2',
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
                source='{}:{}'.format(relfile3, 8),
                markers=None,
                parentid='file#3',
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
                source='{}:{}'.format(relfile3, 19),
                markers=['expected-failure'],
                parentid='suite#3',
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
                source='{}:{}'.format(relfile3, 35),
                markers=None,
                parentid='suite#3',
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
                source='{}:{}'.format(relfile3, 57),
                markers=None,
                parentid='suite#4',
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
                source='{}:{}'.format(relfile3, 72),
                markers=None,
                parentid='suite#3',
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
                source='{}:{}'.format(relfile4, 15),
                markers=None,
                parentid='suite#5',
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
                source='{}:{}'.format(relfile5, 12),
                markers=None,
                parentid='suite#6',
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
                source='{}:{}'.format(relfile6, 27),
                markers=None,
                parentid='suite#7',
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
            'markers': [],
            }, {
            'id': 'test#2',
            'name': 'test_x2',
            'testroot': testroot1,
            'relfile': relfile1,
            'lineno': 21,
            'testfunc': 'MySuite.test_x2',
            'subtest': None,
            'markers': [],
            }, {
            'id': 'test#3',
            'name': 'test_okay',
            'testroot': testroot2,
            'relfile': relfile2,
            'lineno': 17,
            'testfunc': 'SpamTests.test_okay',
            'subtest': None,
            'markers': [],
            }, {
            'id': 'test#4',
            'name': 'test_ham1',
            'testroot': testroot2,
            'relfile': relfile3,
            'lineno': 8,
            'testfunc': 'test_ham1',
            'subtest': None,
            'markers': [],
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
            'markers': [],
            }, {
            'id': 'test#7',
            'name': 'test_yay (sub1)',
            'testroot': testroot2,
            'relfile': relfile3,
            'lineno': 57,
            'testfunc': 'MoreHam.test_yay',
            'subtest': ['sub1'],
            'markers': [],
            }, {
            'id': 'test#8',
            'name': 'test_yay (sub2) (sub3)',
            'testroot': testroot2,
            'relfile': relfile3,
            'lineno': 72,
            'testfunc': 'MoreHam.test_yay',
            'subtest': ['sub2', 'sub3'],
            'markers': [],
            }, {
            'id': 'test#9',
            'name': 'test_okay',
            'testroot': testroot2,
            'relfile': relfile4,
            'lineno': 15,
            'testfunc': 'SpamTests.test_okay',
            'subtest': None,
            'markers': [],
            }, {
            'id': 'test#10',
            'name': 'test_okay',
            'testroot': testroot2,
            'relfile': relfile5,
            'lineno': 12,
            'testfunc': 'SpamTests.test_okay',
            'subtest': None,
            'markers': [],
            }, {
            'id': 'test#11',
            'name': 'test_okay',
            'testroot': testroot2,
            'relfile': relfile6,
            'lineno': 27,
            'testfunc': 'SpamTests.test_okay',
            'subtest': None,
            'markers': [],
            }]
        parents = None

        report_discovered(tests, parents, simple=True,
                          _send=stub.send)

        self.maxDiff = None
        self.assertEqual(stub.calls, [
            ('send', (expected,), None),
            ])

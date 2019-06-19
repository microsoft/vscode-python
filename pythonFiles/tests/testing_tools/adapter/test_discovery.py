# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

from __future__ import absolute_import, print_function

import os.path
import unittest

from testing_tools.adapter.info import TestInfo, TestPath, ParentInfo
from testing_tools.adapter.discovery import DiscoveredTests


def fix_path(nodeid):
    return nodeid.replace('/', os.path.sep)


class DiscoveredTestsTests(unittest.TestCase):

    def test_list(self):
        testroot = fix_path('/a/b/c')
        relfile = 'test_spam.py'
        relfileid = os.path.join('.', relfile)
        tests = [
            TestInfo(
                id=relfile + '::test_each[10-10]',
                name='test_each[10-10]',
                path=TestPath(
                    root=testroot,
                    relfile=relfile,
                    func='test_each',
                    sub=['[10-10]'],
                    ),
                source='{}:{}'.format(relfile, 10),
                markers=None,
                parentid=relfile + '::test_each',
                ),
            TestInfo(
                id=relfile + '::All::BasicTests::test_first',
                name='test_first',
                path=TestPath(
                    root=testroot,
                    relfile=relfile,
                    func='All.BasicTests.test_first',
                    sub=None,
                    ),
                source='{}:{}'.format(relfile, 62),
                markers=None,
                parentid=relfile + '::All::BasicTests',
                ),
            ]
        allparents= [
            [(relfileid + '::test_each', 'test_each', 'function'),
             (relfileid, relfile, 'file'),
             ('.', testroot, 'folder'),
             ],
            [(relfileid + '::All::BasicTests', 'BasicTests', 'suite'),
             (relfileid + '::All', 'All', 'suite'),
             (relfileid, relfile, 'file'),
             ('.', testroot, 'folder'),
             ],
            ]
        expected = [test._replace(id=os.path.join('.', test.id),
                                  parentid=os.path.join('.', test.parentid))
                    for test in tests]
        discovered = DiscoveredTests()
        for test, parents in zip(tests, allparents):
            discovered.add_test(test, parents)
        size = len(discovered)
        items = [discovered[0], discovered[1]]
        snapshot = list(discovered)

        self.maxDiff = None
        self.assertEqual(size, 2)
        self.assertEqual(items, expected)
        self.assertEqual(snapshot, expected)

    def test_reset(self):
        testroot = fix_path('/a/b/c')
        discovered = DiscoveredTests()
        discovered.add_test(
            TestInfo(
                id='./test_spam.py::test_each',
                name='test_each',
                path=TestPath(
                    root=testroot,
                    relfile='test_spam.py',
                    func='test_each',
                    ),
                source='{}:{}'.format('test_spam.py', 11),
                markers=[],
                parentid='./test_spam.py',
                ),
            [('./test_spam.py', 'test_spam.py', 'file'),
             ('.', testroot, 'folder'),
             ])

        before = len(discovered), len(discovered.parents)
        discovered.reset()
        after = len(discovered), len(discovered.parents)

        self.assertEqual(before, (1, 2))
        self.assertEqual(after, (0, 0))

    def test_parents(self):
        testroot = fix_path('/a/b/c')
        relfile = fix_path('x/y/z/test_spam.py')
        relfileid = os.path.join('.', relfile)
        tests = [
            TestInfo(
                id=relfile + '::test_each[10-10]',
                name='test_each[10-10]',
                path=TestPath(
                    root=testroot,
                    relfile=relfile,
                    func='test_each',
                    sub=['[10-10]'],
                    ),
                source='{}:{}'.format(relfile, 10),
                markers=None,
                parentid=relfile + '::test_each',
                ),
            TestInfo(
                id=relfile + '::All::BasicTests::test_first',
                name='test_first',
                path=TestPath(
                    root=testroot,
                    relfile=relfile,
                    func='All.BasicTests.test_first',
                    sub=None,
                    ),
                source='{}:{}'.format(relfile, 61),
                markers=None,
                parentid=relfile + '::All::BasicTests',
                ),
            ]
        allparents= [
            [(relfileid + '::test_each', 'test_each', 'function'),
             (relfileid, relfile, 'file'),
             ('.', testroot, 'folder'),
             ],
            [(relfileid + '::All::BasicTests', 'BasicTests', 'suite'),
             (relfileid + '::All', 'All', 'suite'),
             (relfileid, 'test_spam.py', 'file'),
             (fix_path('./x/y/z'), 'z', 'folder'),
             (fix_path('./x/y'), 'y', 'folder'),
             (fix_path('./x'), 'x', 'folder'),
             ('.', testroot, 'folder'),
             ],
            ]
        discovered = DiscoveredTests()
        for test, parents in zip(tests, allparents):
            discovered.add_test(test, parents)

        parents = discovered.parents

        self.maxDiff = None
        self.assertEqual(parents, [
            ParentInfo(
                id='.',
                kind='folder',
                name=testroot,
                ),
            ParentInfo(
                id=fix_path('./x'),
                kind='folder',
                name='x',
                root=testroot,
                parentid='.',
                ),
            ParentInfo(
                id=fix_path('./x/y'),
                kind='folder',
                name='y',
                root=testroot,
                parentid=fix_path('./x'),
                ),
            ParentInfo(
                id=fix_path('./x/y/z'),
                kind='folder',
                name='z',
                root=testroot,
                parentid=fix_path('./x/y'),
                ),
            ParentInfo(
                id=relfileid,
                kind='file',
                name=os.path.basename(relfile),
                root=testroot,
                parentid=os.path.dirname(relfileid),
                ),
            ParentInfo(
                id=relfileid + '::All',
                kind='suite',
                name='All',
                root=testroot,
                parentid=relfileid,
                ),
            ParentInfo(
                id=relfileid + '::All::BasicTests',
                kind='suite',
                name='BasicTests',
                root=testroot,
                parentid=relfileid + '::All',
                ),
            ParentInfo(
                id=relfileid + '::test_each',
                kind='function',
                name='test_each',
                root=testroot,
                parentid=relfileid,
                ),
            ])

    def test_add_test_simple(self):
        testroot = fix_path('/a/b/c')
        relfile = 'test_spam.py'
        relfileid = os.path.join('.', relfile)
        test = TestInfo(
            id=relfile + '::test_spam',
            name='test_spam',
            path=TestPath(
                root=testroot,
                relfile=relfile,
                func='test_spam',
                ),
            source='{}:{}'.format(relfile, 11),
            markers=[],
            parentid=relfile,
            )
        expected = test._replace(id=os.path.join('.', test.id),
                                 parentid=relfileid)
        discovered = DiscoveredTests()

        before = list(discovered), discovered.parents
        discovered.add_test(test, [
            (relfile, relfile, 'file'),
            ('.', testroot, 'folder'),
            ])
        after = list(discovered), discovered.parents

        self.maxDiff = None
        self.assertEqual(before, ([], []))
        self.assertEqual(after, ([expected], [
            ParentInfo(
                id='.',
                kind='folder',
                name=testroot,
                ),
            ParentInfo(
                id=relfileid,
                kind='file',
                name=relfile,
                root=testroot,
                parentid='.',
                ),
            ]))

    def test_multiroot(self):
        # the first root
        testroot1 = fix_path('/a/b/c')
        relfile1 = 'test_spam.py'
        relfileid1 = os.path.join('.', relfile1)
        alltests = [
            TestInfo(
                id=relfile1 + '::test_spam',
                name='test_spam',
                path=TestPath(
                    root=testroot1,
                    relfile=relfile1,
                    func='test_spam',
                    ),
                source='{}:{}'.format(relfile1, 10),
                markers=[],
                parentid=relfile1,
                ),
            ]
        allparents = [
            [(relfileid1, 'test_spam.py', 'file'),
             ('.', testroot1, 'folder'),
             ],
            ]
        # the second root
        testroot2 = fix_path('/x/y/z')
        relfile2 = 'w/test_eggs.py'
        relfileid2 = os.path.join('.', relfile2)
        alltests.extend([
            TestInfo(
                id=relfile2 + 'BasicTests::test_first',
                name='test_first',
                path=TestPath(
                    root=testroot2,
                    relfile=relfile2,
                    func='BasicTests.test_first',
                    ),
                source='{}:{}'.format(relfile2, 61),
                markers=[],
                parentid=relfile2 + '::BasicTests',
                ),
            ])
        allparents.extend([
            [(relfileid2 + '::BasicTests', 'BasicTests', 'suite'),
             (relfileid2, 'test_eggs.py', 'file'),
             (fix_path('./w'), 'w', 'folder'),
             ('.', testroot2, 'folder'),
             ],
            ])

        discovered = DiscoveredTests()
        for test, parents in zip(alltests, allparents):
            discovered.add_test(test, parents)
        tests = list(discovered)
        parents = discovered.parents

        self.maxDiff = None
        self.assertEqual(tests, [
            # the first root
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
            # the secondroot
            TestInfo(
                id=relfileid2 + 'BasicTests::test_first',
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
        self.assertEqual(parents, [
            # the first root
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
            # the secondroot
            ParentInfo(
                id='.',
                kind='folder',
                name=testroot2,
                ),
            ParentInfo(
                id=fix_path('./w'),
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

    def test_doctest(self):
        testroot = fix_path('/a/b/c')
        doctestfile = fix_path('./x/test_doctest.txt')
        relfile = fix_path('./x/y/z/test_eggs.py')
        alltests = [
            TestInfo(
                id=doctestfile + '::test_doctest.txt',
                name='test_doctest.txt',
                path=TestPath(
                    root=testroot,
                    relfile=doctestfile,
                    func=None,
                    ),
                source='{}:{}'.format(doctestfile, 0),
                markers=[],
                parentid=doctestfile,
                ),
            # With --doctest-modules
            TestInfo(
                id=relfile + '::test_eggs',
                name='test_eggs',
                path=TestPath(
                    root=testroot,
                    relfile=relfile,
                    func=None,
                    ),
                source='{}:{}'.format(relfile, 0),
                markers=[],
                parentid=relfile,
                ),
            TestInfo(
                id=relfile + '::test_eggs.TestSpam',
                name='test_eggs.TestSpam',
                path=TestPath(
                    root=testroot,
                    relfile=relfile,
                    func=None,
                    ),
                source='{}:{}'.format(relfile, 12),
                markers=[],
                parentid=relfile,
                ),
            TestInfo(
                id=relfile + '::test_eggs.TestSpam.TestEggs',
                name='test_eggs.TestSpam.TestEggs',
                path=TestPath(
                    root=testroot,
                    relfile=relfile,
                    func=None,
                    ),
                source='{}:{}'.format(relfile, 27),
                markers=[],
                parentid=relfile,
                ),
            ]
        allparents = [
                [(doctestfile, 'test_doctest.txt', 'file'),
                 (fix_path('./x'), 'x', 'folder'),
                 ('.', testroot, 'folder'),
                 ],
                [(relfile, 'test_eggs.py', 'file'),
                 (fix_path('./x/y/z'), 'z', 'folder'),
                 (fix_path('./x/y'), 'y', 'folder'),
                 (fix_path('./x'), 'x', 'folder'),
                 ('.', testroot, 'folder'),
                 ],
                [(relfile, 'test_eggs.py', 'file'),
                 (fix_path('./x/y/z'), 'z', 'folder'),
                 (fix_path('./x/y'), 'y', 'folder'),
                 (fix_path('./x'), 'x', 'folder'),
                 ('.', testroot, 'folder'),
                 ],
                [(relfile, 'test_eggs.py', 'file'),
                 (fix_path('./x/y/z'), 'z', 'folder'),
                 (fix_path('./x/y'), 'y', 'folder'),
                 (fix_path('./x'), 'x', 'folder'),
                 ('.', testroot, 'folder'),
                 ],
                ]

        discovered = DiscoveredTests()

        for test, parents in zip(alltests, allparents):
            discovered.add_test(test, parents)
        tests = list(discovered)
        parents = discovered.parents

        self.maxDiff = None
        self.assertEqual(tests, alltests)
        self.assertEqual(parents, [
            ParentInfo(
                id='.',
                kind='folder',
                name=testroot,
                ),
            ParentInfo(
                id=fix_path('./x'),
                kind='folder',
                name='x',
                root=testroot,
                parentid='.',
                ),
            ParentInfo(
                id=doctestfile,
                kind='file',
                name=os.path.basename(doctestfile),
                root=testroot,
                parentid=os.path.dirname(doctestfile),
                ),
            ParentInfo(
                id=fix_path('./x/y'),
                kind='folder',
                name='y',
                root=testroot,
                parentid=fix_path('./x'),
                ),
            ParentInfo(
                id=fix_path('./x/y/z'),
                kind='folder',
                name='z',
                root=testroot,
                parentid=fix_path('./x/y'),
                ),
            ParentInfo(
                id=relfile,
                kind='file',
                name=os.path.basename(relfile),
                root=testroot,
                parentid=os.path.dirname(relfile),
                ),
            ])

    def test_nested_suite_simple(self):
        testroot = fix_path('/a/b/c')
        relfile = fix_path('./test_eggs.py')
        alltests = [
            TestInfo(
                id=relfile + '::TestOuter::TestInner::test_spam',
                name='test_spam',
                path=TestPath(
                    root=testroot,
                    relfile=relfile,
                    func='TestOuter.TestInner.test_spam',
                    ),
                source='{}:{}'.format(relfile, 10),
                markers=None,
                parentid=relfile + '::TestOuter::TestInner',
                ),
            TestInfo(
                id=relfile + '::TestOuter::TestInner::test_eggs',
                name='test_eggs',
                path=TestPath(
                    root=testroot,
                    relfile=relfile,
                    func='TestOuter.TestInner.test_eggs',
                    ),
                source='{}:{}'.format(relfile, 21),
                markers=None,
                parentid=relfile + '::TestOuter::TestInner',
                ),
            ]
        allparents= [
            [(relfile + '::TestOuter::TestInner', 'TestInner', 'suite'),
             (relfile + '::TestOuter', 'TestOuter', 'suite'),
             (relfile, 'test_eggs.py', 'file'),
             ('.', testroot, 'folder'),
             ],
            [(relfile + '::TestOuter::TestInner', 'TestInner', 'suite'),
             (relfile + '::TestOuter', 'TestOuter', 'suite'),
             (relfile, 'test_eggs.py', 'file'),
             ('.', testroot, 'folder'),
             ],
            ]

        discovered = DiscoveredTests()
        for test, parents in zip(alltests, allparents):
            discovered.add_test(test, parents)
        tests = list(discovered)
        parents = discovered.parents

        self.maxDiff = None
        self.assertEqual(tests, alltests)
        self.assertEqual(parents, [
            ParentInfo(
                id='.',
                kind='folder',
                name=testroot,
                ),
            ParentInfo(
                id=relfile,
                kind='file',
                name=os.path.basename(relfile),
                root=testroot,
                parentid=os.path.dirname(relfile),
                ),
            ParentInfo(
                id=relfile + '::TestOuter',
                kind='suite',
                name='TestOuter',
                root=testroot,
                parentid=relfile,
                ),
            ParentInfo(
                id=relfile + '::TestOuter::TestInner',
                kind='suite',
                name='TestInner',
                root=testroot,
                parentid=relfile + '::TestOuter',
                ),
            ])

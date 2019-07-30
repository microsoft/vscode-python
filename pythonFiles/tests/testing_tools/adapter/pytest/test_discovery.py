# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

from __future__ import print_function, unicode_literals

try:
    from io import StringIO
except ImportError:  # 2.7
    from StringIO import StringIO
import os
import os.path
import sys
import unittest

import pytest
import _pytest.doctest

from ....util import Stub, StubProxy
from testing_tools.adapter.info import TestInfo, TestPath, ParentInfo
from testing_tools.adapter.pytest._discovery import discover, TestCollector


def fix_path(nodeid):
    return nodeid.replace('/', os.path.sep)


class StubPyTest(StubProxy):

    def __init__(self, stub=None):
        super(StubPyTest, self).__init__(stub, 'pytest')
        self.return_main = 0

    def main(self, args, plugins):
        self.add_call('main', None, {'args': args, 'plugins': plugins})
        return self.return_main


class StubPlugin(StubProxy):

    _started = True

    def __init__(self, stub=None, tests=None):
        super(StubPlugin, self).__init__(stub, 'plugin')
        if tests is None:
            tests = StubDiscoveredTests(self.stub)
        self._tests = tests

    def __getattr__(self, name):
        if not name.startswith('pytest_'):
            raise AttributeError(name)
        def func(*args, **kwargs):
            self.add_call(name, args or None, kwargs or None)
        return func


class StubDiscoveredTests(StubProxy):

    NOT_FOUND = object()

    def __init__(self, stub=None):
        super(StubDiscoveredTests, self).__init__(stub, 'discovered')
        self.return_items = []
        self.return_parents = []

    def __len__(self):
        self.add_call('__len__', None, None)
        return len(self.return_items)

    def __getitem__(self, index):
        self.add_call('__getitem__', (index,), None)
        return self.return_items[index]

    @property
    def parents(self):
        self.add_call('parents', None, None)
        return self.return_parents

    def reset(self):
        self.add_call('reset', None, None)

    def add_test(self, test, parents):
        self.add_call('add_test', None, {'test': test, 'parents': parents})


class FakeFunc(object):

    def __init__(self, name):
        self.__name__ = name


class FakeMarker(object):

    def __init__(self, name):
        self.name = name


class StubPytestItem(StubProxy):

    _debugging = False
    _hasfunc = True

    def __init__(self, stub=None, **attrs):
        super(StubPytestItem, self).__init__(stub, 'pytest.Item')
        if attrs.get('function') is None:
            attrs.pop('function', None)
            self._hasfunc = False

        attrs.setdefault('user_properties', [])

        self.__dict__.update(attrs)

        if 'own_markers' not in attrs:
            self.own_markers = ()

    def __repr__(self):
        return object.__repr__(self)

    def __getattr__(self, name):
        if not self._debugging:
            self.add_call(name + ' (attr)', None, None)
        if name == 'function':
            if not self._hasfunc:
                raise AttributeError(name)
        def func(*args, **kwargs):
            self.add_call(name, args or None, kwargs or None)
        return func


class StubSubtypedItem(StubPytestItem):

    def __init__(self, *args, **kwargs):
        super(StubSubtypedItem, self).__init__(*args, **kwargs)
        if 'nodeid' in self.__dict__:
            self._nodeid = self.__dict__.pop('nodeid')

    @property
    def location(self):
        return self.__dict__.get('location')


class StubFunctionItem(StubSubtypedItem, pytest.Function):

    @property
    def function(self):
        return self.__dict__.get('function')


class StubDoctestItem(StubSubtypedItem, _pytest.doctest.DoctestItem):
    pass


class StubPytestSession(StubProxy):

    def __init__(self, stub=None):
        super(StubPytestSession, self).__init__(stub, 'pytest.Session')

    def __getattr__(self, name):
        self.add_call(name + ' (attr)', None, None)
        def func(*args, **kwargs):
            self.add_call(name, args or None, kwargs or None)
        return func


class StubPytestConfig(StubProxy):

    def __init__(self, stub=None):
        super(StubPytestConfig, self).__init__(stub, 'pytest.Config')

    def __getattr__(self, name):
        self.add_call(name + ' (attr)', None, None)
        def func(*args, **kwargs):
            self.add_call(name, args or None, kwargs or None)
        return func


##################################
# tests

class DiscoverTests(unittest.TestCase):

    DEFAULT_ARGS = [
        '--collect-only',
        ]

    def test_basic(self):
        stub = Stub()
        stubpytest = StubPyTest(stub)
        plugin = StubPlugin(stub)
        expected = []
        plugin.discovered = expected

        parents, tests = discover([], _pytest_main=stubpytest.main, _plugin=plugin)

        self.assertEqual(parents, [])
        self.assertEqual(tests, expected)
        self.assertEqual(stub.calls, [
            ('pytest.main', None, {'args': self.DEFAULT_ARGS,
                                   'plugins': [plugin]}),
            ('discovered.parents', None, None),
            ('discovered.__len__', None, None),
            ('discovered.__getitem__', (0,), None),
            ])

    def test_failure(self):
        stub = Stub()
        pytest = StubPyTest(stub)
        pytest.return_main = 2
        plugin = StubPlugin(stub)

        with self.assertRaises(Exception):
            discover([], _pytest_main=pytest.main, _plugin=plugin)

        self.assertEqual(stub.calls, [
            ('pytest.main', None, {'args': self.DEFAULT_ARGS,
                                   'plugins': [plugin]}),
            ])

    def test_no_tests_found(self):
        stub = Stub()
        pytest = StubPyTest(stub)
        pytest.return_main = 5
        plugin = StubPlugin(stub)
        expected = []
        plugin.discovered = expected

        parents, tests = discover([], _pytest_main=pytest.main, _plugin=plugin)

        self.assertEqual(parents, [])
        self.assertEqual(tests, expected)
        self.assertEqual(stub.calls, [
            ('pytest.main', None, {'args': self.DEFAULT_ARGS,
                                   'plugins': [plugin]}),
            ('discovered.parents', None, None),
            ('discovered.__len__', None, None),
            ('discovered.__getitem__', (0,), None),
            ])

    def test_stdio_hidden(self):
        pytest_stdout = 'spamspamspamspamspamspamspammityspam'
        stub = Stub()
        def fake_pytest_main(args, plugins):
            stub.add_call('pytest.main', None, {'args': args,
                                                'plugins': plugins})
            print(pytest_stdout, end='')
            return 0
        plugin = StubPlugin(stub)
        plugin.discovered = []
        buf = StringIO()

        sys.stdout = buf
        try:
            discover([], hidestdio=True,
                     _pytest_main=fake_pytest_main, _plugin=plugin)
        finally:
            sys.stdout = sys.__stdout__
        captured = buf.getvalue()

        self.assertEqual(captured, '')
        self.assertEqual(stub.calls, [
            ('pytest.main', None, {'args': self.DEFAULT_ARGS,
                                   'plugins': [plugin]}),
            ('discovered.parents', None, None),
            ('discovered.__len__', None, None),
            ('discovered.__getitem__', (0,), None),
            ])

    def test_stdio_not_hidden(self):
        pytest_stdout = 'spamspamspamspamspamspamspammityspam'
        stub = Stub()
        def fake_pytest_main(args, plugins):
            stub.add_call('pytest.main', None, {'args': args,
                                                'plugins': plugins})
            print(pytest_stdout, end='')
            return 0
        plugin = StubPlugin(stub)
        plugin.discovered = []
        buf = StringIO()

        sys.stdout = buf
        try:
            discover([], hidestdio=False,
                     _pytest_main=fake_pytest_main, _plugin=plugin)
        finally:
            sys.stdout = sys.__stdout__
        captured = buf.getvalue()

        self.assertEqual(captured, pytest_stdout)
        self.assertEqual(stub.calls, [
            ('pytest.main', None, {'args': self.DEFAULT_ARGS,
                                   'plugins': [plugin]}),
            ('discovered.parents', None, None),
            ('discovered.__len__', None, None),
            ('discovered.__getitem__', (0,), None),
            ])


class CollectorTests(unittest.TestCase):

    def test_modifyitems(self):
        stub = Stub()
        discovered = StubDiscoveredTests(stub)
        session = StubPytestSession(stub)
        config = StubPytestConfig(stub)
        collector = TestCollector(tests=discovered)

        testroot = fix_path('/a/b/c')
        relfile1 = fix_path('./test_spam.py')
        relfile2 = fix_path('x/y/z/test_eggs.py')
        relfileid2 = os.path.join('.', relfile2)

        collector.pytest_collection_modifyitems(session, config, [
            StubFunctionItem(
                stub,
                nodeid='test_spam.py::SpamTests::test_one',
                name='test_one',
                location=('test_spam.py', 12, 'SpamTests.test_one'),
                fspath=os.path.join(testroot, 'test_spam.py'),
                function=FakeFunc('test_one'),
                ),
            StubFunctionItem(
                stub,
                nodeid='test_spam.py::SpamTests::test_other',
                name='test_other',
                location=('test_spam.py', 19, 'SpamTests.test_other'),
                fspath=os.path.join(testroot, 'test_spam.py'),
                function=FakeFunc('test_other'),
                ),
            StubFunctionItem(
                stub,
                nodeid='test_spam.py::test_all',
                name='test_all',
                location=('test_spam.py', 144, 'test_all'),
                fspath=os.path.join(testroot, 'test_spam.py'),
                function=FakeFunc('test_all'),
                ),
            StubFunctionItem(
                stub,
                nodeid='test_spam.py::test_each[10-10]',
                name='test_each[10-10]',
                location=('test_spam.py', 273, 'test_each[10-10]'),
                fspath=os.path.join(testroot, 'test_spam.py'),
                function=FakeFunc('test_each'),
                ),
            StubFunctionItem(
                stub,
                nodeid=relfile2 + '::All::BasicTests::test_first',
                name='test_first',
                location=(relfile2, 31, 'All.BasicTests.test_first'),
                fspath=os.path.join(testroot, relfile2),
                function=FakeFunc('test_first'),
                ),
            StubFunctionItem(
                stub,
                nodeid=relfile2 + '::All::BasicTests::test_each[1+2-3]',
                name='test_each[1+2-3]',
                location=(relfile2, 62, 'All.BasicTests.test_each[1+2-3]'),
                fspath=os.path.join(testroot, relfile2),
                function=FakeFunc('test_each'),
                own_markers=[FakeMarker(v) for v in [
                    # supported
                    'skip', 'skipif', 'xfail',
                    # duplicate
                    'skip',
                    # ignored (pytest-supported)
                    'parameterize', 'usefixtures', 'filterwarnings',
                    # ignored (custom)
                    'timeout',
                    ]],
                ),
            ])

        self.maxDiff = None
        self.assertEqual(stub.calls, [
            ('discovered.reset', None, None),
            ('discovered.add_test', None, dict(
                parents=[
                    (relfile1 + '::SpamTests', 'SpamTests', 'suite'),
                    (relfile1, 'test_spam.py', 'file'),
                    ('.', testroot, 'folder'),
                    ],
                test=TestInfo(
                    id=relfile1 + '::SpamTests::test_one',
                    name='test_one',
                    path=TestPath(
                        root=testroot,
                        relfile=relfile1,
                        func='SpamTests.test_one',
                        sub=None,
                        ),
                    source='{}:{}'.format(relfile1, 13),
                    markers=None,
                    parentid=relfile1 + '::SpamTests',
                    ),
                )),
            ('discovered.add_test', None, dict(
                parents=[
                    (relfile1 + '::SpamTests', 'SpamTests', 'suite'),
                    (relfile1, 'test_spam.py', 'file'),
                    ('.', testroot, 'folder'),
                    ],
                test=TestInfo(
                    id=relfile1 + '::SpamTests::test_other',
                    name='test_other',
                    path=TestPath(
                        root=testroot,
                        relfile=relfile1,
                        func='SpamTests.test_other',
                        sub=None,
                        ),
                    source='{}:{}'.format(relfile1, 20),
                    markers=None,
                    parentid=relfile1 + '::SpamTests',
                    ),
                )),
            ('discovered.add_test', None, dict(
                parents=[
                    (relfile1, 'test_spam.py', 'file'),
                    ('.', testroot, 'folder'),
                    ],
                test=TestInfo(
                    id=relfile1 + '::test_all',
                    name='test_all',
                    path=TestPath(
                        root=testroot,
                        relfile=relfile1,
                        func='test_all',
                        sub=None,
                        ),
                    source='{}:{}'.format(relfile1, 145),
                    markers=None,
                    parentid=relfile1,
                    ),
                )),
            ('discovered.add_test', None, dict(
                parents=[
                    (relfile1 + '::test_each', 'test_each', 'function'),
                    (relfile1, 'test_spam.py', 'file'),
                    ('.', testroot, 'folder'),
                    ],
                test=TestInfo(
                    id=relfile1 + '::test_each[10-10]',
                    name='test_each[10-10]',
                    path=TestPath(
                        root=testroot,
                        relfile=relfile1,
                        func='test_each',
                        sub=['[10-10]'],
                        ),
                    source='{}:{}'.format(relfile1, 274),
                    markers=None,
                    parentid=relfile1 + '::test_each',
                    ),
                )),
            ('discovered.add_test', None, dict(
                parents=[
                    (relfileid2 + '::All::BasicTests', 'BasicTests', 'suite'),
                    (relfileid2 + '::All', 'All', 'suite'),
                    (relfileid2, 'test_eggs.py', 'file'),
                    (fix_path('./x/y/z'), 'z', 'folder'),
                    (fix_path('./x/y'), 'y', 'folder'),
                    (fix_path('./x'), 'x', 'folder'),
                    ('.', testroot, 'folder'),
                    ],
                test=TestInfo(
                    id=relfileid2 + '::All::BasicTests::test_first',
                    name='test_first',
                    path=TestPath(
                        root=testroot,
                        relfile=relfileid2,
                        func='All.BasicTests.test_first',
                        sub=None,
                        ),
                    source='{}:{}'.format(relfileid2, 32),
                    markers=None,
                    parentid=relfileid2 + '::All::BasicTests',
                    ),
                )),
            ('discovered.add_test', None, dict(
                parents=[
                    (relfileid2 + '::All::BasicTests::test_each', 'test_each', 'function'),
                    (relfileid2 + '::All::BasicTests', 'BasicTests', 'suite'),
                    (relfileid2 + '::All', 'All', 'suite'),
                    (relfileid2, 'test_eggs.py', 'file'),
                    (fix_path('./x/y/z'), 'z', 'folder'),
                    (fix_path('./x/y'), 'y', 'folder'),
                    (fix_path('./x'), 'x', 'folder'),
                    ('.', testroot, 'folder'),
                    ],
                test=TestInfo(
                    id=relfileid2 + '::All::BasicTests::test_each[1+2-3]',
                    name='test_each[1+2-3]',
                    path=TestPath(
                        root=testroot,
                        relfile=relfileid2,
                        func='All.BasicTests.test_each',
                        sub=['[1+2-3]'],
                        ),
                    source='{}:{}'.format(relfileid2, 63),
                    markers=['expected-failure', 'skip', 'skip-if'],
                    parentid=relfileid2 + '::All::BasicTests::test_each',
                    ),
                )),
            ])

    def test_finish(self):
        stub = Stub()
        discovered = StubDiscoveredTests(stub)
        session = StubPytestSession(stub)
        testroot = fix_path('/a/b/c')
        relfile = fix_path('x/y/z/test_eggs.py')
        relfileid = os.path.join('.', relfile)
        session.items = [
            StubFunctionItem(
                stub,
                nodeid=relfile + '::SpamTests::test_spam',
                name='test_spam',
                location=(relfile, 12, 'SpamTests.test_spam'),
                fspath=os.path.join(testroot, relfile),
                function=FakeFunc('test_spam'),
                ),
            ]
        collector = TestCollector(tests=discovered)

        collector.pytest_collection_finish(session)

        self.maxDiff = None
        self.assertEqual(stub.calls, [
            ('discovered.reset', None, None),
            ('discovered.add_test', None, dict(
                parents=[
                    (relfileid + '::SpamTests', 'SpamTests', 'suite'),
                    (relfileid, 'test_eggs.py', 'file'),
                    (fix_path('./x/y/z'), 'z', 'folder'),
                    (fix_path('./x/y'), 'y', 'folder'),
                    (fix_path('./x'), 'x', 'folder'),
                    ('.', testroot, 'folder'),
                    ],
                test=TestInfo(
                    id=relfileid + '::SpamTests::test_spam',
                    name='test_spam',
                    path=TestPath(
                        root=testroot,
                        relfile=relfileid,
                        func='SpamTests.test_spam',
                        sub=None,
                        ),
                    source='{}:{}'.format(relfileid, 13),
                    markers=None,
                    parentid=relfileid + '::SpamTests',
                    ),
                )),
            ])

    def test_doctest(self):
        stub = Stub()
        discovered = StubDiscoveredTests(stub)
        session = StubPytestSession(stub)
        testroot = fix_path('/a/b/c')
        doctestfile = fix_path('x/test_doctest.txt')
        doctestfileid = os.path.join('.', doctestfile)
        relfile = fix_path('x/y/z/test_eggs.py')
        relfileid = os.path.join('.', relfile)
        session.items = [
            StubDoctestItem(
                stub,
                nodeid=doctestfile + '::test_doctest.txt',
                name='test_doctest.txt',
                location=(doctestfile, 0, '[doctest] test_doctest.txt'),
                fspath=os.path.join(testroot, doctestfile),
                ),
            # With --doctest-modules
            StubDoctestItem(
                stub,
                nodeid=relfile + '::test_eggs',
                name='test_eggs',
                location=(relfile, 0, '[doctest] test_eggs'),
                fspath=os.path.join(testroot, relfile),
                ),
            StubDoctestItem(
                stub,
                nodeid=relfile + '::test_eggs.TestSpam',
                name='test_eggs.TestSpam',
                location=(relfile, 12, '[doctest] test_eggs.TestSpam'),
                fspath=os.path.join(testroot, relfile),
                ),
            StubDoctestItem(
                stub,
                nodeid=relfile + '::test_eggs.TestSpam.TestEggs',
                name='test_eggs.TestSpam.TestEggs',
                location=(relfile, 27, '[doctest] test_eggs.TestSpam.TestEggs'),
                fspath=os.path.join(testroot, relfile),
                ),
            ]
        collector = TestCollector(tests=discovered)

        collector.pytest_collection_finish(session)

        self.maxDiff = None
        self.assertEqual(stub.calls, [
            ('discovered.reset', None, None),
            ('discovered.add_test', None, dict(
                parents=[
                    (doctestfileid, 'test_doctest.txt', 'file'),
                    (fix_path('./x'), 'x', 'folder'),
                    ('.', testroot, 'folder'),
                    ],
                test=TestInfo(
                    id=doctestfileid + '::test_doctest.txt',
                    name='test_doctest.txt',
                    path=TestPath(
                        root=testroot,
                        relfile=doctestfileid,
                        func=None,
                        ),
                    source='{}:{}'.format(doctestfileid, 1),
                    markers=[],
                    parentid=doctestfileid,
                    ),
                )),
            ('discovered.add_test', None, dict(
                parents=[
                    (relfileid, 'test_eggs.py', 'file'),
                    (fix_path('./x/y/z'), 'z', 'folder'),
                    (fix_path('./x/y'), 'y', 'folder'),
                    (fix_path('./x'), 'x', 'folder'),
                    ('.', testroot, 'folder'),
                    ],
                test=TestInfo(
                    id=relfileid + '::test_eggs',
                    name='test_eggs',
                    path=TestPath(
                        root=testroot,
                        relfile=relfileid,
                        func=None,
                        ),
                    source='{}:{}'.format(relfileid, 1),
                    markers=[],
                    parentid=relfileid,
                    ),
                )),
            ('discovered.add_test', None, dict(
                parents=[
                    (relfileid, 'test_eggs.py', 'file'),
                    (fix_path('./x/y/z'), 'z', 'folder'),
                    (fix_path('./x/y'), 'y', 'folder'),
                    (fix_path('./x'), 'x', 'folder'),
                    ('.', testroot, 'folder'),
                    ],
                test=TestInfo(
                    id=relfileid + '::test_eggs.TestSpam',
                    name='test_eggs.TestSpam',
                    path=TestPath(
                        root=testroot,
                        relfile=relfileid,
                        func=None,
                        ),
                    source='{}:{}'.format(relfileid, 13),
                    markers=[],
                    parentid=relfileid,
                    ),
                )),
            ('discovered.add_test', None, dict(
                parents=[
                    (relfileid, 'test_eggs.py', 'file'),
                    (fix_path('./x/y/z'), 'z', 'folder'),
                    (fix_path('./x/y'), 'y', 'folder'),
                    (fix_path('./x'), 'x', 'folder'),
                    ('.', testroot, 'folder'),
                    ],
                test=TestInfo(
                    id=relfileid + '::test_eggs.TestSpam.TestEggs',
                    name='test_eggs.TestSpam.TestEggs',
                    path=TestPath(
                        root=testroot,
                        relfile=relfileid,
                        func=None,
                        ),
                    source='{}:{}'.format(relfileid, 28),
                    markers=[],
                    parentid=relfileid,
                    ),
                )),
            ])

    def test_nested_brackets(self):
        stub = Stub()
        discovered = StubDiscoveredTests(stub)
        session = StubPytestSession(stub)
        testroot = fix_path('/a/b/c')
        relfile = fix_path('x/y/z/test_eggs.py')
        relfileid = os.path.join('.', relfile)
        session.items = [
            StubFunctionItem(
                stub,
                nodeid=relfile + '::SpamTests::test_spam[a-[b]-c]',
                name='test_spam[a-[b]-c]',
                location=(relfile, 12, 'SpamTests.test_spam[a-[b]-c]'),
                fspath=os.path.join(testroot, relfile),
                function=FakeFunc('test_spam'),
                ),
            ]
        collector = TestCollector(tests=discovered)

        collector.pytest_collection_finish(session)

        self.maxDiff = None
        self.assertEqual(stub.calls, [
            ('discovered.reset', None, None),
            ('discovered.add_test', None, dict(
                parents=[
                    (relfileid + '::SpamTests::test_spam', 'test_spam', 'function'),
                    (relfileid + '::SpamTests', 'SpamTests', 'suite'),
                    (relfileid, 'test_eggs.py', 'file'),
                    (fix_path('./x/y/z'), 'z', 'folder'),
                    (fix_path('./x/y'), 'y', 'folder'),
                    (fix_path('./x'), 'x', 'folder'),
                    ('.', testroot, 'folder'),
                    ],
                test=TestInfo(
                    id=relfileid + '::SpamTests::test_spam[a-[b]-c]',
                    name='test_spam[a-[b]-c]',
                    path=TestPath(
                        root=testroot,
                        relfile=relfileid,
                        func='SpamTests.test_spam',
                        sub=['[a-[b]-c]'],
                        ),
                    source='{}:{}'.format(relfileid, 13),
                    markers=None,
                    parentid=relfileid + '::SpamTests::test_spam',
                    ),
                )),
            ])

    def test_nested_suite(self):
        stub = Stub()
        discovered = StubDiscoveredTests(stub)
        session = StubPytestSession(stub)
        testroot = fix_path('/a/b/c')
        relfile = fix_path('x/y/z/test_eggs.py')
        relfileid = os.path.join('.', relfile)
        session.items = [
            StubFunctionItem(
                stub,
                nodeid=relfile + '::SpamTests::Ham::Eggs::test_spam',
                name='test_spam',
                location=(relfile, 12, 'SpamTests.Ham.Eggs.test_spam'),
                fspath=os.path.join(testroot, relfile),
                function=FakeFunc('test_spam'),
                ),
            ]
        collector = TestCollector(tests=discovered)

        collector.pytest_collection_finish(session)

        self.maxDiff = None
        self.assertEqual(stub.calls, [
            ('discovered.reset', None, None),
            ('discovered.add_test', None, dict(
                parents=[
                    (relfileid + '::SpamTests::Ham::Eggs', 'Eggs', 'suite'),
                    (relfileid + '::SpamTests::Ham', 'Ham', 'suite'),
                    (relfileid + '::SpamTests', 'SpamTests', 'suite'),
                    (relfileid, 'test_eggs.py', 'file'),
                    (fix_path('./x/y/z'), 'z', 'folder'),
                    (fix_path('./x/y'), 'y', 'folder'),
                    (fix_path('./x'), 'x', 'folder'),
                    ('.', testroot, 'folder'),
                    ],
                test=TestInfo(
                    id=relfileid + '::SpamTests::Ham::Eggs::test_spam',
                    name='test_spam',
                    path=TestPath(
                        root=testroot,
                        relfile=relfileid,
                        func='SpamTests.Ham.Eggs.test_spam',
                        sub=None,
                        ),
                    source='{}:{}'.format(relfileid, 13),
                    markers=None,
                    parentid=relfileid + '::SpamTests::Ham::Eggs',
                    ),
                )),
            ])

    def test_windows(self):
        stub = Stub()
        discovered = StubDiscoveredTests(stub)
        session = StubPytestSession(stub)
        testroot = r'c:\a\b\c'
        relfile = r'X\Y\Z\test_eggs.py'
        session.items = [
            StubFunctionItem(
                stub,
                nodeid='X/Y/Z/test_eggs.py::SpamTests::test_spam',
                name='test_spam',
                location=('x/y/z/test_eggs.py', 12, 'SpamTests.test_spam'),
                fspath=testroot + '\\' + relfile,
                function=FakeFunc('test_spam'),
                ),
            ]
        collector = TestCollector(tests=discovered)
        if os.name != 'nt':
            def normcase(path):
                path = path.lower()
                return path.replace('/', '\\')
            collector.NORMCASE = normcase
            collector.PATHSEP = '\\'

        collector.pytest_collection_finish(session)

        self.maxDiff = None
        self.assertEqual(stub.calls, [
            ('discovered.reset', None, None),
            ('discovered.add_test', None, dict(
                parents=[
                    (r'.\x\y\z\test_eggs.py::SpamTests', 'SpamTests', 'suite'),
                    (r'.\x\y\z\test_eggs.py', 'test_eggs.py', 'file'),
                    (r'.\x\y\z', 'z', 'folder'),
                    (r'.\x\y', 'y', 'folder'),
                    (r'.\x', 'x', 'folder'),
                    ('.', testroot, 'folder'),
                    ],
                test=TestInfo(
                    id=r'.\x\y\z\test_eggs.py::SpamTests::test_spam',
                    name='test_spam',
                    path=TestPath(
                        root=testroot,
                        relfile=r'.\X\Y\Z\test_eggs.py',
                        func='SpamTests.test_spam',
                        sub=None,
                        ),
                    source=r'.\X\Y\Z\test_eggs.py:{}'.format(13),
                    markers=None,
                    parentid=r'.\x\y\z\test_eggs.py::SpamTests',
                    ),
                )),
            ])

    def test_mysterious_parens(self):
        stub = Stub()
        discovered = StubDiscoveredTests(stub)
        session = StubPytestSession(stub)
        testroot = fix_path('/a/b/c')
        relfile = fix_path('x/y/z/test_eggs.py')
        relfileid = os.path.join('.', relfile)
        session.items = [
            StubFunctionItem(
                stub,
                nodeid=relfile + '::SpamTests::()::()::test_spam',
                name='test_spam',
                location=(relfile, 12, 'SpamTests.test_spam'),
                fspath=os.path.join(testroot, relfile),
                function=FakeFunc('test_spam'),
                ),
            ]
        collector = TestCollector(tests=discovered)

        collector.pytest_collection_finish(session)

        self.maxDiff = None
        self.assertEqual(stub.calls, [
            ('discovered.reset', None, None),
            ('discovered.add_test', None, dict(
                parents=[
                    (relfileid + '::SpamTests', 'SpamTests', 'suite'),
                    (relfileid, 'test_eggs.py', 'file'),
                    (fix_path('./x/y/z'), 'z', 'folder'),
                    (fix_path('./x/y'), 'y', 'folder'),
                    (fix_path('./x'), 'x', 'folder'),
                    ('.', testroot, 'folder'),
                    ],
                test=TestInfo(
                    id=relfileid + '::SpamTests::test_spam',
                    name='test_spam',
                    path=TestPath(
                        root=testroot,
                        relfile=relfileid,
                        func='SpamTests.test_spam',
                        sub=[],
                        ),
                    source='{}:{}'.format(relfileid, 13),
                    markers=None,
                    parentid=relfileid + '::SpamTests',
                    ),
                )),
            ])

    def test_imported_test(self):
        # pytest will even discover tests that were imported from
        # another module!
        stub = Stub()
        discovered = StubDiscoveredTests(stub)
        session = StubPytestSession(stub)
        testroot = fix_path('/a/b/c')
        relfile = fix_path('x/y/z/test_eggs.py')
        relfileid = os.path.join('.', relfile)
        srcfile = fix_path('x/y/z/_extern.py')
        session.items = [
            StubFunctionItem(
                stub,
                nodeid=relfile + '::SpamTests::test_spam',
                name='test_spam',
                location=(srcfile, 12, 'SpamTests.test_spam'),
                fspath=os.path.join(testroot, relfile),
                function=FakeFunc('test_spam'),
                ),
            StubFunctionItem(
                stub,
                nodeid=relfile + '::test_ham',
                name='test_ham',
                location=(srcfile, 3, 'test_ham'),
                fspath=os.path.join(testroot, relfile),
                function=FakeFunc('test_spam'),
                ),
            ]
        collector = TestCollector(tests=discovered)

        collector.pytest_collection_finish(session)

        self.maxDiff = None
        self.assertEqual(stub.calls, [
            ('discovered.reset', None, None),
            ('discovered.add_test', None, dict(
                parents=[
                    (relfileid + '::SpamTests', 'SpamTests', 'suite'),
                    (relfileid, 'test_eggs.py', 'file'),
                    (fix_path('./x/y/z'), 'z', 'folder'),
                    (fix_path('./x/y'), 'y', 'folder'),
                    (fix_path('./x'), 'x', 'folder'),
                    ('.', testroot, 'folder'),
                    ],
                test=TestInfo(
                    id=relfileid + '::SpamTests::test_spam',
                    name='test_spam',
                    path=TestPath(
                        root=testroot,
                        relfile=relfileid,
                        func='SpamTests.test_spam',
                        sub=None,
                        ),
                    source='{}:{}'.format(os.path.join('.', srcfile), 13),
                    markers=None,
                    parentid=relfileid + '::SpamTests',
                    ),
                )),
            ('discovered.add_test', None, dict(
                parents=[
                    (relfileid, 'test_eggs.py', 'file'),
                    (fix_path('./x/y/z'), 'z', 'folder'),
                    (fix_path('./x/y'), 'y', 'folder'),
                    (fix_path('./x'), 'x', 'folder'),
                    ('.', testroot, 'folder'),
                    ],
                test=TestInfo(
                    id=relfileid + '::test_ham',
                    name='test_ham',
                    path=TestPath(
                        root=testroot,
                        relfile=relfileid,
                        func='test_ham',
                        sub=None,
                        ),
                    source='{}:{}'.format(os.path.join('.', srcfile), 4),
                    markers=None,
                    parentid=relfileid,
                    ),
                )),
            ])

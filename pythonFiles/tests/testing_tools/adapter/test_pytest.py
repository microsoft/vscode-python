import os.path
import unittest

from ...util import Stub, StubProxy
from testing_tools.adapter.errors import UnsupportedCommandError
from testing_tools.adapter.info import TestInfo, TestPath
from testing_tools.adapter.pytest import (
        discover, add_cli_subparser, TestCollector
        )


class StubSubparsers(StubProxy):

    def __init__(self, stub=None, name='subparsers'):
        super().__init__(stub, name)

    def add_parser(self, name):
        self.add_call('add_parser', None, {'name': name})
        return self.return_add_parser


class StubArgParser(StubProxy):

    def __init__(self, stub=None):
        super().__init__(stub, 'argparser')

    def add_argument(self, *args, **kwargs):
        self.add_call('add_argument', args, kwargs)


class StubPyTest(StubProxy):

    def __init__(self, stub=None):
        super().__init__(stub, 'pytest')
        self.return_main = 0

    def main(self, args, plugins):
        self.add_call('main', None, {'args': args, 'plugins': plugins})
        return self.return_main


class StubPlugin(StubProxy):

    def __init__(self, stub=None):
        super().__init__(stub, 'plugin')

    def __getattr__(self, name):
        if not name.startswith('pytest_'):
            raise AttributeError(name)
        def func(*args, **kwargs):
            self.add_call(name, args or None, kwargs or None)
        return func


class FakeFunc(object):

    def __init__(self, name):
        self.__name__ = name


class FakeMarker(object):

    def __init__(self, name):
        self.name = name


class StubPytestItem(StubProxy):

    def __init__(self, stub=None, **attrs):
        super().__init__(stub, 'pytest.Item')
        self.__dict__.update(attrs)
        if 'own_markers' not in attrs:
            self.own_markers = ()

    def __getattr__(self, name):
        self.add_call(name + ' (attr)', None, None)
        def func(*args, **kwargs):
            self.add_call(name, args or None, kwargs or None)
        return func


class StubPytestSession(StubProxy):

    def __init__(self, stub=None):
        super().__init__(stub, 'pytest.Session')

    def __getattr__(self, name):
        self.add_call(name + ' (attr)', None, None)
        def func(*args, **kwargs):
            self.add_call(name, args or None, kwargs or None)
        return func


class StubPytestConfig(StubProxy):

    def __init__(self, stub=None):
        super().__init__(stub, 'pytest.Config')

    def __getattr__(self, name):
        self.add_call(name + ' (attr)', None, None)
        def func(*args, **kwargs):
            self.add_call(name, args or None, kwargs or None)
        return func


##################################
# tests

class AddCLISubparserTests(unittest.TestCase):

    def test_discover(self):
        stub = Stub()
        subparsers = StubSubparsers(stub)
        parser = StubArgParser(stub)
        subparsers.return_add_parser = parser

        add_cli_subparser('discover', 'pytest', subparsers)

        self.assertEqual(stub.calls, [
            ('subparsers.add_parser', None, {'name': 'pytest'}),
            ])

    def test_unsupported_command(self):
        subparsers = StubSubparsers(name=None)
        subparsers.return_add_parser = None

        with self.assertRaises(UnsupportedCommandError):
            add_cli_subparser('run', 'pytest', subparsers)
        with self.assertRaises(UnsupportedCommandError):
            add_cli_subparser('debug', 'pytest', subparsers)
        with self.assertRaises(UnsupportedCommandError):
            add_cli_subparser('???', 'pytest', subparsers)
        self.assertEqual(subparsers.calls, [
            ('add_parser', None, {'name': 'pytest'}),
            ('add_parser', None, {'name': 'pytest'}),
            ('add_parser', None, {'name': 'pytest'}),
            ])


class DiscoverTests(unittest.TestCase):

    DEFAULT_ARGS = [
        '-pno:terminal',
        '--collect-only',
        ]

    def test_basic(self):
        stub = Stub()
        pytest = StubPyTest(stub)
        plugin = StubPlugin(stub)
        expected = []
        plugin.discovered = expected

        discovered = discover([], _pytest_main=pytest.main, _plugin=plugin)

        self.assertEqual(discovered, expected)
        self.assertEqual(stub.calls, [
            ('pytest.main', None, {'args': self.DEFAULT_ARGS,
                                   'plugins': [plugin]}),
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


class CollectorTests(unittest.TestCase):

    def test_modifyitems(self):
        stub = Stub()
        session = StubPytestSession(stub)
        config = StubPytestConfig(stub)
        collector = TestCollector()

        testroot = '/a/b/c'.replace('/', os.path.sep)
        relfile1 = './test_spam.py'.replace('/', os.path.sep)
        relfile2 = 'x/y/z/test_eggs.py'.replace('/', os.path.sep)

        collector.pytest_collection_modifyitems(session, config, [
            StubPytestItem(
                stub,
                nodeid='test_spam.py::SpamTests::test_one',
                name='test_one',
                location=('test_spam.py', 12, 'SpamTests.test_one'),
                fspath=os.path.join(testroot, 'test_spam.py'),
                function=FakeFunc('test_one'),
                ),
            StubPytestItem(
                stub,
                nodeid='test_spam.py::SpamTests::test_other',
                name='test_other',
                location=('test_spam.py', 19, 'SpamTests.test_other'),
                fspath=os.path.join(testroot, 'test_spam.py'),
                function=FakeFunc('test_other'),
                ),
            StubPytestItem(
                stub,
                nodeid='test_spam.py::test_all',
                name='test_all',
                location=('test_spam.py', 144, 'test_all'),
                fspath=os.path.join(testroot, 'test_spam.py'),
                function=FakeFunc('test_all'),
                ),
            StubPytestItem(
                stub,
                nodeid=relfile2 + '::All::BasicTests::test_first',
                name='test_first',
                location=(relfile2, 31, 'All.BasicTests.test_first'),
                fspath=os.path.join(testroot, relfile2),
                function=FakeFunc('test_first'),
                ),
            StubPytestItem(
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
        self.assertEqual(collector.discovered, [
            TestInfo(
                id='test_spam.py::SpamTests::test_one',
                name='test_one',
                path=TestPath(
                    root=testroot,
                    relfile=relfile1,
                    func='SpamTests.test_one',
                    sub=None,
                    ),
                lineno=12,
                markers=None,
                ),
            TestInfo(
                id='test_spam.py::SpamTests::test_other',
                name='test_other',
                path=TestPath(
                    root=testroot,
                    relfile=relfile1,
                    func='SpamTests.test_other',
                    sub=None,
                    ),
                lineno=19,
                markers=None,
                ),
            TestInfo(
                id='test_spam.py::test_all',
                name='test_all',
                path=TestPath(
                    root=testroot,
                    relfile=relfile1,
                    func='test_all',
                    sub=None,
                    ),
                lineno=144,
                markers=None,
                ),
            TestInfo(
                id=relfile2 + '::All::BasicTests::test_first',
                name='test_first',
                path=TestPath(
                    root=testroot,
                    relfile=relfile2,
                    func='All.BasicTests.test_first',
                    sub=None,
                    ),
                lineno=31,
                markers=None,
                ),
            TestInfo(
                id=relfile2 + '::All::BasicTests::test_each[1+2-3]',
                name='test_each[1+2-3]',
                path=TestPath(
                    root=testroot,
                    relfile=relfile2,
                    func='All.BasicTests.test_each',
                    sub=['[1+2-3]'],
                    ),
                lineno=62,
                markers=['expected-failure', 'skip', 'skip-if'],
                ),
            ])
        self.assertEqual(stub.calls, [])

    def test_finish(self):
        stub = Stub()
        session = StubPytestSession(stub)
        testroot = '/a/b/c'.replace('/', os.path.sep)
        relfile = 'x/y/z/test_eggs.py'.replace('/', os.path.sep)
        session.items = [
            StubPytestItem(
                stub,
                nodeid=relfile + '::SpamTests::test_spam',
                name='test_spam',
                location=(relfile, 12, 'SpamTests.test_spam'),
                fspath=os.path.join(testroot, relfile),
                function=FakeFunc('test_spam'),
                ),
            ]
        collector = TestCollector()

        collector.pytest_collection_finish(session)

        self.maxDiff = None
        self.assertEqual(collector.discovered, [
            TestInfo(
                id=relfile + '::SpamTests::test_spam',
                name='test_spam',
                path=TestPath(
                    root=testroot,
                    relfile=relfile,
                    func='SpamTests.test_spam',
                    sub=None,
                    ),
                lineno=12,
                markers=None,
                ),
            ])
        self.assertEqual(stub.calls, [])

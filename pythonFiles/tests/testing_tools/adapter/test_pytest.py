import unittest

from ...util import Stub, StubProxy
from adapter.errors import UnsupportedCommandError
from adapter.pytest import discover, add_cli_subparser


class AddCLISubparser(unittest.TestCase):

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

    def test_basic(self):
        with self.assertRaises(NotImplementedError):
            discover()


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

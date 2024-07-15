# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
# ruff:noqa: PT009, PT027

import unittest

from testing_tools.adapter.errors import UnsupportedCommandError
from testing_tools.adapter.pytest._cli import add_subparser

from ....util import Stub, StubProxy


class StubSubparsers(StubProxy):
    def __init__(self, stub=None, name="subparsers"):
        super().__init__(stub, name)

    def add_parser(self, name):
        self.add_call("add_parser", None, {"name": name})
        return self.return_add_parser


class StubArgParser(StubProxy):
    def __init__(self, stub=None):
        super().__init__(stub, "argparser")

    def add_argument(self, *args, **kwargs):
        self.add_call("add_argument", args, kwargs)


class AddCLISubparserTests(unittest.TestCase):
    def test_discover(self):
        stub = Stub()
        subparsers = StubSubparsers(stub)
        parser = StubArgParser(stub)
        subparsers.return_add_parser = parser

        add_subparser("discover", "pytest", subparsers)

        self.assertEqual(
            stub.calls,
            [
                ("subparsers.add_parser", None, {"name": "pytest"}),
            ],
        )

    def test_unsupported_command(self):
        subparsers = StubSubparsers(name=None)
        subparsers.return_add_parser = None

        with self.assertRaises(UnsupportedCommandError):
            add_subparser("run", "pytest", subparsers)
        with self.assertRaises(UnsupportedCommandError):
            add_subparser("debug", "pytest", subparsers)
        with self.assertRaises(UnsupportedCommandError):
            add_subparser("???", "pytest", subparsers)
        self.assertEqual(
            subparsers.calls,
            [
                ("add_parser", None, {"name": "pytest"}),
                ("add_parser", None, {"name": "pytest"}),
                ("add_parser", None, {"name": "pytest"}),
            ],
        )

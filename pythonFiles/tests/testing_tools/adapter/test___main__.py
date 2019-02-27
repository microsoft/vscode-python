import unittest

from ...util import Stub, StubProxy
from testing_tools.adapter.__main__ import (
    parse_args, main, UnsupportedToolError, UnsupportedCommandError
    )


class ParseGeneralTests(unittest.TestCase):

    def test_unsupported_command(self):
        with self.assertRaises(SystemExit):
            parse_args(['run', 'pytest'])
        with self.assertRaises(SystemExit):
            parse_args(['debug', 'pytest'])
        with self.assertRaises(SystemExit):
            parse_args(['???', 'pytest'])


class ParseDiscoverTests(unittest.TestCase):

    def test_pytest_default(self):
        tool, cmd, args, toolargs = parse_args([
            'discover',
            'pytest',
            ])
    
        self.assertEqual(tool, 'pytest')
        self.assertEqual(cmd, 'discover')
        self.assertEqual(args, {})
        self.assertEqual(toolargs, [])

    def test_pytest_full(self):
        tool, cmd, args, toolargs = parse_args([
            'discover',
            'pytest',
            # no adapter-specific options yet
            '--',
            '--strict',
            '--ignore', 'spam,ham,eggs',
            '--pastebin=xyz',
            '--no-cov',
            '-d',
            ])

        self.assertEqual(tool, 'pytest')
        self.assertEqual(cmd, 'discover')
        self.assertEqual(args, {})
        self.assertEqual(toolargs, [
            '--',
            '--strict',
            '--ignore', 'spam,ham,eggs',
            '--pastebin=xyz',
            '--no-cov',
            '-d',
            ])

    def test_unsupported_tool(self):
        with self.assertRaises(SystemExit):
            parse_args(['discover', 'unittest'])
        with self.assertRaises(SystemExit):
            parse_args(['discover', 'nose'])
        with self.assertRaises(SystemExit):
            parse_args(['discover', '???'])


class MainTests(unittest.TestCase):

    # TODO: We could use an integration test for pytest.discover().

    def test_discover(self):
        stub = Stub()
        tool = StubTool('spamspamspam', stub)
        expected = object()
        tool.return_discover = expected
        report = StubReport(stub)
        main(tool.name, 'discover', {'spam': 'eggs'}, [],
             tools={tool.name: {
                 'discover': tool.discover,
                 }},
             reporters={
                 'discover': report.discovered,
                 })

        self.assertEqual(tool.calls, [
            ('spamspamspam.discover', ([],), {'spam': 'eggs'}),
            ('report.discovered', (expected,), None),
            ])

    def test_unsupported_tool(self):
        with self.assertRaises(UnsupportedToolError):
            main('unittest', 'discover', {'spam': 'eggs'}, [],
                 tools={'pytest': None}, reporters=None)
        with self.assertRaises(UnsupportedToolError):
            main('nose', 'discover', {'spam': 'eggs'}, [],
                 tools={'pytest': None}, reporters=None)
        with self.assertRaises(UnsupportedToolError):
            main('???', 'discover', {'spam': 'eggs'}, [],
                 tools={'pytest': None}, reporters=None)

    def test_unsupported_command(self):
        tool = StubTool('pytest')
        with self.assertRaises(UnsupportedCommandError):
            main('pytest', 'run', {'spam': 'eggs'}, [],
                 tools={'pytest': {'discover': tool.discover}},
                 reporters=None)
        with self.assertRaises(UnsupportedCommandError):
            main('pytest', 'debug', {'spam': 'eggs'}, [],
                 tools={'pytest': {'discover': tool.discover}},
                 reporters=None)
        with self.assertRaises(UnsupportedCommandError):
            main('pytest', '???', {'spam': 'eggs'}, [],
                 tools={'pytest': {'discover': tool.discover}},
                 reporters=None)
        self.assertEqual(tool.calls, [])


class StubTool(StubProxy):

    def __init__(self, name, stub=None):
        super().__init__(stub, name)
        self.return_discover = None

    def discover(self, args, **kwargs):
        self.add_call('discover', (args,), kwargs)
        if self.return_discover is None:
            raise NotImplementedError
        return self.return_discover


class StubReport(StubProxy):

    def __init__(self, stub=None):
        super().__init__(stub, 'report')

    def discovered(self, discovered):
        self.add_call('discovered', (discovered,), None)

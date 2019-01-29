import unittest

from adapter.__main__ import (
    parse_args, main, UnsupportedToolError, UnsupportedCommandError
    )


class ParseGeneralTests(unittest.TestCase):

    def test_unsupported_command(self):
        with self.assertRaises(SystemExit):
            parse_args(['run', '--tool', 'pytest'])
        with self.assertRaises(SystemExit):
            parse_args(['debug', '--tool', 'pytest'])
        with self.assertRaises(SystemExit):
            parse_args(['???', '--tool', 'pytest'])


class ParseDiscoverTests(unittest.TestCase):

    def test_pytest_default(self):
        tool, cmd, args = parse_args([
            'discover',
            '--tool', 'pytest',
            ])
    
        self.assertEqual(tool, 'pytest')
        self.assertEqual(cmd, 'discover')
        self.assertEqual(args, {})

    def test_unsupported_tool(self):
        with self.assertRaises(SystemExit):
            parse_args(['discover', '--tool', 'unittest'])
        with self.assertRaises(SystemExit):
            parse_args(['discover', '--tool', 'nose'])
        with self.assertRaises(SystemExit):
            parse_args(['discover', '--tool', '???'])


class MainTests(unittest.TestCase):

    tool = None
    tools = {}

    def set_tool(self, name):
        self.tools = {name: tool}
        return tool

    # TODO: We could use an integration test for pytest.discover().

    def test_discover(self):
        tool = StubTool('spam')
        main('spamspamspam', 'discover', {'spam': 'eggs'},
             tools={'spamspamspam': tool})

        self.assertEqual(tool.calls, [
            ('discover', {'spam': 'eggs'}),
            ])

    def test_unsupported_tool(self):
        tool = StubTool('pytest')
        with self.assertRaises(UnsupportedToolError):
            main('unittest', 'discover', {'spam': 'eggs'}, tools={'pytest': tool})
        with self.assertRaises(UnsupportedToolError):
            main('nose', 'discover', {'spam': 'eggs'}, tools={'pytest': tool})
        with self.assertRaises(UnsupportedToolError):
            main('???', 'discover', {'spam': 'eggs'}, tools={'pytest': tool})
        self.assertEqual(tool.calls, [])

    def test_unsupported_command(self):
        tool = StubTool('pytest')
        with self.assertRaises(UnsupportedCommandError):
            main('pytest', 'run', {'spam': 'eggs'}, tools={'pytest': tool})
        with self.assertRaises(UnsupportedCommandError):
            main('pytest', 'debug', {'spam': 'eggs'}, tools={'pytest': tool})
        with self.assertRaises(UnsupportedCommandError):
            main('pytest', '???', {'spam': 'eggs'}, tools={'pytest': tool})
        self.assertEqual(tool.calls, [])


class StubTool(object):

    def __init__(self, name):
        self.name = name
        self.calls = []

    def discover(self, **kwargs):
        self.calls.append(('discover', kwargs))

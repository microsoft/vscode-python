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
        stub = Stub()
        tool = StubTool('spamspamspam', stub)
        expected = object()
        tool.return_discover = expected
        report = StubReport(stub)
        main(tool.name, 'discover', {'spam': 'eggs'},
             tools={tool.name: tool}, report=report)

        self.assertEqual(tool.calls, [
            ('spamspamspam.discover', None, {'spam': 'eggs'}),
            ('report.discovered', (expected,), None),
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


class Stub(object):

    def __init__(self):
        self.calls = []

    def add_call(self, name, args=None, kwargs=None):
        self.calls.append((name, args, kwargs))


class StubProxy(object):

    def __init__(self, stub=None, name=None):
        self.name = name
        self.stub = stub if stub is not None else Stub()

    @property
    def calls(self):
        return self.stub.calls

    def add_call(self, funcname, *args, **kwargs):
        callname = funcname
        if self.name:
            callname = '{}.{}'.format(self.name, funcname)
        return self.stub.add_call(callname, *args, **kwargs)


class StubTool(StubProxy):

    def __init__(self, name, stub=None):
        super().__init__(stub, name)
        self.return_discover = None

    def discover(self, **kwargs):
        self.add_call('discover', None, kwargs)
        if self.return_discover is None:
            raise NotImplementedError
        return self.return_discover


class StubReport(StubProxy):

    def __init__(self, stub=None):
        super().__init__(stub, 'report')

    def discovered(self, discovered):
        self.add_call('discovered', (discovered,), None)

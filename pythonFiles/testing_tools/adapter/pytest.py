import os.path

import pytest

from .errors import UnsupportedCommandError
from .info import TestInfo, TestPath


def add_cli_subparser(cmd, name, parent):
    """Add a new subparser to the given parent and add args to it."""
    parser = parent.add_parser(name)
    if cmd == 'discover':
        # For now we don't have any tool-specific CLI options to add.
        pass
    else:
        raise UnsupportedCommandError(cmd)
    return parser


def discover(pytestargs=None,
             _pytest_main=pytest.main, _plugin=None):
    """Return the results of test discovery."""
    if _plugin is None:
        _plugin = TestCollector()

    pytestargs = _adjust_pytest_args(pytestargs)
    ec = _pytest_main(pytestargs, [_plugin])
    if ec != 0:
        raise Exception('pytest discovery failed (exit code {})'.format(ec))
    if _plugin.discovered is None:
        raise Exception('pytest discovery did not start')
    return _plugin.discovered


def _adjust_pytest_args(pytestargs):
    pytestargs = list(pytestargs) if pytestargs else []
    # Duplicate entries should be okay.
    pytestargs.insert(0, '--collect-only')
    pytestargs.insert(0, '-pno:terminal')
    # TODO: pull in code from:
    #  src/client/unittests/pytest/services/discoveryService.ts
    #  src/client/unittests/pytest/services/argsService.ts
    return pytestargs


class TestCollector(object):
    """This is a pytest plugin that collects the discovered tests."""

    discovered = None

    # Relevant plugin hooks:
    #  https://docs.pytest.org/en/latest/reference.html#collection-hooks

    def pytest_collection_modifyitems(self, session, config, items):
        self.discovered = []
        for item in items:
            info = _parse_item(item)
            self.discovered.append(info)

    # This hook is not specified in the docs, so we also provide
    # the "modifyitems" hook just in case.
    def pytest_collection_finish(self, session):
        try:
            items = session.items
        except AttributeError:
            # TODO: Is there an alternative?
            return
        self.discovered = []
        for item in items:
            info = _parse_item(item)
            self.discovered.append(info)


def _parse_item(item):
    """
    (pytest.Collector)
        pytest.Session
        pytest.Package
        pytest.Module
        pytest.Class
        (pytest.File)
    (pytest.Item)
        pytest.Function
    """
    # Figure out the file.
    filename, lineno, fullname = item.location
    if not str(item.fspath).endswith(os.path.sep + filename):
        raise NotImplementedError
    testroot = str(item.fspath)[:-len(filename)].rstrip(os.path.sep)
    if os.path.sep in filename:
        relfile = filename
    else:
        relfile = os.path.join('.', filename)

    # Figure out the func (and subs).
    funcname = item.function.__name__
    parts = item.nodeid.split('::')
    if parts.pop(0) != filename:
        # TODO: What to do?
        raise NotImplementedError
    suites = []
    while parts[0] != funcname:
        suites.append(parts.pop(0))
    if suites:
        testfunc = '.'.join(suites) + '.' + funcname
    else:
        testfunc = funcname
    subs = parts[1:]
    if len(subs) > 1:
        # TODO: What to do?
        raise NotImplementedError
    if fullname != testfunc:
        # TODO: What to do?
        raise NotImplementedError

    return TestInfo(
        id=item.nodeid,
        name=item.name,
        path=TestPath(
            root=testroot,
            relfile=relfile,
            func=testfunc,
            sub=subs or None,
            ),
        lineno=lineno,
        )

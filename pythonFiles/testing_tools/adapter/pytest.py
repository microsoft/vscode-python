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


def discover(pytestargs=None, pytest_main=None, plugin=None):
    """Return the results of test discovery."""
    if pytest_main is None:
        pytest_main = pytest.main
    if plugin is None:
        plugin = TestCollector()
    # ensure --collect-only
    # -pno:terminal
    ec = pytest_main(pytestargs or [], [plugin])
    if ec != 0:
        raise Exception('pytest discovery failed (exit code {})'.format(ec))
    if plugin.discovered is None:
        raise Exception('pytest discovery did not start')
    return plugin.discovered


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
            # Is there an alternative?
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
        raise NotImplementedError
    if fullname != testfunc:
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

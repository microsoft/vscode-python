# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

from __future__ import absolute_import, print_function

import os.path
import sys

import pytest

from .. import util
from ..info import ParentInfo
from ._pytest_item import parse_item


def discover(pytestargs=None, hidestdio=False,
             _pytest_main=pytest.main, _plugin=None, **_ignored):
    """Return the results of test discovery."""
    if _plugin is None:
        _plugin = TestCollector()

    pytestargs = _adjust_pytest_args(pytestargs)
    # We use this helper rather than "-pno:terminal" due to possible
    # platform-dependent issues.
    with (util.hide_stdio() if hidestdio else util.noop_cm()) as stdio:
        ec = _pytest_main(pytestargs, [_plugin])
    # See: https://docs.pytest.org/en/latest/usage.html#possible-exit-codes
    if ec == 5:
        # No tests were discovered.
        pass
    elif ec != 0:
        if hidestdio:
            print(stdio.getvalue(), file=sys.stderr)
            sys.stdout.flush()
        raise Exception('pytest discovery failed (exit code {})'.format(ec))
    if not _plugin._started:
        if hidestdio:
            print(stdio.getvalue(), file=sys.stderr)
            sys.stdout.flush()
        raise Exception('pytest discovery did not start')
    return (
            _plugin._tests.parents,
            list(_plugin._tests),
            )


def _adjust_pytest_args(pytestargs):
    """Return a corrected copy of the given pytest CLI args."""
    pytestargs = list(pytestargs) if pytestargs else []
    # Duplicate entries should be okay.
    pytestargs.insert(0, '--collect-only')
    # TODO: pull in code from:
    #  src/client/testing/pytest/services/discoveryService.ts
    #  src/client/testing/pytest/services/argsService.ts
    return pytestargs


class TestCollector(object):
    """This is a pytest plugin that collects the discovered tests."""

    NORMCASE = staticmethod(os.path.normcase)
    PATHSEP = os.path.sep

    def __init__(self, tests=None):
        if tests is None:
            tests = DiscoveredTests()
        self._tests = tests
        self._started = False

    # Relevant plugin hooks:
    #  https://docs.pytest.org/en/latest/reference.html#collection-hooks

    def pytest_collection_modifyitems(self, session, config, items):
        self._started = True
        self._tests.reset()
        for item in items:
            test, parents = parse_item(item, self.NORMCASE, self.PATHSEP)
            self._tests.add_test(test, parents)

    # This hook is not specified in the docs, so we also provide
    # the "modifyitems" hook just in case.
    def pytest_collection_finish(self, session):
        self._started = True
        try:
            items = session.items
        except AttributeError:
            # TODO: Is there an alternative?
            return
        self._tests.reset()
        for item in items:
            test, parents = parse_item(item, self.NORMCASE, self.PATHSEP)
            self._tests.add_test(test, parents)


class DiscoveredTests(object):
    """A container for the discovered tests and their parents."""

    def __init__(self):
        self.reset()

    def __len__(self):
        return len(self._tests)

    def __getitem__(self, index):
        return self._tests[index]

    @property
    def parents(self):
        return sorted(self._parents.values(), key=lambda v: (v.root or v.name, v.id))

    def reset(self):
        """Clear out any previously discovered tests."""
        self._parents = {}
        self._tests = []

    def add_test(self, test, parents):
        """Add the given test and its parents."""
        parentid = self._ensure_parent(test.path, parents)
        # Updating the parent ID and the test ID aren't necessary if the
        # provided test and parents (from the test collector) are
        # properly generated.  However, we play it safe here.
        test = test._replace(parentid=parentid)
        if not test.id.startswith('.' + os.path.sep):
            test = test._replace(id=os.path.join('.', test.id))
        self._tests.append(test)

    def _ensure_parent(self, path, parents):
        rootdir = path.root

        _parents = iter(parents)
        nodeid, name, kind = next(_parents)
        # As in add_test(), the node ID *should* already be correct.
        if nodeid != '.' and not nodeid.startswith('.' + os.path.sep):
            nodeid = os.path.join('.', nodeid)
        _parentid = nodeid
        for parentid, parentname, parentkind in _parents:
            # As in add_test(), the parent ID *should* already be correct.
            if parentid != '.' and not parentid.startswith('.' + os.path.sep):
                parentid = os.path.join('.', parentid)
            info = ParentInfo(nodeid, kind, name, rootdir, parentid)
            self._parents[(rootdir, nodeid)] = info
            nodeid, name, kind = parentid, parentname, parentkind
        assert nodeid == '.'
        info = ParentInfo(nodeid, kind, name=rootdir)
        self._parents[(rootdir, nodeid)] = info

        return _parentid

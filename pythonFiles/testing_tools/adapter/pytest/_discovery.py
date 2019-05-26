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
            test, suiteids = parse_item(item, self.NORMCASE, self.PATHSEP)
            self._tests.add_test(test, suiteids)

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
            test, suiteids = parse_item(item, self.NORMCASE, self.PATHSEP)
            self._tests.add_test(test, suiteids)


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

    def add_test(self, test, suiteids):
        """Add the given test and its parents."""
        parentid = self._ensure_parent(test.path, test.parentid, suiteids)
        test = test._replace(parentid=parentid)
        if not test.id.startswith('.' + os.path.sep):
            test = test._replace(id=os.path.join('.', test.id))
        self._tests.append(test)

    def _ensure_parent(self, path, parentid, suiteids):
        if not parentid.startswith('.' + os.path.sep):
            parentid = os.path.join('.', parentid)
        fileid = self._ensure_file(path.root, path.relfile)
        rootdir = path.root

        if not path.func:
            return parentid

        fullsuite, _, funcname = path.func.rpartition('.')
        suiteid = self._ensure_suites(fullsuite, rootdir, fileid, suiteids)
        parent = suiteid if suiteid else fileid

        if path.sub:
            if (rootdir, parentid) not in self._parents:
                funcinfo = ParentInfo(parentid, 'function', funcname,
                                      rootdir, parent)
                self._parents[(rootdir, parentid)] = funcinfo
        elif parent != parentid:
            print(parent, parentid)
            # TODO: What to do?
            raise NotImplementedError
        return parentid

    def _ensure_file(self, rootdir, relfile):
        if (rootdir, '.') not in self._parents:
            self._parents[(rootdir, '.')] = ParentInfo('.', 'folder', rootdir)
        if relfile.startswith('.' + os.path.sep):
            fileid = relfile
        else:
            fileid = relfile = os.path.join('.', relfile)

        if (rootdir, fileid) not in self._parents:
            folderid, filebase = os.path.split(fileid)
            fileinfo = ParentInfo(fileid, 'file', filebase, rootdir, folderid)
            self._parents[(rootdir, fileid)] = fileinfo

            while folderid != '.' and (rootdir, folderid) not in self._parents:
                parentid, name = os.path.split(folderid)
                folderinfo = ParentInfo(folderid, 'folder', name, rootdir, parentid)
                self._parents[(rootdir, folderid)] = folderinfo
                folderid = parentid
        return relfile

    def _ensure_suites(self, fullsuite, rootdir, fileid, suiteids):
        if not fullsuite:
            if suiteids:
                print(suiteids)
                # TODO: What to do?
                raise NotImplementedError
            return None
        if len(suiteids) != fullsuite.count('.') + 1:
            print(suiteids)
            # TODO: What to do?
            raise NotImplementedError

        suiteid = suiteids.pop()
        if not suiteid.startswith('.' + os.path.sep):
            suiteid = os.path.join('.', suiteid)
        final = suiteid
        while '.' in fullsuite and (rootdir, suiteid) not in self._parents:
            parentid = suiteids.pop()
            if not parentid.startswith('.' + os.path.sep):
                parentid = os.path.join('.', parentid)
            fullsuite, _, name = fullsuite.rpartition('.')
            suiteinfo = ParentInfo(suiteid, 'suite', name, rootdir, parentid)
            self._parents[(rootdir, suiteid)] = suiteinfo

            suiteid = parentid
        else:
            name = fullsuite
            suiteinfo = ParentInfo(suiteid, 'suite', name, rootdir, fileid)
            if (rootdir, suiteid) not in self._parents:
                self._parents[(rootdir, suiteid)] = suiteinfo
        return final

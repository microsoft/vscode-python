# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

from __future__ import absolute_import

import os.path

import pytest

from . import util
from .errors import UnsupportedCommandError
from .info import TestInfo, TestPath, ParentInfo


def add_cli_subparser(cmd, name, parent):
    """Add a new subparser to the given parent and add args to it."""
    parser = parent.add_parser(name)
    if cmd == 'discover':
        # For now we don't have any tool-specific CLI options to add.
        pass
    else:
        raise UnsupportedCommandError(cmd)
    return parser


def discover(pytestargs=None, hidestdio=False,
             _pytest_main=pytest.main, _plugin=None, **_ignored):
    """Return the results of test discovery."""
    if _plugin is None:
        _plugin = TestCollector()

    pytestargs = _adjust_pytest_args(pytestargs)
    # We use this helper rather than "-pno:terminal" due to possible
    # platform-dependent issues.
    with util.hide_stdio() if hidestdio else util.noop_cm():
        ec = _pytest_main(pytestargs, [_plugin])
    if ec != 0:
        raise Exception('pytest discovery failed (exit code {})'.format(ec))
    if not _plugin._started:
        raise Exception('pytest discovery did not start')
    return (
            _plugin._tests.parents,
            #[p._replace(
            #    id=p.id.lstrip('.' + os.path.sep),
            #    parentid=p.parentid.lstrip('.' + os.path.sep),
            #    )
            # for p in _plugin._tests.parents],
            list(_plugin._tests),
            )


def _adjust_pytest_args(pytestargs):
    pytestargs = list(pytestargs) if pytestargs else []
    # Duplicate entries should be okay.
    pytestargs.insert(0, '--collect-only')
    # TODO: pull in code from:
    #  src/client/unittests/pytest/services/discoveryService.ts
    #  src/client/unittests/pytest/services/argsService.ts
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
            test, suiteids = _parse_item(item, self.NORMCASE, self.PATHSEP)
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
            test, suiteids = _parse_item(item, self.NORMCASE, self.PATHSEP)
            self._tests.add_test(test, suiteids)


class DiscoveredTests(object):

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
        self._parents = {}
        self._tests = []

    def add_test(self, test, suiteids):
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
                # TODO: What to do?
                raise NotImplementedError
            return None
        if len(suiteids) != fullsuite.count('.') + 1:
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


def _parse_item(item, _normcase, _pathsep):
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
    #_debug_item(item, showsummary=True)
    kind, _ = _get_item_kind(item)
    # Figure out the func, suites, and subs.
    (fileid, suiteids, suites, funcid, basename, parameterized
     ) = _parse_node_id(item.nodeid, kind)
    if kind == 'function':
        funcname = basename
        if funcid and item.function.__name__ != funcname:
            # TODO: What to do?
            raise NotImplementedError
        if suites:
            testfunc = '.'.join(suites) + '.' + funcname
        else:
            testfunc = funcname
    elif kind == 'doctest':
        testfunc = None
        funcname = None

    # Figure out the file.
    fspath = str(item.fspath)
    if not fspath.endswith(_pathsep + fileid):
        raise NotImplementedError
    filename = fspath[-len(fileid):]
    testroot = str(item.fspath)[:-len(fileid)].rstrip(_pathsep)
    if _pathsep in filename:
        relfile = filename
    else:
        relfile = '.' + _pathsep + filename
    srcfile, lineno, fullname = item.location
    if srcfile != fileid:
        # pytest supports discovery of tests imported from other
        # modules.  This is reflected by a different filename
        # in item.location.
        if _normcase(fileid) == _normcase(srcfile):
            srcfile = fileid
    else:
        srcfile = relfile
    location = '{}:{}'.format(srcfile, lineno)
    if kind == 'function':
        if testfunc and fullname != testfunc + parameterized:
            print(fullname, testfunc)
            # TODO: What to do?
            raise NotImplementedError
    elif kind == 'doctest':
        if testfunc and fullname != testfunc + parameterized:
            print(fullname, testfunc)
            # TODO: What to do?
            raise NotImplementedError

    # Sort out the parent.
    if parameterized:
        parentid = funcid
    elif suites:
        parentid = suiteids[-1]
    else:
        parentid = fileid

    # Sort out markers.
    #  See: https://docs.pytest.org/en/latest/reference.html#marks
    markers = set()
    for marker in item.own_markers:
        if marker.name == 'parameterize':
            # We've already covered these.
            continue
        elif marker.name == 'skip':
            markers.add('skip')
        elif marker.name == 'skipif':
            markers.add('skip-if')
        elif marker.name == 'xfail':
            markers.add('expected-failure')
        # TODO: Support other markers?

    test = TestInfo(
        id=item.nodeid,
        name=item.name,
        path=TestPath(
            root=testroot,
            relfile=relfile,
            func=testfunc,
            sub=[parameterized] if parameterized else None,
            ),
        source=location,
        markers=sorted(markers) if markers else None,
        parentid=parentid,
        )
    return test, suiteids


def _parse_node_id(nodeid, kind='function'):
    if kind == 'doctest':
        try:
            parentid, name = nodeid.split('::')
        except ValueError:
            # TODO: Unexpected!  What to do?
            raise NotImplementedError
        funcid = None
        parameterized = ''
    else:
        parameterized = ''
        if nodeid.endswith(']'):
            funcid, sep, parameterized = nodeid.partition('[')
            if not sep:
                # TODO: Unexpected!  What to do?
                raise NotImplementedError
            parameterized = sep + parameterized
        else:
            funcid = nodeid

        parentid, _, name = funcid.rpartition('::')
        if not name:
            # TODO: What to do?  We expect at least a filename and a function
            raise NotImplementedError

    suites = []
    suiteids = []
    while '::' in parentid:
        suiteids.insert(0, parentid)
        parentid, _, suitename = parentid.rpartition('::')
        suites.insert(0, suitename)
    fileid = parentid

    return fileid, suiteids, suites, funcid, name, parameterized


def _get_item_kind(item):
    """Return (kind, isunittest) for the given item."""
    try:
        itemtype = item.kind
    except AttributeError:
        itemtype = item.__class__.__name__

    if itemtype == 'DoctestItem':
        return 'doctest', False
    elif itemtype == 'Function':
        return 'function', False
    elif itemtype == 'TestCaseFunction':
        return 'function', True
    elif item.hasattr('function'):
        return 'function', False
    else:
        return None, False


#############################
# useful for debugging

def _debug_item(item, showsummary=False):
    item._debugging = True
    try:
        # TODO: Make a PytestTest class to wrap the item?
        summary = {
                'id': item.nodeid,
                'kind': _get_item_kind(item),
                'class': item.__class__.__name__,
                'name': item.name,
                'fspath': item.fspath,
                'location': item.location,
                'func': getattr(item, 'function', None),
                'markers': item.own_markers,
                #'markers': list(item.iter_markers()),
                'props': item.user_properties,
                'attrnames': dir(item),
                }
    finally:
        item._debugging = False

    if showsummary:
        print(item.nodeid)
        for key in ('kind', 'class', 'name', 'fspath', 'location', 'func',
                    'markers', 'props'):
            print('  {:12} {}'.format(key, summary[key]))
        print()

    return summary


def _group_attr_names(attrnames):
    grouped = {
            'dunder': [n for n in attrnames
                       if n.startswith('__') and n.endswith('__')],
            'private': [n for n in attrnames if n.startswith('_')],
            'constants': [n for n in attrnames if n.isupper()],
            'classes': [n for n in attrnames
                        if n == n.capitalize() and not n.isupper()],
            'vars': [n for n in attrnames if n.islower()],
            }
    grouped['other'] = [n for n in attrnames
                          if n not in grouped['dunder']
                          and n not in grouped['private']
                          and n not in grouped['constants']
                          and n not in grouped['classes']
                          and n not in grouped['vars']
                          ]
    return grouped

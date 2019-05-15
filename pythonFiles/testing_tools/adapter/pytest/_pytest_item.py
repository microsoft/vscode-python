# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

from __future__ import absolute_import, print_function

import sys

from ..info import TestInfo, TestPath


def parse_item(item, _normcase, _pathsep):
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
    (nodeid, fileid, suiteids, suites, funcid, basename, parameterized
     ) = _parse_node_id(item.nodeid, kind, _pathsep, _normcase)
    if kind == 'function':
        funcname = basename
        # Note: funcname does not necessarily match item.function.__name__.
        # This can result from importing a test function from another module.
        if suites:
            testfunc = '.'.join(suites) + '.' + funcname
        else:
            testfunc = funcname
    elif kind == 'doctest':
        testfunc = None
        funcname = None

    # Figure out the file.
    relfile = _normcase(fileid)
    fspath = str(item.fspath)
    if not _normcase(fspath).endswith(relfile[1:]):
        print(fspath)
        print(relfile)
        raise NotImplementedError
    testroot = str(item.fspath)[:-len(relfile) + 1]
    location, fullname = _get_location(item, relfile, _normcase, _pathsep)
    if kind == 'function':
        if testfunc and fullname != testfunc + parameterized:
            print(item.nodeid)
            print(fullname, suites, testfunc)
            # TODO: What to do?
            raise NotImplementedError
    elif kind == 'doctest':
        if testfunc and fullname != testfunc + parameterized:
            print(item.nodeid)
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
        id=nodeid,
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


def _get_location(item, relfile, _normcase, _pathsep):
    srcfile, lineno, fullname = item.location
    srcfile = _normcase(srcfile)
    if srcfile in (relfile, relfile[len(_pathsep) + 1:]):
        srcfile = relfile
    else:
        # pytest supports discovery of tests imported from other
        # modules.  This is reflected by a different filename
        # in item.location.
        srcfile, lineno = _find_location(
                srcfile, lineno, relfile, item.function, _pathsep)
        if not srcfile.startswith('.' + _pathsep):
            srcfile = '.' + _pathsep + srcfile
    # from pytest, line numbers are 0-based
    location = '{}:{}'.format(srcfile, int(lineno) + 1)
    return location, fullname


def _find_location(srcfile, lineno, relfile, func, _pathsep):
    if sys.version_info > (3,):
        return srcfile, lineno
    if (_pathsep + 'unittest' + _pathsep + 'case.py') not in srcfile:
        return srcfile, lineno

    # Unwrap the decorator (e.g. unittest.skip).
    srcfile = relfile
    lineno = -1
    try:
        func = func.__closure__[0].cell_contents
    except (IndexError, AttributeError):
        return srcfile, lineno
    else:
        if callable(func) and func.__code__.co_filename.endswith(relfile[1:]):
            lineno = func.__code__.co_firstlineno - 1
    return srcfile, lineno


def _parse_node_id(nodeid, kind, _pathsep, _normcase):
    if not nodeid.startswith('.' + _pathsep):
        nodeid = '.' + _pathsep + nodeid
    while '::()::' in nodeid:
        nodeid = nodeid.replace('::()::', '::')

    fileid, _, remainder = nodeid.partition('::')
    if not fileid or not remainder:
        print(nodeid)
        # TODO: Unexpected!  What to do?
        raise NotImplementedError
    fileid = _normcase(fileid)
    nodeid = fileid + '::' + remainder

    if kind == 'doctest':
        try:
            parentid, name = nodeid.split('::')
        except ValueError:
            print(nodeid)
            # TODO: Unexpected!  What to do?
            raise NotImplementedError
        funcid = None
        parameterized = ''
    else:
        parameterized = ''
        if nodeid.endswith(']'):
            funcid, sep, parameterized = nodeid.partition('[')
            if not sep:
                print(nodeid)
                # TODO: Unexpected!  What to do?
                raise NotImplementedError
            parameterized = sep + parameterized
        else:
            funcid = nodeid
        parentid, _, name = funcid.rpartition('::')
        if not parentid or not name:
            print(parentid, name)
            # TODO: What to do?  We expect at least a filename and a function
            raise NotImplementedError

    suites = []
    suiteids = []
    while '::' in parentid:
        fullid = parentid
        parentid, _, suitename = fullid.rpartition('::')
        suiteids.insert(0, fullid)
        suites.insert(0, suitename)
    if parentid != fileid:
        print(nodeid)
        print(parentid, fileid)

    return nodeid, fileid, suiteids, suites, funcid, name, parameterized


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

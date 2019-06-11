# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
"""
During "collection", pytest finds all the tests it supports.  These are
called "items".  The process is top-down, mostly tracing down through
the file system.  Aside from its own machinery, pytest supports hooks
that find tests.  Effectively, pytest starts with a set of "collectors";
objects that can provide a list of tests and sub-collectors.  All
collectors in the resulting tree are visited and the tests aggregated.
For the most part, each test's (and collector's) parent is identified
as the collector that collected it.

Collectors and items are collectively identified as "nodes".  The pytest
API relies on collector and item objects providing specific methods and
attributes.  In addition to corresponding base classes, pytest provides
a number of concrete impementations.

The following are the known pytest node types:

  Node
      Collector
          FSCollector
              Session (the top-level collector)
              File
                  Module
                      Package
                      DoctestTextfile
                      DoctestModule
          PyCollector
              (Module)
                  (...)
              Class
                  UnitTestCase
              Instance
      Item
          Function
              TestCaseFunction
          DoctestItem

Here are the unique attrs for those classes:

  Node
      name
      nodeid (readonly)
      config
      session
      (parent) - the parent node
      (fspath) - the file from which the node was collected
      ----
      own_marksers - explicit markers (e.g. with @pytest.mark())
      keywords
      extra_keyword_matches

  Item
      location - where the actual test source code is: (relfspath, lno, fullname)
      user_properties

  PyCollector
      module
      class
      instance
      obj

  Function
      module
      class
      instance
      obj
      function
      (callspec)
      (fixturenames)
      funcargs
      originalname - w/o decorations, e.g. [...] for parameterized

  DoctestItem
      dtest
      obj

When parsing an item, we make use of the following attributes:

* name
* nodeid
* __class__
    + __name__
* fspath
* location
* function
    + __name__
    + __code__
    + __closure__
* own_markers
"""

from __future__ import absolute_import, print_function

import sys

import pytest
import _pytest.doctest
import _pytest.unittest

from ..info import TestInfo, TestPath


def should_never_reach_here(node, *extra):
    """Indicates a code path we should never reach."""
    print('The Python extension has run into an unexpected situation')
    print('while processing a pytest node during test discovery.  Please')
    print('Please open an issue at:')
    print('  https://github.com/microsoft/vscode-python/issues')
    print('and paste the following output there.')
    print()
    for field, info in _summarize_item(node):
        print('{}: {}'.format(field, info))
    if extra:
        print()
        print('extra info:')
        for info in extra:
            if isinstance(line, str):
                print(str)
            else:
                try:
                    print(*line)
                except TypeError:
                    print(line)
    print()
    print('traceback:')
    import traceback
    traceback.print_stack()

    msg = 'Unexpected pytest node (see printed output).'
    exc = NotImplementedError(msg)
    exc.node = node
    return exc


def parse_item(item, _normcase, _pathsep):
    """Return (TestInfo, [suite ID]) for the given item.

    The suite IDs, if any, are in parent order with the item's direct
    parent at the beginning.  The parent of the last suite ID (or of
    the test if there are no suites) is the file ID, which corresponds
    to TestInfo.path.

    """
    #_debug_item(item, showsummary=True)
    kind, _ = _get_item_kind(item)
    (nodeid, parents, fileid, testfunc, parameterized
     ) = _parse_node_id(item.nodeid, kind, _pathsep, _normcase)
    # Note: testfunc does not necessarily match item.function.__name__.
    # This can result from importing a test function from another module.

    # Figure out the file.
    relfile = fileid
    fspath = _normcase(str(item.fspath))
    if not fspath.endswith(relfile[1:]):
        raise should_never_reach_here(
            item,
            fspath,
            relfile,
            )
    testroot = fspath[:-len(relfile) + 1]
    location, fullname = _get_location(item, relfile, _normcase, _pathsep)
    if kind == 'function':
        if testfunc and fullname != testfunc + parameterized:
            raise should_never_reach_here(
                item,
                fullname,
                testfunc,
                parameterized,
                )
    elif kind == 'doctest':
        if (testfunc and fullname != testfunc and
                fullname != '[doctest] ' + testfunc):
            raise should_never_reach_here(
                item,
                fullname,
                testfunc,
                )
        testfunc = None

    # Sort out the parent.
    if parents:
        parentid, _, _ = parents[0]
    else:
        parentid = None

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
        # We can add support for other markers as we need them?

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
    if parents and parents[-1] == ('.', None, 'folder'):  # This should always be true?
        parents[-1] = ('.', testroot, 'folder')
    return test, parents


def _get_location(item, relfile, _normcase, _pathsep):
    """Return (loc str, fullname) for the given item."""
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
    """Return (filename, lno) for the given location info."""
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


def _parse_node_id(testid, kind, _pathsep, _normcase):
    """Return the components of the given node ID, in heirarchical order."""
    nodes = iter(_iter_nodes(testid, kind, _pathsep, _normcase))

    testid, name, kind = next(nodes)
    parents = []
    parameterized = None
    if kind == 'doctest':
        parents = list(nodes)
        fileid, _, _ = parents[0]
        return testid, parents, fileid, name, parameterized
    elif kind is None:
        fullname = None
    else:
        if kind == 'subtest':
            node = next(nodes)
            parents.append(node)
            funcid, funcname, _ = node
            parameterized = testid[len(funcid):]
        elif kind == 'function':
            funcname = name
        else:
            raise should_never_reach_here(
                testid,
                kind,
                )
        fullname = funcname

    for node in nodes:
        parents.append(node)
        parentid, name, kind = node
        if kind == 'file':
            fileid = parentid
            break
        elif fullname is None:
            # We don't guess how to interpret the node ID for these tests.
            continue
        elif kind == 'suite':
            fullname = name + '.' + fullname
        else:
            raise should_never_reach_here(
                testid,
                node,
                )
    else:
        fileid = None
    parents.extend(nodes) # Add the rest in as-is.

    return testid, parents, fileid, fullname, parameterized or ''


def _iter_nodes(nodeid, kind, _pathsep, _normcase):
    """Yield (nodeid, name, kind) for the given node ID and its parents."""
    nodeid = _normalize_node_id(nodeid, kind, _pathsep, _normcase)

    if kind == 'function' and nodeid.endswith(']'):
        funcid, sep, parameterized = nodeid.partition('[')
        if not sep:
            raise should_never_reach_here(
                nodeid,
                )
        yield (nodeid, sep + parameterized, 'subtest')
        nodeid = funcid

    parentid, _, name = nodeid.rpartition('::')
    if not parentid:
        if kind is None:
            # This assumes that plugins can generate nodes that do not
            # have a parent.  All the builtin nodes have one.
            yield (nodeid, name, kind)
            return
        # We expect at least a filename and a name.
        raise should_never_reach_here(
            nodeid,
            )
    yield (nodeid, name, kind)

    # Extract the suites.
    while '::' in parentid:
        suiteid = parentid
        parentid, _, name = parentid.rpartition('::')
        yield (suiteid, name, 'suite')

    # Extract the file and folders.
    fileid = parentid
    parentid, _, filename = fileid.rpartition(_pathsep)
    yield (fileid, filename, 'file')
    # We're guaranteed at least one (the test root).
    while _pathsep in parentid:
        folderid = parentid
        parentid, _, foldername = folderid.rpartition(_pathsep)
        yield (folderid, foldername, 'folder')
    # We set the actual test root later at the bottom of parse_item().
    testroot = None
    yield (parentid, testroot, 'folder')


def _normalize_node_id(nodeid, kind, _pathsep, _normcase):
    """Return the canonical form for the given node ID."""
    while '::()::' in nodeid:
        nodeid = nodeid.replace('::()::', '::')
    if kind is None:
        return nodeid

    fileid, sep, remainder = nodeid.partition('::')
    if sep:
        # pytest works fine even if we normalize the filename.
        nodeid = _normcase(fileid) + sep + remainder

    if nodeid.startswith(_pathsep):
        raise should_never_reach_here(
            nodeid,
            )
    if not nodeid.startswith('.' + _pathsep):
        nodeid = '.' + _pathsep + nodeid
    return nodeid


def _get_item_kind(item):
    """Return (kind, isunittest) for the given item."""
    if isinstance(item, _pytest.doctest.DoctestItem):
        return 'doctest', False
    elif isinstance(item, _pytest.unittest.TestCaseFunction):
        return 'function', True
    elif isinstance(item, pytest.Function):
        # We *could* be more specific, e.g. "method", "subtest".
        return 'function', False
    else:
        return None, False


#############################
# useful for debugging

_FIELDS = [
    'nodeid',
    'kind',
    'class',
    'name',
    'fspath',
    'location',
    'function',
    'markers',
    'user_properties',
    'attrnames',
    ]


def _summarize_item(item):
    if not hasattr(item, 'nodeid'):
        yield 'nodeid', item
        return

    for field in _FIELDS:
        try:
            if field == 'kind':
                yield field,_get_item_kind(item)
            elif field == 'class':
                yield field, item.__class__.__name__
            elif field == 'markers':
                yield field, item.own_markers
                #yield field, list(item.iter_markers())
            elif field == 'attrnames':
                yield field, dir(item)
            else:
                yield field, getattr(item, field, '<???>')
        except Exception as exc:
            yield field, '<error>'


def _debug_item(item, showsummary=False):
    item._debugging = True
    try:
        summary = dict(_summarize_item(item))
    finally:
        item._debugging = False

    if showsummary:
        print(item.nodeid)
        for key in ('kind', 'class', 'name', 'fspath', 'location', 'func',
                    'markers', 'props'):
            print('  {:12} {}'.format(key, summary[key]))
        print()

    return summary

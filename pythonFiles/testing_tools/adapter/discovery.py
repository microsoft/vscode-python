# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

from __future__ import absolute_import, print_function

import os.path

from .info import ParentInfo



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

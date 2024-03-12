# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

from __future__ import absolute_import, print_function

import unittest

from testing_tools.adapter.discovery import DiscoveredTests
from testing_tools.adapter.info import ParentInfo, SingleTestInfo, SingleTestPath
from testing_tools.adapter.util import fix_path, fix_relpath


def _fix_nodeid(nodeid):
    nodeid = nodeid.replace("\\", "/")
    if not nodeid.startswith("./"):
        nodeid = "./" + nodeid
    return nodeid


class DiscoveredTestsTests(unittest.TestCase):
    def test_list(self):
        testroot = fix_path("/a/b/c")
        relfile = fix_path("./test_spam.py")
        tests = [
            SingleTestInfo(
                # missing "./":
                id="test_spam.py::test_each[10-10]",
                name="test_each[10-10]",
                path=SingleTestPath(
                    root=testroot,
                    relfile=relfile,
                    func="test_each",
                    sub=["[10-10]"],
                ),
                source="{}:{}".format(relfile, 10),
                markers=None,
                # missing "./":
                parentid="test_spam.py::test_each",
            ),
            SingleTestInfo(
                id="test_spam.py::All::BasicTests::test_first",
                name="test_first",
                path=SingleTestPath(
                    root=testroot,
                    relfile=relfile,
                    func="All.BasicTests.test_first",
                    sub=None,
                ),
                source="{}:{}".format(relfile, 62),
                markers=None,
                parentid="test_spam.py::All::BasicTests",
            ),
        ]
        allparents = [
            [
                (fix_path("./test_spam.py::test_each"), "test_each", "function"),
                (fix_path("./test_spam.py"), "test_spam.py", "file"),
                (".", testroot, "folder"),
            ],
            [
                (fix_path("./test_spam.py::All::BasicTests"), "BasicTests", "suite"),
                (fix_path("./test_spam.py::All"), "All", "suite"),
                (fix_path("./test_spam.py"), "test_spam.py", "file"),
                (".", testroot, "folder"),
            ],
        ]
        expected = [
            test._replace(id=_fix_nodeid(test.id), parentid=_fix_nodeid(test.parentid))
            for test in tests
        ]
        discovered = DiscoveredTests()
        for test, parents in zip(tests, allparents):
            discovered.add_test(test, parents)
        size = len(discovered)
        items = [discovered[0], discovered[1]]
        snapshot = list(discovered)

        self.maxDiff = None
        self.assertEqual(size, 2)
        self.assertEqual(items, expected)
        self.assertEqual(snapshot, expected)

    def test_reset(self):
        testroot = fix_path("/a/b/c")
        discovered = DiscoveredTests()
        discovered.add_test(
            SingleTestInfo(
                id="./test_spam.py::test_each",
                name="test_each",
                path=SingleTestPath(
                    root=testroot,
                    relfile="test_spam.py",
                    func="test_each",
                ),
                source="test_spam.py:11",
                markers=[],
                parentid="./test_spam.py",
            ),
            [
                ("./test_spam.py", "test_spam.py", "file"),
                (".", testroot, "folder"),
            ],
        )

        before = len(discovered), len(discovered.parents)
        discovered.reset()
        after = len(discovered), len(discovered.parents)

        self.assertEqual(before, (1, 2))
        self.assertEqual(after, (0, 0))

    def test_parents(self):
        testroot = fix_path("/a/b/c")
        relfile = fix_path("x/y/z/test_spam.py")
        tests = [
            SingleTestInfo(
                # missing "./", using pathsep:
                id=relfile + "::test_each[10-10]",
                name="test_each[10-10]",
                path=SingleTestPath(
                    root=testroot,
                    relfile=fix_relpath(relfile),
                    func="test_each",
                    sub=["[10-10]"],
                ),
                source="{}:{}".format(relfile, 10),
                markers=None,
                # missing "./", using pathsep:
                parentid=relfile + "::test_each",
            ),
            SingleTestInfo(
                # missing "./", using pathsep:
                id=relfile + "::All::BasicTests::test_first",
                name="test_first",
                path=SingleTestPath(
                    root=testroot,
                    relfile=fix_relpath(relfile),
                    func="All.BasicTests.test_first",
                    sub=None,
                ),
                source="{}:{}".format(relfile, 61),
                markers=None,
                # missing "./", using pathsep:
                parentid=relfile + "::All::BasicTests",
            ),
        ]
        allparents = [
            # missing "./", using pathsep:
            [
                (relfile + "::test_each", "test_each", "function"),
                (relfile, relfile, "file"),
                (".", testroot, "folder"),
            ],
            # missing "./", using pathsep:
            [
                (relfile + "::All::BasicTests", "BasicTests", "suite"),
                (relfile + "::All", "All", "suite"),
                (relfile, "test_spam.py", "file"),
                (fix_path("x/y/z"), "z", "folder"),
                (fix_path("x/y"), "y", "folder"),
                (fix_path("./x"), "x", "folder"),
                (".", testroot, "folder"),
            ],
        ]
        discovered = DiscoveredTests()
        for test, parents in zip(tests, allparents):
            discovered.add_test(test, parents)

        parents = discovered.parents

        self.maxDiff = None
        self.assertEqual(
            parents,
            [
                ParentInfo(
                    id=".",
                    kind="folder",
                    name=testroot,
                ),
                ParentInfo(
                    id="./x",
                    kind="folder",
                    name="x",
                    root=testroot,
                    relpath=fix_path("./x"),
                    parentid=".",
                ),
                ParentInfo(
                    id="./x/y",
                    kind="folder",
                    name="y",
                    root=testroot,
                    relpath=fix_path("./x/y"),
                    parentid="./x",
                ),
                ParentInfo(
                    id="./x/y/z",
                    kind="folder",
                    name="z",
                    root=testroot,
                    relpath=fix_path("./x/y/z"),
                    parentid="./x/y",
                ),
                ParentInfo(
                    id="./x/y/z/test_spam.py",
                    kind="file",
                    name="test_spam.py",
                    root=testroot,
                    relpath=fix_relpath(relfile),
                    parentid="./x/y/z",
                ),
                ParentInfo(
                    id="./x/y/z/test_spam.py::All",
                    kind="suite",
                    name="All",
                    root=testroot,
                    parentid="./x/y/z/test_spam.py",
                ),
                ParentInfo(
                    id="./x/y/z/test_spam.py::All::BasicTests",
                    kind="suite",
                    name="BasicTests",
                    root=testroot,
                    parentid="./x/y/z/test_spam.py::All",
                ),
                ParentInfo(
                    id="./x/y/z/test_spam.py::test_each",
                    kind="function",
                    name="test_each",
                    root=testroot,
                    parentid="./x/y/z/test_spam.py",
                ),
            ],
        )

    def test_add_test_simple(self):
        testroot = fix_path("/a/b/c")
        relfile = "test_spam.py"
        test = SingleTestInfo(
            # missing "./":
            id=relfile + "::test_spam",
            name="test_spam",
            path=SingleTestPath(
                root=testroot,
                # missing "./":
                relfile=relfile,
                func="test_spam",
            ),
            # missing "./":
            source="{}:{}".format(relfile, 11),
            markers=[],
            # missing "./":
            parentid=relfile,
        )
        expected = test._replace(
            id=_fix_nodeid(test.id), parentid=_fix_nodeid(test.parentid)
        )
        discovered = DiscoveredTests()

        before = list(discovered), discovered.parents
        discovered.add_test(
            test,
            [
                (relfile, relfile, "file"),
                (".", testroot, "folder"),
            ],
        )
        after = list(discovered), discovered.parents

        self.maxDiff = None
        self.assertEqual(before, ([], []))
        self.assertEqual(
            after,
            (
                [expected],
                [
                    ParentInfo(
                        id=".",
                        kind="folder",
                        name=testroot,
                    ),
                    ParentInfo(
                        id="./test_spam.py",
                        kind="file",
                        name=relfile,
                        root=testroot,
                        relpath=relfile,
                        parentid=".",
                    ),
                ],
            ),
        )

    def test_multiroot(self):
        # the first root
        testroot1 = fix_path("/a/b/c")
        relfile1 = "test_spam.py"
        alltests = [
            SingleTestInfo(
                # missing "./":
                id=relfile1 + "::test_spam",
                name="test_spam",
                path=SingleTestPath(
                    root=testroot1,
                    relfile=fix_relpath(relfile1),
                    func="test_spam",
                ),
                source="{}:{}".format(relfile1, 10),
                markers=[],
                # missing "./":
                parentid=relfile1,
            ),
        ]
        allparents = [
            # missing "./":
            [
                (relfile1, "test_spam.py", "file"),
                (".", testroot1, "folder"),
            ],
        ]
        # the second root
        testroot2 = fix_path("/x/y/z")
        relfile2 = fix_path("w/test_eggs.py")
        alltests.extend(
            [
                SingleTestInfo(
                    id=relfile2 + "::BasicTests::test_first",
                    name="test_first",
                    path=SingleTestPath(
                        root=testroot2,
                        relfile=fix_relpath(relfile2),
                        func="BasicTests.test_first",
                    ),
                    source="{}:{}".format(relfile2, 61),
                    markers=[],
                    parentid=relfile2 + "::BasicTests",
                ),
            ]
        )
        allparents.extend(
            [
                # missing "./", using pathsep:
                [
                    (relfile2 + "::BasicTests", "BasicTests", "suite"),
                    (relfile2, "test_eggs.py", "file"),
                    (fix_path("./w"), "w", "folder"),
                    (".", testroot2, "folder"),
                ],
            ]
        )

        discovered = DiscoveredTests()
        for test, parents in zip(alltests, allparents):
            discovered.add_test(test, parents)
        tests = list(discovered)
        parents = discovered.parents

        self.maxDiff = None
        self.assertEqual(
            tests,
            [
                # the first root
                SingleTestInfo(
                    id="./test_spam.py::test_spam",
                    name="test_spam",
                    path=SingleTestPath(
                        root=testroot1,
                        relfile=fix_relpath(relfile1),
                        func="test_spam",
                    ),
                    source="{}:{}".format(relfile1, 10),
                    markers=[],
                    parentid="./test_spam.py",
                ),
                # the secondroot
                SingleTestInfo(
                    id="./w/test_eggs.py::BasicTests::test_first",
                    name="test_first",
                    path=SingleTestPath(
                        root=testroot2,
                        relfile=fix_relpath(relfile2),
                        func="BasicTests.test_first",
                    ),
                    source="{}:{}".format(relfile2, 61),
                    markers=[],
                    parentid="./w/test_eggs.py::BasicTests",
                ),
            ],
        )
        self.assertEqual(
            parents,
            [
                # the first root
                ParentInfo(
                    id=".",
                    kind="folder",
                    name=testroot1,
                ),
                ParentInfo(
                    id="./test_spam.py",
                    kind="file",
                    name="test_spam.py",
                    root=testroot1,
                    relpath=fix_relpath(relfile1),
                    parentid=".",
                ),
                # the secondroot
                ParentInfo(
                    id=".",
                    kind="folder",
                    name=testroot2,
                ),
                ParentInfo(
                    id="./w",
                    kind="folder",
                    name="w",
                    root=testroot2,
                    relpath=fix_path("./w"),
                    parentid=".",
                ),
                ParentInfo(
                    id="./w/test_eggs.py",
                    kind="file",
                    name="test_eggs.py",
                    root=testroot2,
                    relpath=fix_relpath(relfile2),
                    parentid="./w",
                ),
                ParentInfo(
                    id="./w/test_eggs.py::BasicTests",
                    kind="suite",
                    name="BasicTests",
                    root=testroot2,
                    parentid="./w/test_eggs.py",
                ),
            ],
        )

    def test_doctest(self):
        testroot = fix_path("/a/b/c")
        doctestfile = fix_path("./x/test_doctest.txt")
        relfile = fix_path("./x/y/z/test_eggs.py")
        alltests = [
            SingleTestInfo(
                id=doctestfile + "::test_doctest.txt",
                name="test_doctest.txt",
                path=SingleTestPath(
                    root=testroot,
                    relfile=doctestfile,
                    func=None,
                ),
                source="{}:{}".format(doctestfile, 0),
                markers=[],
                parentid=doctestfile,
            ),
            # With --doctest-modules
            SingleTestInfo(
                id=relfile + "::test_eggs",
                name="test_eggs",
                path=SingleTestPath(
                    root=testroot,
                    relfile=relfile,
                    func=None,
                ),
                source="{}:{}".format(relfile, 0),
                markers=[],
                parentid=relfile,
            ),
            SingleTestInfo(
                id=relfile + "::test_eggs.TestSpam",
                name="test_eggs.TestSpam",
                path=SingleTestPath(
                    root=testroot,
                    relfile=relfile,
                    func=None,
                ),
                source="{}:{}".format(relfile, 12),
                markers=[],
                parentid=relfile,
            ),
            SingleTestInfo(
                id=relfile + "::test_eggs.TestSpam.TestEggs",
                name="test_eggs.TestSpam.TestEggs",
                path=SingleTestPath(
                    root=testroot,
                    relfile=relfile,
                    func=None,
                ),
                source="{}:{}".format(relfile, 27),
                markers=[],
                parentid=relfile,
            ),
        ]
        allparents = [
            [
                (doctestfile, "test_doctest.txt", "file"),
                (fix_path("./x"), "x", "folder"),
                (".", testroot, "folder"),
            ],
            [
                (relfile, "test_eggs.py", "file"),
                (fix_path("./x/y/z"), "z", "folder"),
                (fix_path("./x/y"), "y", "folder"),
                (fix_path("./x"), "x", "folder"),
                (".", testroot, "folder"),
            ],
            [
                (relfile, "test_eggs.py", "file"),
                (fix_path("./x/y/z"), "z", "folder"),
                (fix_path("./x/y"), "y", "folder"),
                (fix_path("./x"), "x", "folder"),
                (".", testroot, "folder"),
            ],
            [
                (relfile, "test_eggs.py", "file"),
                (fix_path("./x/y/z"), "z", "folder"),
                (fix_path("./x/y"), "y", "folder"),
                (fix_path("./x"), "x", "folder"),
                (".", testroot, "folder"),
            ],
        ]
        expected = [
            test._replace(id=_fix_nodeid(test.id), parentid=_fix_nodeid(test.parentid))
            for test in alltests
        ]

        discovered = DiscoveredTests()

        for test, parents in zip(alltests, allparents):
            discovered.add_test(test, parents)
        tests = list(discovered)
        parents = discovered.parents

        self.maxDiff = None
        self.assertEqual(tests, expected)
        self.assertEqual(
            parents,
            [
                ParentInfo(
                    id=".",
                    kind="folder",
                    name=testroot,
                ),
                ParentInfo(
                    id="./x",
                    kind="folder",
                    name="x",
                    root=testroot,
                    relpath=fix_path("./x"),
                    parentid=".",
                ),
                ParentInfo(
                    id="./x/test_doctest.txt",
                    kind="file",
                    name="test_doctest.txt",
                    root=testroot,
                    relpath=fix_path(doctestfile),
                    parentid="./x",
                ),
                ParentInfo(
                    id="./x/y",
                    kind="folder",
                    name="y",
                    root=testroot,
                    relpath=fix_path("./x/y"),
                    parentid="./x",
                ),
                ParentInfo(
                    id="./x/y/z",
                    kind="folder",
                    name="z",
                    root=testroot,
                    relpath=fix_path("./x/y/z"),
                    parentid="./x/y",
                ),
                ParentInfo(
                    id="./x/y/z/test_eggs.py",
                    kind="file",
                    name="test_eggs.py",
                    root=testroot,
                    relpath=fix_relpath(relfile),
                    parentid="./x/y/z",
                ),
            ],
        )

    def test_nested_suite_simple(self):
        testroot = fix_path("/a/b/c")
        relfile = fix_path("./test_eggs.py")
        alltests = [
            SingleTestInfo(
                id=relfile + "::TestOuter::TestInner::test_spam",
                name="test_spam",
                path=SingleTestPath(
                    root=testroot,
                    relfile=relfile,
                    func="TestOuter.TestInner.test_spam",
                ),
                source="{}:{}".format(relfile, 10),
                markers=None,
                parentid=relfile + "::TestOuter::TestInner",
            ),
            SingleTestInfo(
                id=relfile + "::TestOuter::TestInner::test_eggs",
                name="test_eggs",
                path=SingleTestPath(
                    root=testroot,
                    relfile=relfile,
                    func="TestOuter.TestInner.test_eggs",
                ),
                source="{}:{}".format(relfile, 21),
                markers=None,
                parentid=relfile + "::TestOuter::TestInner",
            ),
        ]
        allparents = [
            [
                (relfile + "::TestOuter::TestInner", "TestInner", "suite"),
                (relfile + "::TestOuter", "TestOuter", "suite"),
                (relfile, "test_eggs.py", "file"),
                (".", testroot, "folder"),
            ],
            [
                (relfile + "::TestOuter::TestInner", "TestInner", "suite"),
                (relfile + "::TestOuter", "TestOuter", "suite"),
                (relfile, "test_eggs.py", "file"),
                (".", testroot, "folder"),
            ],
        ]
        expected = [
            test._replace(id=_fix_nodeid(test.id), parentid=_fix_nodeid(test.parentid))
            for test in alltests
        ]

        discovered = DiscoveredTests()
        for test, parents in zip(alltests, allparents):
            discovered.add_test(test, parents)
        tests = list(discovered)
        parents = discovered.parents

        self.maxDiff = None
        self.assertEqual(tests, expected)
        self.assertEqual(
            parents,
            [
                ParentInfo(
                    id=".",
                    kind="folder",
                    name=testroot,
                ),
                ParentInfo(
                    id="./test_eggs.py",
                    kind="file",
                    name="test_eggs.py",
                    root=testroot,
                    relpath=fix_relpath(relfile),
                    parentid=".",
                ),
                ParentInfo(
                    id="./test_eggs.py::TestOuter",
                    kind="suite",
                    name="TestOuter",
                    root=testroot,
                    parentid="./test_eggs.py",
                ),
                ParentInfo(
                    id="./test_eggs.py::TestOuter::TestInner",
                    kind="suite",
                    name="TestInner",
                    root=testroot,
                    parentid="./test_eggs.py::TestOuter",
                ),
            ],
        )

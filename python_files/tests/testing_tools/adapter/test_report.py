# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
# ruff:noqa: PT009

import json
import unittest

from testing_tools.adapter.info import ParentInfo, SingleTestInfo, SingleTestPath
from testing_tools.adapter.report import report_discovered
from testing_tools.adapter.util import fix_path, fix_relpath

from ...util import StubProxy


class StubSender(StubProxy):
    def send(self, outstr):
        self.add_call("send", (json.loads(outstr),), None)


##################################
# tests


class ReportDiscoveredTests(unittest.TestCase):
    def test_basic(self):
        stub = StubSender()
        testroot = fix_path("/a/b/c")
        relfile = "test_spam.py"
        relpath = fix_relpath(relfile)
        tests = [
            SingleTestInfo(
                id="test#1",
                name="test_spam",
                path=SingleTestPath(
                    root=testroot,
                    relfile=relfile,
                    func="test_spam",
                ),
                source=f"{relfile}:{10}",
                markers=[],
                parentid="file#1",
            ),
        ]
        parents = [
            ParentInfo(
                id="<root>",
                kind="folder",
                name=testroot,
            ),
            ParentInfo(
                id="file#1",
                kind="file",
                name=relfile,
                root=testroot,
                relpath=relpath,
                parentid="<root>",
            ),
        ]
        expected = [
            {
                "rootid": "<root>",
                "root": testroot,
                "parents": [
                    {
                        "id": "file#1",
                        "kind": "file",
                        "name": relfile,
                        "relpath": relpath,
                        "parentid": "<root>",
                    },
                ],
                "tests": [
                    {
                        "id": "test#1",
                        "name": "test_spam",
                        "source": f"{relfile}:{10}",
                        "markers": [],
                        "parentid": "file#1",
                    }
                ],
            }
        ]

        report_discovered(tests, parents, _send=stub.send)

        self.maxDiff = None
        self.assertEqual(
            stub.calls,
            [
                ("send", (expected,), None),
            ],
        )

    def test_multiroot(self):
        stub = StubSender()
        # the first root
        testroot1 = fix_path("/a/b/c")
        relfileid1 = "./test_spam.py"
        relpath1 = fix_path(relfileid1)
        relfile1 = relpath1[2:]
        tests = [
            SingleTestInfo(
                id=relfileid1 + "::test_spam",
                name="test_spam",
                path=SingleTestPath(
                    root=testroot1,
                    relfile=relfile1,
                    func="test_spam",
                ),
                source=f"{relfile1}:{10}",
                markers=[],
                parentid=relfileid1,
            ),
        ]
        parents = [
            ParentInfo(
                id=".",
                kind="folder",
                name=testroot1,
            ),
            ParentInfo(
                id=relfileid1,
                kind="file",
                name="test_spam.py",
                root=testroot1,
                relpath=relpath1,
                parentid=".",
            ),
        ]
        expected = [
            {
                "rootid": ".",
                "root": testroot1,
                "parents": [
                    {
                        "id": relfileid1,
                        "kind": "file",
                        "name": "test_spam.py",
                        "relpath": relpath1,
                        "parentid": ".",
                    },
                ],
                "tests": [
                    {
                        "id": relfileid1 + "::test_spam",
                        "name": "test_spam",
                        "source": f"{relfile1}:{10}",
                        "markers": [],
                        "parentid": relfileid1,
                    }
                ],
            },
        ]
        # the second root
        testroot2 = fix_path("/x/y/z")
        relfileid2 = "./w/test_eggs.py"
        relpath2 = fix_path(relfileid2)
        relfile2 = relpath2[2:]
        tests.extend(
            [
                SingleTestInfo(
                    id=relfileid2 + "::BasicTests::test_first",
                    name="test_first",
                    path=SingleTestPath(
                        root=testroot2,
                        relfile=relfile2,
                        func="BasicTests.test_first",
                    ),
                    source=f"{relfile2}:{61}",
                    markers=[],
                    parentid=relfileid2 + "::BasicTests",
                ),
            ]
        )
        parents.extend(
            [
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
                    id=relfileid2,
                    kind="file",
                    name="test_eggs.py",
                    root=testroot2,
                    relpath=relpath2,
                    parentid="./w",
                ),
                ParentInfo(
                    id=relfileid2 + "::BasicTests",
                    kind="suite",
                    name="BasicTests",
                    root=testroot2,
                    parentid=relfileid2,
                ),
            ]
        )
        expected.extend(
            [
                {
                    "rootid": ".",
                    "root": testroot2,
                    "parents": [
                        {
                            "id": "./w",
                            "kind": "folder",
                            "name": "w",
                            "relpath": fix_path("./w"),
                            "parentid": ".",
                        },
                        {
                            "id": relfileid2,
                            "kind": "file",
                            "name": "test_eggs.py",
                            "relpath": relpath2,
                            "parentid": "./w",
                        },
                        {
                            "id": relfileid2 + "::BasicTests",
                            "kind": "suite",
                            "name": "BasicTests",
                            "parentid": relfileid2,
                        },
                    ],
                    "tests": [
                        {
                            "id": relfileid2 + "::BasicTests::test_first",
                            "name": "test_first",
                            "source": f"{relfile2}:{61}",
                            "markers": [],
                            "parentid": relfileid2 + "::BasicTests",
                        }
                    ],
                },
            ]
        )

        report_discovered(tests, parents, _send=stub.send)

        self.maxDiff = None
        self.assertEqual(
            stub.calls,
            [
                ("send", (expected,), None),
            ],
        )

    def test_complex(self):
        """
        /a/b/c/
          test_ham.py
            MySuite
              test_x1
              test_x2
        /a/b/e/f/g/
          w/
            test_ham.py
              test_ham1
              HamTests
                test_uh_oh
                test_whoa
              MoreHam
                test_yay
                  sub1
                  sub2
                    sub3
            test_eggs.py
              SpamTests
                test_okay
          x/
            y/
              a/
                test_spam.py
                  SpamTests
                    test_okay
              b/
                test_spam.py
                  SpamTests
                    test_okay
          test_spam.py
              SpamTests
                test_okay
        """  # noqa: D205, D400
        stub = StubSender()
        testroot = fix_path("/a/b/c")
        relfileid1 = "./test_ham.py"
        relfileid2 = "./test_spam.py"
        relfileid3 = "./w/test_ham.py"
        relfileid4 = "./w/test_eggs.py"
        relfileid5 = "./x/y/a/test_spam.py"
        relfileid6 = "./x/y/b/test_spam.py"
        tests = [
            SingleTestInfo(
                id=relfileid1 + "::MySuite::test_x1",
                name="test_x1",
                path=SingleTestPath(
                    root=testroot,
                    relfile=fix_path(relfileid1),
                    func="MySuite.test_x1",
                ),
                source=f"{fix_path(relfileid1)}:{10}",
                markers=None,
                parentid=relfileid1 + "::MySuite",
            ),
            SingleTestInfo(
                id=relfileid1 + "::MySuite::test_x2",
                name="test_x2",
                path=SingleTestPath(
                    root=testroot,
                    relfile=fix_path(relfileid1),
                    func="MySuite.test_x2",
                ),
                source=f"{fix_path(relfileid1)}:{21}",
                markers=None,
                parentid=relfileid1 + "::MySuite",
            ),
            SingleTestInfo(
                id=relfileid2 + "::SpamTests::test_okay",
                name="test_okay",
                path=SingleTestPath(
                    root=testroot,
                    relfile=fix_path(relfileid2),
                    func="SpamTests.test_okay",
                ),
                source=f"{fix_path(relfileid2)}:{17}",
                markers=None,
                parentid=relfileid2 + "::SpamTests",
            ),
            SingleTestInfo(
                id=relfileid3 + "::test_ham1",
                name="test_ham1",
                path=SingleTestPath(
                    root=testroot,
                    relfile=fix_path(relfileid3),
                    func="test_ham1",
                ),
                source=f"{fix_path(relfileid3)}:{8}",
                markers=None,
                parentid=relfileid3,
            ),
            SingleTestInfo(
                id=relfileid3 + "::HamTests::test_uh_oh",
                name="test_uh_oh",
                path=SingleTestPath(
                    root=testroot,
                    relfile=fix_path(relfileid3),
                    func="HamTests.test_uh_oh",
                ),
                source=f"{fix_path(relfileid3)}:{19}",
                markers=["expected-failure"],
                parentid=relfileid3 + "::HamTests",
            ),
            SingleTestInfo(
                id=relfileid3 + "::HamTests::test_whoa",
                name="test_whoa",
                path=SingleTestPath(
                    root=testroot,
                    relfile=fix_path(relfileid3),
                    func="HamTests.test_whoa",
                ),
                source=f"{fix_path(relfileid3)}:{35}",
                markers=None,
                parentid=relfileid3 + "::HamTests",
            ),
            SingleTestInfo(
                id=relfileid3 + "::MoreHam::test_yay[1-2]",
                name="test_yay[1-2]",
                path=SingleTestPath(
                    root=testroot,
                    relfile=fix_path(relfileid3),
                    func="MoreHam.test_yay",
                    sub=["[1-2]"],
                ),
                source=f"{fix_path(relfileid3)}:{57}",
                markers=None,
                parentid=relfileid3 + "::MoreHam::test_yay",
            ),
            SingleTestInfo(
                id=relfileid3 + "::MoreHam::test_yay[1-2][3-4]",
                name="test_yay[1-2][3-4]",
                path=SingleTestPath(
                    root=testroot,
                    relfile=fix_path(relfileid3),
                    func="MoreHam.test_yay",
                    sub=["[1-2]", "[3=4]"],
                ),
                source=f"{fix_path(relfileid3)}:{72}",
                markers=None,
                parentid=relfileid3 + "::MoreHam::test_yay[1-2]",
            ),
            SingleTestInfo(
                id=relfileid4 + "::SpamTests::test_okay",
                name="test_okay",
                path=SingleTestPath(
                    root=testroot,
                    relfile=fix_path(relfileid4),
                    func="SpamTests.test_okay",
                ),
                source=f"{fix_path(relfileid4)}:{15}",
                markers=None,
                parentid=relfileid4 + "::SpamTests",
            ),
            SingleTestInfo(
                id=relfileid5 + "::SpamTests::test_okay",
                name="test_okay",
                path=SingleTestPath(
                    root=testroot,
                    relfile=fix_path(relfileid5),
                    func="SpamTests.test_okay",
                ),
                source=f"{fix_path(relfileid5)}:{12}",
                markers=None,
                parentid=relfileid5 + "::SpamTests",
            ),
            SingleTestInfo(
                id=relfileid6 + "::SpamTests::test_okay",
                name="test_okay",
                path=SingleTestPath(
                    root=testroot,
                    relfile=fix_path(relfileid6),
                    func="SpamTests.test_okay",
                ),
                source=f"{fix_path(relfileid6)}:{27}",
                markers=None,
                parentid=relfileid6 + "::SpamTests",
            ),
        ]
        parents = [
            ParentInfo(
                id=".",
                kind="folder",
                name=testroot,
            ),
            ParentInfo(
                id=relfileid1,
                kind="file",
                name="test_ham.py",
                root=testroot,
                relpath=fix_path(relfileid1),
                parentid=".",
            ),
            ParentInfo(
                id=relfileid1 + "::MySuite",
                kind="suite",
                name="MySuite",
                root=testroot,
                parentid=relfileid1,
            ),
            ParentInfo(
                id=relfileid2,
                kind="file",
                name="test_spam.py",
                root=testroot,
                relpath=fix_path(relfileid2),
                parentid=".",
            ),
            ParentInfo(
                id=relfileid2 + "::SpamTests",
                kind="suite",
                name="SpamTests",
                root=testroot,
                parentid=relfileid2,
            ),
            ParentInfo(
                id="./w",
                kind="folder",
                name="w",
                root=testroot,
                relpath=fix_path("./w"),
                parentid=".",
            ),
            ParentInfo(
                id=relfileid3,
                kind="file",
                name="test_ham.py",
                root=testroot,
                relpath=fix_path(relfileid3),
                parentid="./w",
            ),
            ParentInfo(
                id=relfileid3 + "::HamTests",
                kind="suite",
                name="HamTests",
                root=testroot,
                parentid=relfileid3,
            ),
            ParentInfo(
                id=relfileid3 + "::MoreHam",
                kind="suite",
                name="MoreHam",
                root=testroot,
                parentid=relfileid3,
            ),
            ParentInfo(
                id=relfileid3 + "::MoreHam::test_yay",
                kind="function",
                name="test_yay",
                root=testroot,
                parentid=relfileid3 + "::MoreHam",
            ),
            ParentInfo(
                id=relfileid3 + "::MoreHam::test_yay[1-2]",
                kind="subtest",
                name="test_yay[1-2]",
                root=testroot,
                parentid=relfileid3 + "::MoreHam::test_yay",
            ),
            ParentInfo(
                id=relfileid4,
                kind="file",
                name="test_eggs.py",
                root=testroot,
                relpath=fix_path(relfileid4),
                parentid="./w",
            ),
            ParentInfo(
                id=relfileid4 + "::SpamTests",
                kind="suite",
                name="SpamTests",
                root=testroot,
                parentid=relfileid4,
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
                id="./x/y/a",
                kind="folder",
                name="a",
                root=testroot,
                relpath=fix_path("./x/y/a"),
                parentid="./x/y",
            ),
            ParentInfo(
                id=relfileid5,
                kind="file",
                name="test_spam.py",
                root=testroot,
                relpath=fix_path(relfileid5),
                parentid="./x/y/a",
            ),
            ParentInfo(
                id=relfileid5 + "::SpamTests",
                kind="suite",
                name="SpamTests",
                root=testroot,
                parentid=relfileid5,
            ),
            ParentInfo(
                id="./x/y/b",
                kind="folder",
                name="b",
                root=testroot,
                relpath=fix_path("./x/y/b"),
                parentid="./x/y",
            ),
            ParentInfo(
                id=relfileid6,
                kind="file",
                name="test_spam.py",
                root=testroot,
                relpath=fix_path(relfileid6),
                parentid="./x/y/b",
            ),
            ParentInfo(
                id=relfileid6 + "::SpamTests",
                kind="suite",
                name="SpamTests",
                root=testroot,
                parentid=relfileid6,
            ),
        ]
        expected = [
            {
                "rootid": ".",
                "root": testroot,
                "parents": [
                    {
                        "id": relfileid1,
                        "kind": "file",
                        "name": "test_ham.py",
                        "relpath": fix_path(relfileid1),
                        "parentid": ".",
                    },
                    {
                        "id": relfileid1 + "::MySuite",
                        "kind": "suite",
                        "name": "MySuite",
                        "parentid": relfileid1,
                    },
                    {
                        "id": relfileid2,
                        "kind": "file",
                        "name": "test_spam.py",
                        "relpath": fix_path(relfileid2),
                        "parentid": ".",
                    },
                    {
                        "id": relfileid2 + "::SpamTests",
                        "kind": "suite",
                        "name": "SpamTests",
                        "parentid": relfileid2,
                    },
                    {
                        "id": "./w",
                        "kind": "folder",
                        "name": "w",
                        "relpath": fix_path("./w"),
                        "parentid": ".",
                    },
                    {
                        "id": relfileid3,
                        "kind": "file",
                        "name": "test_ham.py",
                        "relpath": fix_path(relfileid3),
                        "parentid": "./w",
                    },
                    {
                        "id": relfileid3 + "::HamTests",
                        "kind": "suite",
                        "name": "HamTests",
                        "parentid": relfileid3,
                    },
                    {
                        "id": relfileid3 + "::MoreHam",
                        "kind": "suite",
                        "name": "MoreHam",
                        "parentid": relfileid3,
                    },
                    {
                        "id": relfileid3 + "::MoreHam::test_yay",
                        "kind": "function",
                        "name": "test_yay",
                        "parentid": relfileid3 + "::MoreHam",
                    },
                    {
                        "id": relfileid3 + "::MoreHam::test_yay[1-2]",
                        "kind": "subtest",
                        "name": "test_yay[1-2]",
                        "parentid": relfileid3 + "::MoreHam::test_yay",
                    },
                    {
                        "id": relfileid4,
                        "kind": "file",
                        "name": "test_eggs.py",
                        "relpath": fix_path(relfileid4),
                        "parentid": "./w",
                    },
                    {
                        "id": relfileid4 + "::SpamTests",
                        "kind": "suite",
                        "name": "SpamTests",
                        "parentid": relfileid4,
                    },
                    {
                        "id": "./x",
                        "kind": "folder",
                        "name": "x",
                        "relpath": fix_path("./x"),
                        "parentid": ".",
                    },
                    {
                        "id": "./x/y",
                        "kind": "folder",
                        "name": "y",
                        "relpath": fix_path("./x/y"),
                        "parentid": "./x",
                    },
                    {
                        "id": "./x/y/a",
                        "kind": "folder",
                        "name": "a",
                        "relpath": fix_path("./x/y/a"),
                        "parentid": "./x/y",
                    },
                    {
                        "id": relfileid5,
                        "kind": "file",
                        "name": "test_spam.py",
                        "relpath": fix_path(relfileid5),
                        "parentid": "./x/y/a",
                    },
                    {
                        "id": relfileid5 + "::SpamTests",
                        "kind": "suite",
                        "name": "SpamTests",
                        "parentid": relfileid5,
                    },
                    {
                        "id": "./x/y/b",
                        "kind": "folder",
                        "name": "b",
                        "relpath": fix_path("./x/y/b"),
                        "parentid": "./x/y",
                    },
                    {
                        "id": relfileid6,
                        "kind": "file",
                        "name": "test_spam.py",
                        "relpath": fix_path(relfileid6),
                        "parentid": "./x/y/b",
                    },
                    {
                        "id": relfileid6 + "::SpamTests",
                        "kind": "suite",
                        "name": "SpamTests",
                        "parentid": relfileid6,
                    },
                ],
                "tests": [
                    {
                        "id": relfileid1 + "::MySuite::test_x1",
                        "name": "test_x1",
                        "source": f"{fix_path(relfileid1)}:{10}",
                        "markers": [],
                        "parentid": relfileid1 + "::MySuite",
                    },
                    {
                        "id": relfileid1 + "::MySuite::test_x2",
                        "name": "test_x2",
                        "source": f"{fix_path(relfileid1)}:{21}",
                        "markers": [],
                        "parentid": relfileid1 + "::MySuite",
                    },
                    {
                        "id": relfileid2 + "::SpamTests::test_okay",
                        "name": "test_okay",
                        "source": f"{fix_path(relfileid2)}:{17}",
                        "markers": [],
                        "parentid": relfileid2 + "::SpamTests",
                    },
                    {
                        "id": relfileid3 + "::test_ham1",
                        "name": "test_ham1",
                        "source": f"{fix_path(relfileid3)}:{8}",
                        "markers": [],
                        "parentid": relfileid3,
                    },
                    {
                        "id": relfileid3 + "::HamTests::test_uh_oh",
                        "name": "test_uh_oh",
                        "source": f"{fix_path(relfileid3)}:{19}",
                        "markers": ["expected-failure"],
                        "parentid": relfileid3 + "::HamTests",
                    },
                    {
                        "id": relfileid3 + "::HamTests::test_whoa",
                        "name": "test_whoa",
                        "source": f"{fix_path(relfileid3)}:{35}",
                        "markers": [],
                        "parentid": relfileid3 + "::HamTests",
                    },
                    {
                        "id": relfileid3 + "::MoreHam::test_yay[1-2]",
                        "name": "test_yay[1-2]",
                        "source": f"{fix_path(relfileid3)}:{57}",
                        "markers": [],
                        "parentid": relfileid3 + "::MoreHam::test_yay",
                    },
                    {
                        "id": relfileid3 + "::MoreHam::test_yay[1-2][3-4]",
                        "name": "test_yay[1-2][3-4]",
                        "source": f"{fix_path(relfileid3)}:{72}",
                        "markers": [],
                        "parentid": relfileid3 + "::MoreHam::test_yay[1-2]",
                    },
                    {
                        "id": relfileid4 + "::SpamTests::test_okay",
                        "name": "test_okay",
                        "source": f"{fix_path(relfileid4)}:{15}",
                        "markers": [],
                        "parentid": relfileid4 + "::SpamTests",
                    },
                    {
                        "id": relfileid5 + "::SpamTests::test_okay",
                        "name": "test_okay",
                        "source": f"{fix_path(relfileid5)}:{12}",
                        "markers": [],
                        "parentid": relfileid5 + "::SpamTests",
                    },
                    {
                        "id": relfileid6 + "::SpamTests::test_okay",
                        "name": "test_okay",
                        "source": f"{fix_path(relfileid6)}:{27}",
                        "markers": [],
                        "parentid": relfileid6 + "::SpamTests",
                    },
                ],
            }
        ]

        report_discovered(tests, parents, _send=stub.send)

        self.maxDiff = None
        self.assertEqual(
            stub.calls,
            [
                ("send", (expected,), None),
            ],
        )

    def test_simple_basic(self):
        stub = StubSender()
        testroot = fix_path("/a/b/c")
        relfile = fix_path("x/y/z/test_spam.py")
        tests = [
            SingleTestInfo(
                id="test#1",
                name="test_spam_1",
                path=SingleTestPath(
                    root=testroot,
                    relfile=relfile,
                    func="MySuite.test_spam_1",
                    sub=None,
                ),
                source=f"{relfile}:{10}",
                markers=None,
                parentid="suite#1",
            ),
        ]
        parents = None
        expected = [
            {
                "id": "test#1",
                "name": "test_spam_1",
                "testroot": testroot,
                "relfile": relfile,
                "lineno": 10,
                "testfunc": "MySuite.test_spam_1",
                "subtest": None,
                "markers": [],
            }
        ]

        report_discovered(tests, parents, simple=True, _send=stub.send)

        self.maxDiff = None
        self.assertEqual(
            stub.calls,
            [
                ("send", (expected,), None),
            ],
        )

    def test_simple_complex(self):
        """
        /a/b/c/
          test_ham.py
            MySuite
              test_x1
              test_x2
        /a/b/e/f/g/
          w/
            test_ham.py
              test_ham1
              HamTests
                test_uh_oh
                test_whoa
              MoreHam
                test_yay
                  sub1
                  sub2
                    sub3
            test_eggs.py
              SpamTests
                test_okay
          x/
            y/
              a/
                test_spam.py
                  SpamTests
                    test_okay
              b/
                test_spam.py
                  SpamTests
                    test_okay
          test_spam.py
              SpamTests
                test_okay
        """  # noqa: D205, D400
        stub = StubSender()
        testroot1 = fix_path("/a/b/c")
        relfile1 = fix_path("./test_ham.py")
        testroot2 = fix_path("/a/b/e/f/g")
        relfile2 = fix_path("./test_spam.py")
        relfile3 = fix_path("w/test_ham.py")
        relfile4 = fix_path("w/test_eggs.py")
        relfile5 = fix_path("x/y/a/test_spam.py")
        relfile6 = fix_path("x/y/b/test_spam.py")
        tests = [
            # under first root folder
            SingleTestInfo(
                id="test#1",
                name="test_x1",
                path=SingleTestPath(
                    root=testroot1,
                    relfile=relfile1,
                    func="MySuite.test_x1",
                    sub=None,
                ),
                source=f"{relfile1}:{10}",
                markers=None,
                parentid="suite#1",
            ),
            SingleTestInfo(
                id="test#2",
                name="test_x2",
                path=SingleTestPath(
                    root=testroot1,
                    relfile=relfile1,
                    func="MySuite.test_x2",
                    sub=None,
                ),
                source=f"{relfile1}:{21}",
                markers=None,
                parentid="suite#1",
            ),
            # under second root folder
            SingleTestInfo(
                id="test#3",
                name="test_okay",
                path=SingleTestPath(
                    root=testroot2,
                    relfile=relfile2,
                    func="SpamTests.test_okay",
                    sub=None,
                ),
                source=f"{relfile2}:{17}",
                markers=None,
                parentid="suite#2",
            ),
            SingleTestInfo(
                id="test#4",
                name="test_ham1",
                path=SingleTestPath(
                    root=testroot2,
                    relfile=relfile3,
                    func="test_ham1",
                    sub=None,
                ),
                source=f"{relfile3}:{8}",
                markers=None,
                parentid="file#3",
            ),
            SingleTestInfo(
                id="test#5",
                name="test_uh_oh",
                path=SingleTestPath(
                    root=testroot2,
                    relfile=relfile3,
                    func="HamTests.test_uh_oh",
                    sub=None,
                ),
                source=f"{relfile3}:{19}",
                markers=["expected-failure"],
                parentid="suite#3",
            ),
            SingleTestInfo(
                id="test#6",
                name="test_whoa",
                path=SingleTestPath(
                    root=testroot2,
                    relfile=relfile3,
                    func="HamTests.test_whoa",
                    sub=None,
                ),
                source=f"{relfile3}:{35}",
                markers=None,
                parentid="suite#3",
            ),
            SingleTestInfo(
                id="test#7",
                name="test_yay (sub1)",
                path=SingleTestPath(
                    root=testroot2,
                    relfile=relfile3,
                    func="MoreHam.test_yay",
                    sub=["sub1"],
                ),
                source=f"{relfile3}:{57}",
                markers=None,
                parentid="suite#4",
            ),
            SingleTestInfo(
                id="test#8",
                name="test_yay (sub2) (sub3)",
                path=SingleTestPath(
                    root=testroot2,
                    relfile=relfile3,
                    func="MoreHam.test_yay",
                    sub=["sub2", "sub3"],
                ),
                source=f"{relfile3}:{72}",
                markers=None,
                parentid="suite#3",
            ),
            SingleTestInfo(
                id="test#9",
                name="test_okay",
                path=SingleTestPath(
                    root=testroot2,
                    relfile=relfile4,
                    func="SpamTests.test_okay",
                    sub=None,
                ),
                source=f"{relfile4}:{15}",
                markers=None,
                parentid="suite#5",
            ),
            SingleTestInfo(
                id="test#10",
                name="test_okay",
                path=SingleTestPath(
                    root=testroot2,
                    relfile=relfile5,
                    func="SpamTests.test_okay",
                    sub=None,
                ),
                source=f"{relfile5}:{12}",
                markers=None,
                parentid="suite#6",
            ),
            SingleTestInfo(
                id="test#11",
                name="test_okay",
                path=SingleTestPath(
                    root=testroot2,
                    relfile=relfile6,
                    func="SpamTests.test_okay",
                    sub=None,
                ),
                source=f"{relfile6}:{27}",
                markers=None,
                parentid="suite#7",
            ),
        ]
        expected = [
            {
                "id": "test#1",
                "name": "test_x1",
                "testroot": testroot1,
                "relfile": relfile1,
                "lineno": 10,
                "testfunc": "MySuite.test_x1",
                "subtest": None,
                "markers": [],
            },
            {
                "id": "test#2",
                "name": "test_x2",
                "testroot": testroot1,
                "relfile": relfile1,
                "lineno": 21,
                "testfunc": "MySuite.test_x2",
                "subtest": None,
                "markers": [],
            },
            {
                "id": "test#3",
                "name": "test_okay",
                "testroot": testroot2,
                "relfile": relfile2,
                "lineno": 17,
                "testfunc": "SpamTests.test_okay",
                "subtest": None,
                "markers": [],
            },
            {
                "id": "test#4",
                "name": "test_ham1",
                "testroot": testroot2,
                "relfile": relfile3,
                "lineno": 8,
                "testfunc": "test_ham1",
                "subtest": None,
                "markers": [],
            },
            {
                "id": "test#5",
                "name": "test_uh_oh",
                "testroot": testroot2,
                "relfile": relfile3,
                "lineno": 19,
                "testfunc": "HamTests.test_uh_oh",
                "subtest": None,
                "markers": ["expected-failure"],
            },
            {
                "id": "test#6",
                "name": "test_whoa",
                "testroot": testroot2,
                "relfile": relfile3,
                "lineno": 35,
                "testfunc": "HamTests.test_whoa",
                "subtest": None,
                "markers": [],
            },
            {
                "id": "test#7",
                "name": "test_yay (sub1)",
                "testroot": testroot2,
                "relfile": relfile3,
                "lineno": 57,
                "testfunc": "MoreHam.test_yay",
                "subtest": ["sub1"],
                "markers": [],
            },
            {
                "id": "test#8",
                "name": "test_yay (sub2) (sub3)",
                "testroot": testroot2,
                "relfile": relfile3,
                "lineno": 72,
                "testfunc": "MoreHam.test_yay",
                "subtest": ["sub2", "sub3"],
                "markers": [],
            },
            {
                "id": "test#9",
                "name": "test_okay",
                "testroot": testroot2,
                "relfile": relfile4,
                "lineno": 15,
                "testfunc": "SpamTests.test_okay",
                "subtest": None,
                "markers": [],
            },
            {
                "id": "test#10",
                "name": "test_okay",
                "testroot": testroot2,
                "relfile": relfile5,
                "lineno": 12,
                "testfunc": "SpamTests.test_okay",
                "subtest": None,
                "markers": [],
            },
            {
                "id": "test#11",
                "name": "test_okay",
                "testroot": testroot2,
                "relfile": relfile6,
                "lineno": 27,
                "testfunc": "SpamTests.test_okay",
                "subtest": None,
                "markers": [],
            },
        ]
        parents = None

        report_discovered(tests, parents, simple=True, _send=stub.send)

        self.maxDiff = None
        self.assertEqual(
            stub.calls,
            [
                ("send", (expected,), None),
            ],
        )

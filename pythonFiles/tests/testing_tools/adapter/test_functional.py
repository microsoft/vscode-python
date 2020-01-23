# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

from __future__ import absolute_import, unicode_literals

import json
import os
import os.path
import subprocess
import sys
import unittest

import pytest

from ...__main__ import TESTING_TOOLS_ROOT
from testing_tools.adapter.util import fix_path, PATH_SEP


CWD = os.getcwd()
DATA_DIR = os.path.join(os.path.dirname(__file__), ".data")
SCRIPT = os.path.join(TESTING_TOOLS_ROOT, "run_adapter.py")


def resolve_testroot(name):
    projroot = os.path.join(DATA_DIR, name)
    return projroot, os.path.join(projroot, "tests")


def run_adapter(cmd, tool, *cliargs):
    try:
        return _run_adapter(cmd, tool, *cliargs)
    except subprocess.CalledProcessError as exc:
        print(exc.output)


def _run_adapter(cmd, tool, *cliargs, **kwargs):
    hidestdio = kwargs.pop("hidestdio", True)
    assert not kwargs or tuple(kwargs) == ("stderr",)
    kwds = kwargs
    argv = [sys.executable, SCRIPT, cmd, tool, "--"] + list(cliargs)
    if not hidestdio:
        argv.insert(4, "--no-hide-stdio")
        kwds["stderr"] = subprocess.STDOUT
    argv.append("--cache-clear")
    print(
        "running {!r}".format(" ".join(arg.rpartition(CWD + "/")[-1] for arg in argv))
    )
    output = subprocess.check_output(argv, universal_newlines=True, **kwds)
    return output


def fix_test_order(tests):
    if sys.version_info >= (3, 6):
        return tests
    fixed = []
    curfile = None
    group = []
    for test in tests:
        if (curfile or "???") not in test["id"]:
            fixed.extend(sorted(group, key=lambda t: t["id"]))
            group = []
            curfile = test["id"].partition(".py::")[0] + ".py"
        group.append(test)
    fixed.extend(sorted(group, key=lambda t: t["id"]))
    return fixed


def fix_source(tests, testid, srcfile, lineno):
    for test in tests:
        if test["id"] == testid:
            break
    else:
        raise KeyError("test {!r} not found".format(testid))
    if not srcfile:
        srcfile = test["source"].rpartition(":")[0]
    test["source"] = fix_path("{}:{}".format(srcfile, lineno))


# Note that these tests are skipped if util.PATH_SEP is not os.path.sep.
# This is because the functional tests should reflect the actual
# operating environment.


@pytest.mark.functional
class PytestTests(unittest.TestCase):
    def setUp(self):
        if PATH_SEP is not os.path.sep:
            raise unittest.SkipTest("functional tests require unmodified env")
        super(PytestTests, self).setUp()

    def complex(self, testroot):
        results = COMPLEX.copy()
        results["root"] = testroot
        return [results]

    def test_discover_simple(self):
        projroot, testroot = resolve_testroot("simple")

        out = run_adapter("discover", "pytest", "--rootdir", projroot, testroot)
        result = json.loads(out)

        self.maxDiff = None
        self.assertEqual(
            result,
            [
                {
                    "root": projroot,
                    "rootid": ".",
                    "parents": [
                        {
                            "id": "./tests",
                            "kind": "folder",
                            "name": "tests",
                            "relpath": fix_path("./tests"),
                            "parentid": ".",
                        },
                        {
                            "id": "./tests/test_spam.py",
                            "kind": "file",
                            "name": "test_spam.py",
                            "relpath": fix_path("./tests/test_spam.py"),
                            "parentid": "./tests",
                        },
                    ],
                    "tests": [
                        {
                            "id": "./tests/test_spam.py::test_simple",
                            "name": "test_simple",
                            "source": fix_path("./tests/test_spam.py:2"),
                            "markers": [],
                            "parentid": "./tests/test_spam.py",
                        },
                    ],
                }
            ],
        )

    def test_discover_complex_default(self):
        projroot, testroot = resolve_testroot("complex")
        expected = self.complex(projroot)
        expected[0]["tests"] = fix_test_order(expected[0]["tests"])
        if sys.version_info < (3,):
            decorated = [
                "./tests/test_unittest.py::MyTests::test_skipped",
                "./tests/test_unittest.py::MyTests::test_maybe_skipped",
                "./tests/test_unittest.py::MyTests::test_maybe_not_skipped",
            ]
            for testid in decorated:
                fix_source(expected[0]["tests"], testid, None, 0)

        out = run_adapter("discover", "pytest", "--rootdir", projroot, testroot)
        result = json.loads(out)
        result[0]["tests"] = fix_test_order(result[0]["tests"])

        self.maxDiff = None
        self.assertEqual(result, expected)

    def test_discover_complex_doctest(self):
        projroot, _ = resolve_testroot("complex")
        expected = self.complex(projroot)
        # add in doctests from test suite
        expected[0]["parents"].insert(
            3,
            {
                "id": "./tests/test_doctest.py",
                "kind": "file",
                "name": "test_doctest.py",
                "relpath": fix_path("./tests/test_doctest.py"),
                "parentid": "./tests",
            },
        )
        expected[0]["tests"].insert(
            2,
            {
                "id": "./tests/test_doctest.py::tests.test_doctest",
                "name": "tests.test_doctest",
                "source": fix_path("./tests/test_doctest.py:1"),
                "markers": [],
                "parentid": "./tests/test_doctest.py",
            },
        )
        # add in doctests from non-test module
        expected[0]["parents"].insert(
            0,
            {
                "id": "./mod.py",
                "kind": "file",
                "name": "mod.py",
                "relpath": fix_path("./mod.py"),
                "parentid": ".",
            },
        )
        expected[0]["tests"] = [
            {
                "id": "./mod.py::mod",
                "name": "mod",
                "source": fix_path("./mod.py:1"),
                "markers": [],
                "parentid": "./mod.py",
            },
            {
                "id": "./mod.py::mod.Spam",
                "name": "mod.Spam",
                "source": fix_path("./mod.py:33"),
                "markers": [],
                "parentid": "./mod.py",
            },
            {
                "id": "./mod.py::mod.Spam.eggs",
                "name": "mod.Spam.eggs",
                "source": fix_path("./mod.py:43"),
                "markers": [],
                "parentid": "./mod.py",
            },
            {
                "id": "./mod.py::mod.square",
                "name": "mod.square",
                "source": fix_path("./mod.py:18"),
                "markers": [],
                "parentid": "./mod.py",
            },
        ] + expected[0]["tests"]
        expected[0]["tests"] = fix_test_order(expected[0]["tests"])
        if sys.version_info < (3,):
            decorated = [
                "./tests/test_unittest.py::MyTests::test_skipped",
                "./tests/test_unittest.py::MyTests::test_maybe_skipped",
                "./tests/test_unittest.py::MyTests::test_maybe_not_skipped",
            ]
            for testid in decorated:
                fix_source(expected[0]["tests"], testid, None, 0)

        out = run_adapter(
            "discover", "pytest", "--rootdir", projroot, "--doctest-modules", projroot
        )
        result = json.loads(out)
        result[0]["tests"] = fix_test_order(result[0]["tests"])

        self.maxDiff = None
        self.assertEqual(result, expected)

    def test_discover_not_found(self):
        projroot, testroot = resolve_testroot("notests")

        out = run_adapter("discover", "pytest", "--rootdir", projroot, testroot)
        result = json.loads(out)

        self.maxDiff = None
        self.assertEqual(result, [])
        # TODO: Expect the following instead?
        # self.assertEqual(result, [{
        #    'root': projroot,
        #    'rootid': '.',
        #    'parents': [],
        #    'tests': [],
        #    }])

    @unittest.skip("broken in CI")
    def test_discover_bad_args(self):
        projroot, testroot = resolve_testroot("simple")

        with self.assertRaises(subprocess.CalledProcessError) as cm:
            _run_adapter(
                "discover",
                "pytest",
                "--spam",
                "--rootdir",
                projroot,
                testroot,
                stderr=subprocess.STDOUT,
            )
        self.assertIn("(exit code 4)", cm.exception.output)

    def test_discover_syntax_error(self):
        projroot, testroot = resolve_testroot("syntax-error")

        with self.assertRaises(subprocess.CalledProcessError) as cm:
            _run_adapter(
                "discover",
                "pytest",
                "--rootdir",
                projroot,
                testroot,
                stderr=subprocess.STDOUT,
            )
        self.assertIn("(exit code 2)", cm.exception.output)

    def test_discover_normcase(self):
        projroot, testroot = resolve_testroot("NormCase")

        out = run_adapter("discover", "pytest", "--rootdir", projroot, testroot)
        result = json.loads(out)

        self.maxDiff = None
        self.assertTrue(projroot.endswith("NormCase"))
        self.assertEqual(
            result,
            [
                {
                    "root": projroot,
                    "rootid": ".",
                    "parents": [
                        {
                            "id": "./tests",
                            "kind": "folder",
                            "name": "tests",
                            "relpath": fix_path("./tests"),
                            "parentid": ".",
                        },
                        {
                            "id": "./tests/A",
                            "kind": "folder",
                            "name": "A",
                            "relpath": fix_path("./tests/A"),
                            "parentid": "./tests",
                        },
                        {
                            "id": "./tests/A/b",
                            "kind": "folder",
                            "name": "b",
                            "relpath": fix_path("./tests/A/b"),
                            "parentid": "./tests/A",
                        },
                        {
                            "id": "./tests/A/b/C",
                            "kind": "folder",
                            "name": "C",
                            "relpath": fix_path("./tests/A/b/C"),
                            "parentid": "./tests/A/b",
                        },
                        {
                            "id": "./tests/A/b/C/test_Spam.py",
                            "kind": "file",
                            "name": "test_Spam.py",
                            "relpath": fix_path("./tests/A/b/C/test_Spam.py"),
                            "parentid": "./tests/A/b/C",
                        },
                    ],
                    "tests": [
                        {
                            "id": "./tests/A/b/C/test_Spam.py::test_okay",
                            "name": "test_okay",
                            "source": fix_path("./tests/A/b/C/test_Spam.py:2"),
                            "markers": [],
                            "parentid": "./tests/A/b/C/test_Spam.py",
                        },
                    ],
                }
            ],
        )


COMPLEX = {
    "root": None,
    "rootid": ".",
    "parents": [
        #
        {
            "id": "./tests",
            "kind": "folder",
            "name": "tests",
            "relpath": fix_path("./tests"),
            "parentid": ".",
        },
        # +++
        {
            "id": "./tests/test_42-43.py",
            "kind": "file",
            "name": "test_42-43.py",
            "relpath": fix_path("./tests/test_42-43.py"),
            "parentid": "./tests",
        },
        # +++
        {
            "id": "./tests/test_42.py",
            "kind": "file",
            "name": "test_42.py",
            "relpath": fix_path("./tests/test_42.py"),
            "parentid": "./tests",
        },
        # +++
        {
            "id": "./tests/test_doctest.txt",
            "kind": "file",
            "name": "test_doctest.txt",
            "relpath": fix_path("./tests/test_doctest.txt"),
            "parentid": "./tests",
        },
        # +++
        {
            "id": "./tests/test_foo.py",
            "kind": "file",
            "name": "test_foo.py",
            "relpath": fix_path("./tests/test_foo.py"),
            "parentid": "./tests",
        },
        # +++
        {
            "id": "./tests/test_mixed.py",
            "kind": "file",
            "name": "test_mixed.py",
            "relpath": fix_path("./tests/test_mixed.py"),
            "parentid": "./tests",
        },
        {
            "id": "./tests/test_mixed.py::MyTests",
            "kind": "suite",
            "name": "MyTests",
            "parentid": "./tests/test_mixed.py",
        },
        {
            "id": "./tests/test_mixed.py::TestMySuite",
            "kind": "suite",
            "name": "TestMySuite",
            "parentid": "./tests/test_mixed.py",
        },
        # +++
        {
            "id": "./tests/test_pytest.py",
            "kind": "file",
            "name": "test_pytest.py",
            "relpath": fix_path("./tests/test_pytest.py"),
            "parentid": "./tests",
        },
        {
            "id": "./tests/test_pytest.py::TestEggs",
            "kind": "suite",
            "name": "TestEggs",
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::TestParam",
            "kind": "suite",
            "name": "TestParam",
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::TestParam::test_param_13",
            "kind": "function",
            "name": "test_param_13",
            "parentid": "./tests/test_pytest.py::TestParam",
        },
        {
            "id": "./tests/test_pytest.py::TestParamAll",
            "kind": "suite",
            "name": "TestParamAll",
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::TestParamAll::test_param_13",
            "kind": "function",
            "name": "test_param_13",
            "parentid": "./tests/test_pytest.py::TestParamAll",
        },
        {
            "id": "./tests/test_pytest.py::TestParamAll::test_spam_13",
            "kind": "function",
            "name": "test_spam_13",
            "parentid": "./tests/test_pytest.py::TestParamAll",
        },
        {
            "id": "./tests/test_pytest.py::TestSpam",
            "kind": "suite",
            "name": "TestSpam",
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::TestSpam::TestHam",
            "kind": "suite",
            "name": "TestHam",
            "parentid": "./tests/test_pytest.py::TestSpam",
        },
        {
            "id": "./tests/test_pytest.py::TestSpam::TestHam::TestEggs",
            "kind": "suite",
            "name": "TestEggs",
            "parentid": "./tests/test_pytest.py::TestSpam::TestHam",
        },
        {
            "id": "./tests/test_pytest.py::test_fixture_param",
            "kind": "function",
            "name": "test_fixture_param",
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::test_param_01",
            "kind": "function",
            "name": "test_param_01",
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::test_param_11",
            "kind": "function",
            "name": "test_param_11",
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::test_param_13",
            "kind": "function",
            "name": "test_param_13",
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::test_param_13_markers",
            "kind": "function",
            "name": "test_param_13_markers",
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::test_param_13_repeat",
            "kind": "function",
            "name": "test_param_13_repeat",
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::test_param_13_skipped",
            "kind": "function",
            "name": "test_param_13_skipped",
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::test_param_23_13",
            "kind": "function",
            "name": "test_param_23_13",
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::test_param_23_raises",
            "kind": "function",
            "name": "test_param_23_raises",
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::test_param_33",
            "kind": "function",
            "name": "test_param_33",
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::test_param_33_ids",
            "kind": "function",
            "name": "test_param_33_ids",
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::test_param_fixture",
            "kind": "function",
            "name": "test_param_fixture",
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::test_param_mark_fixture",
            "kind": "function",
            "name": "test_param_mark_fixture",
            "parentid": "./tests/test_pytest.py",
        },
        # +++
        {
            "id": "./tests/test_pytest_param.py",
            "kind": "file",
            "name": "test_pytest_param.py",
            "relpath": fix_path("./tests/test_pytest_param.py"),
            "parentid": "./tests",
        },
        {
            "id": "./tests/test_pytest_param.py::TestParamAll",
            "kind": "suite",
            "name": "TestParamAll",
            "parentid": "./tests/test_pytest_param.py",
        },
        {
            "id": "./tests/test_pytest_param.py::TestParamAll::test_param_13",
            "kind": "function",
            "name": "test_param_13",
            "parentid": "./tests/test_pytest_param.py::TestParamAll",
        },
        {
            "id": "./tests/test_pytest_param.py::TestParamAll::test_spam_13",
            "kind": "function",
            "name": "test_spam_13",
            "parentid": "./tests/test_pytest_param.py::TestParamAll",
        },
        {
            "id": "./tests/test_pytest_param.py::test_param_13",
            "kind": "function",
            "name": "test_param_13",
            "parentid": "./tests/test_pytest_param.py",
        },
        # +++
        {
            "id": "./tests/test_unittest.py",
            "kind": "file",
            "name": "test_unittest.py",
            "relpath": fix_path("./tests/test_unittest.py"),
            "parentid": "./tests",
        },
        {
            "id": "./tests/test_unittest.py::MyTests",
            "kind": "suite",
            "name": "MyTests",
            "parentid": "./tests/test_unittest.py",
        },
        {
            "id": "./tests/test_unittest.py::OtherTests",
            "kind": "suite",
            "name": "OtherTests",
            "parentid": "./tests/test_unittest.py",
        },
        ##
        {
            "id": "./tests/v",
            "kind": "folder",
            "name": "v",
            "relpath": fix_path("./tests/v"),
            "parentid": "./tests",
        },
        ## +++
        {
            "id": "./tests/v/test_eggs.py",
            "kind": "file",
            "name": "test_eggs.py",
            "relpath": fix_path("./tests/v/test_eggs.py"),
            "parentid": "./tests/v",
        },
        {
            "id": "./tests/v/test_eggs.py::TestSimple",
            "kind": "suite",
            "name": "TestSimple",
            "parentid": "./tests/v/test_eggs.py",
        },
        ## +++
        {
            "id": "./tests/v/test_ham.py",
            "kind": "file",
            "name": "test_ham.py",
            "relpath": fix_path("./tests/v/test_ham.py"),
            "parentid": "./tests/v",
        },
        ## +++
        {
            "id": "./tests/v/test_spam.py",
            "kind": "file",
            "name": "test_spam.py",
            "relpath": fix_path("./tests/v/test_spam.py"),
            "parentid": "./tests/v",
        },
        ##
        {
            "id": "./tests/w",
            "kind": "folder",
            "name": "w",
            "relpath": fix_path("./tests/w"),
            "parentid": "./tests",
        },
        ## +++
        {
            "id": "./tests/w/test_spam.py",
            "kind": "file",
            "name": "test_spam.py",
            "relpath": fix_path("./tests/w/test_spam.py"),
            "parentid": "./tests/w",
        },
        ## +++
        {
            "id": "./tests/w/test_spam_ex.py",
            "kind": "file",
            "name": "test_spam_ex.py",
            "relpath": fix_path("./tests/w/test_spam_ex.py"),
            "parentid": "./tests/w",
        },
        ##
        {
            "id": "./tests/x",
            "kind": "folder",
            "name": "x",
            "relpath": fix_path("./tests/x"),
            "parentid": "./tests",
        },
        ###
        {
            "id": "./tests/x/y",
            "kind": "folder",
            "name": "y",
            "relpath": fix_path("./tests/x/y"),
            "parentid": "./tests/x",
        },
        ####
        {
            "id": "./tests/x/y/z",
            "kind": "folder",
            "name": "z",
            "relpath": fix_path("./tests/x/y/z"),
            "parentid": "./tests/x/y",
        },
        #####
        {
            "id": "./tests/x/y/z/a",
            "kind": "folder",
            "name": "a",
            "relpath": fix_path("./tests/x/y/z/a"),
            "parentid": "./tests/x/y/z",
        },
        ##### +++
        {
            "id": "./tests/x/y/z/a/test_spam.py",
            "kind": "file",
            "name": "test_spam.py",
            "relpath": fix_path("./tests/x/y/z/a/test_spam.py"),
            "parentid": "./tests/x/y/z/a",
        },
        #####
        {
            "id": "./tests/x/y/z/b",
            "kind": "folder",
            "name": "b",
            "relpath": fix_path("./tests/x/y/z/b"),
            "parentid": "./tests/x/y/z",
        },
        ##### +++
        {
            "id": "./tests/x/y/z/b/test_spam.py",
            "kind": "file",
            "name": "test_spam.py",
            "relpath": fix_path("./tests/x/y/z/b/test_spam.py"),
            "parentid": "./tests/x/y/z/b",
        },
        #### +++
        {
            "id": "./tests/x/y/z/test_ham.py",
            "kind": "file",
            "name": "test_ham.py",
            "relpath": fix_path("./tests/x/y/z/test_ham.py"),
            "parentid": "./tests/x/y/z",
        },
    ],
    "tests": [
        ##########
        {
            "id": "./tests/test_42-43.py::test_simple",
            "name": "test_simple",
            "source": fix_path("./tests/test_42-43.py:2"),
            "markers": [],
            "parentid": "./tests/test_42-43.py",
        },
        #####
        {
            "id": "./tests/test_42.py::test_simple",
            "name": "test_simple",
            "source": fix_path("./tests/test_42.py:2"),
            "markers": [],
            "parentid": "./tests/test_42.py",
        },
        #####
        {
            "id": "./tests/test_doctest.txt::test_doctest.txt",
            "name": "test_doctest.txt",
            "source": fix_path("./tests/test_doctest.txt:1"),
            "markers": [],
            "parentid": "./tests/test_doctest.txt",
        },
        #####
        {
            "id": "./tests/test_foo.py::test_simple",
            "name": "test_simple",
            "source": fix_path("./tests/test_foo.py:3"),
            "markers": [],
            "parentid": "./tests/test_foo.py",
        },
        #####
        {
            "id": "./tests/test_mixed.py::test_top_level",
            "name": "test_top_level",
            "source": fix_path("./tests/test_mixed.py:5"),
            "markers": [],
            "parentid": "./tests/test_mixed.py",
        },
        {
            "id": "./tests/test_mixed.py::test_skipped",
            "name": "test_skipped",
            "source": fix_path("./tests/test_mixed.py:9"),
            "markers": ["skip"],
            "parentid": "./tests/test_mixed.py",
        },
        {
            "id": "./tests/test_mixed.py::TestMySuite::test_simple",
            "name": "test_simple",
            "source": fix_path("./tests/test_mixed.py:16"),
            "markers": [],
            "parentid": "./tests/test_mixed.py::TestMySuite",
        },
        {
            "id": "./tests/test_mixed.py::MyTests::test_simple",
            "name": "test_simple",
            "source": fix_path("./tests/test_mixed.py:22"),
            "markers": [],
            "parentid": "./tests/test_mixed.py::MyTests",
        },
        {
            "id": "./tests/test_mixed.py::MyTests::test_skipped",
            "name": "test_skipped",
            "source": fix_path("./tests/test_mixed.py:25"),
            "markers": ["skip"],
            "parentid": "./tests/test_mixed.py::MyTests",
        },
        #####
        {
            "id": "./tests/test_pytest.py::test_simple",
            "name": "test_simple",
            "source": fix_path("./tests/test_pytest.py:6"),
            "markers": [],
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::test_failure",
            "name": "test_failure",
            "source": fix_path("./tests/test_pytest.py:10"),
            "markers": [],
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::test_runtime_skipped",
            "name": "test_runtime_skipped",
            "source": fix_path("./tests/test_pytest.py:14"),
            "markers": [],
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::test_runtime_failed",
            "name": "test_runtime_failed",
            "source": fix_path("./tests/test_pytest.py:18"),
            "markers": [],
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::test_raises",
            "name": "test_raises",
            "source": fix_path("./tests/test_pytest.py:22"),
            "markers": [],
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::test_skipped",
            "name": "test_skipped",
            "source": fix_path("./tests/test_pytest.py:26"),
            "markers": ["skip"],
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::test_maybe_skipped",
            "name": "test_maybe_skipped",
            "source": fix_path("./tests/test_pytest.py:31"),
            "markers": ["skip-if"],
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::test_known_failure",
            "name": "test_known_failure",
            "source": fix_path("./tests/test_pytest.py:36"),
            "markers": ["expected-failure"],
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::test_warned",
            "name": "test_warned",
            "source": fix_path("./tests/test_pytest.py:41"),
            "markers": [],
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::test_custom_marker",
            "name": "test_custom_marker",
            "source": fix_path("./tests/test_pytest.py:46"),
            "markers": [],
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::test_multiple_markers",
            "name": "test_multiple_markers",
            "source": fix_path("./tests/test_pytest.py:51"),
            "markers": ["expected-failure", "skip", "skip-if"],
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::test_dynamic_1",
            "name": "test_dynamic_1",
            "source": fix_path("./tests/test_pytest.py:62"),
            "markers": [],
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::test_dynamic_2",
            "name": "test_dynamic_2",
            "source": fix_path("./tests/test_pytest.py:62"),
            "markers": [],
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::test_dynamic_3",
            "name": "test_dynamic_3",
            "source": fix_path("./tests/test_pytest.py:62"),
            "markers": [],
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::TestSpam::test_simple",
            "name": "test_simple",
            "source": fix_path("./tests/test_pytest.py:70"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::TestSpam",
        },
        {
            "id": "./tests/test_pytest.py::TestSpam::test_skipped",
            "name": "test_skipped",
            "source": fix_path("./tests/test_pytest.py:73"),
            "markers": ["skip"],
            "parentid": "./tests/test_pytest.py::TestSpam",
        },
        {
            "id": "./tests/test_pytest.py::TestSpam::TestHam::TestEggs::test_simple",
            "name": "test_simple",
            "source": fix_path("./tests/test_pytest.py:81"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::TestSpam::TestHam::TestEggs",
        },
        {
            "id": "./tests/test_pytest.py::TestEggs::test_simple",
            "name": "test_simple",
            "source": fix_path("./tests/test_pytest.py:93"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::TestEggs",
        },
        {
            "id": "./tests/test_pytest.py::test_param_01[]",
            "name": "test_param_01[]",
            "source": fix_path("./tests/test_pytest.py:103"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_01",
        },
        {
            "id": "./tests/test_pytest.py::test_param_11[x0]",
            "name": "test_param_11[x0]",
            "source": fix_path("./tests/test_pytest.py:108"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_11",
        },
        {
            "id": "./tests/test_pytest.py::test_param_13[x0]",
            "name": "test_param_13[x0]",
            "source": fix_path("./tests/test_pytest.py:113"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_13",
        },
        {
            "id": "./tests/test_pytest.py::test_param_13[x1]",
            "name": "test_param_13[x1]",
            "source": fix_path("./tests/test_pytest.py:113"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_13",
        },
        {
            "id": "./tests/test_pytest.py::test_param_13[x2]",
            "name": "test_param_13[x2]",
            "source": fix_path("./tests/test_pytest.py:113"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_13",
        },
        {
            "id": "./tests/test_pytest.py::test_param_13_repeat[x0]",
            "name": "test_param_13_repeat[x0]",
            "source": fix_path("./tests/test_pytest.py:118"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_13_repeat",
        },
        {
            "id": "./tests/test_pytest.py::test_param_13_repeat[x1]",
            "name": "test_param_13_repeat[x1]",
            "source": fix_path("./tests/test_pytest.py:118"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_13_repeat",
        },
        {
            "id": "./tests/test_pytest.py::test_param_13_repeat[x2]",
            "name": "test_param_13_repeat[x2]",
            "source": fix_path("./tests/test_pytest.py:118"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_13_repeat",
        },
        {
            "id": "./tests/test_pytest.py::test_param_33[1-1-1]",
            "name": "test_param_33[1-1-1]",
            "source": fix_path("./tests/test_pytest.py:123"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_33",
        },
        {
            "id": "./tests/test_pytest.py::test_param_33[3-4-5]",
            "name": "test_param_33[3-4-5]",
            "source": fix_path("./tests/test_pytest.py:123"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_33",
        },
        {
            "id": "./tests/test_pytest.py::test_param_33[0-0-0]",
            "name": "test_param_33[0-0-0]",
            "source": fix_path("./tests/test_pytest.py:123"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_33",
        },
        {
            "id": "./tests/test_pytest.py::test_param_33_ids[v1]",
            "name": "test_param_33_ids[v1]",
            "source": fix_path("./tests/test_pytest.py:128"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_33_ids",
        },
        {
            "id": "./tests/test_pytest.py::test_param_33_ids[v2]",
            "name": "test_param_33_ids[v2]",
            "source": fix_path("./tests/test_pytest.py:128"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_33_ids",
        },
        {
            "id": "./tests/test_pytest.py::test_param_33_ids[v3]",
            "name": "test_param_33_ids[v3]",
            "source": fix_path("./tests/test_pytest.py:128"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_33_ids",
        },
        {
            "id": "./tests/test_pytest.py::test_param_23_13[1-1-z0]",
            "name": "test_param_23_13[1-1-z0]",
            "source": fix_path("./tests/test_pytest.py:134"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_23_13",
        },
        {
            "id": "./tests/test_pytest.py::test_param_23_13[1-1-z1]",
            "name": "test_param_23_13[1-1-z1]",
            "source": fix_path("./tests/test_pytest.py:134"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_23_13",
        },
        {
            "id": "./tests/test_pytest.py::test_param_23_13[1-1-z2]",
            "name": "test_param_23_13[1-1-z2]",
            "source": fix_path("./tests/test_pytest.py:134"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_23_13",
        },
        {
            "id": "./tests/test_pytest.py::test_param_23_13[3-4-z0]",
            "name": "test_param_23_13[3-4-z0]",
            "source": fix_path("./tests/test_pytest.py:134"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_23_13",
        },
        {
            "id": "./tests/test_pytest.py::test_param_23_13[3-4-z1]",
            "name": "test_param_23_13[3-4-z1]",
            "source": fix_path("./tests/test_pytest.py:134"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_23_13",
        },
        {
            "id": "./tests/test_pytest.py::test_param_23_13[3-4-z2]",
            "name": "test_param_23_13[3-4-z2]",
            "source": fix_path("./tests/test_pytest.py:134"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_23_13",
        },
        {
            "id": "./tests/test_pytest.py::test_param_23_13[0-0-z0]",
            "name": "test_param_23_13[0-0-z0]",
            "source": fix_path("./tests/test_pytest.py:134"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_23_13",
        },
        {
            "id": "./tests/test_pytest.py::test_param_23_13[0-0-z1]",
            "name": "test_param_23_13[0-0-z1]",
            "source": fix_path("./tests/test_pytest.py:134"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_23_13",
        },
        {
            "id": "./tests/test_pytest.py::test_param_23_13[0-0-z2]",
            "name": "test_param_23_13[0-0-z2]",
            "source": fix_path("./tests/test_pytest.py:134"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_23_13",
        },
        {
            "id": "./tests/test_pytest.py::test_param_13_markers[x0]",
            "name": "test_param_13_markers[x0]",
            "source": fix_path("./tests/test_pytest.py:140"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_13_markers",
        },
        {
            "id": "./tests/test_pytest.py::test_param_13_markers[???]",
            "name": "test_param_13_markers[???]",
            "source": fix_path("./tests/test_pytest.py:140"),
            "markers": ["skip"],
            "parentid": "./tests/test_pytest.py::test_param_13_markers",
        },
        {
            "id": "./tests/test_pytest.py::test_param_13_markers[2]",
            "name": "test_param_13_markers[2]",
            "source": fix_path("./tests/test_pytest.py:140"),
            "markers": ["expected-failure"],
            "parentid": "./tests/test_pytest.py::test_param_13_markers",
        },
        {
            "id": "./tests/test_pytest.py::test_param_13_skipped[x0]",
            "name": "test_param_13_skipped[x0]",
            "source": fix_path("./tests/test_pytest.py:149"),
            "markers": ["skip"],
            "parentid": "./tests/test_pytest.py::test_param_13_skipped",
        },
        {
            "id": "./tests/test_pytest.py::test_param_13_skipped[x1]",
            "name": "test_param_13_skipped[x1]",
            "source": fix_path("./tests/test_pytest.py:149"),
            "markers": ["skip"],
            "parentid": "./tests/test_pytest.py::test_param_13_skipped",
        },
        {
            "id": "./tests/test_pytest.py::test_param_13_skipped[x2]",
            "name": "test_param_13_skipped[x2]",
            "source": fix_path("./tests/test_pytest.py:149"),
            "markers": ["skip"],
            "parentid": "./tests/test_pytest.py::test_param_13_skipped",
        },
        {
            "id": "./tests/test_pytest.py::test_param_23_raises[1-None]",
            "name": "test_param_23_raises[1-None]",
            "source": fix_path("./tests/test_pytest.py:155"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_23_raises",
        },
        {
            "id": "./tests/test_pytest.py::test_param_23_raises[1.0-None]",
            "name": "test_param_23_raises[1.0-None]",
            "source": fix_path("./tests/test_pytest.py:155"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_23_raises",
        },
        {
            "id": "./tests/test_pytest.py::test_param_23_raises[2-catch2]",
            "name": "test_param_23_raises[2-catch2]",
            "source": fix_path("./tests/test_pytest.py:155"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_23_raises",
        },
        {
            "id": "./tests/test_pytest.py::TestParam::test_simple",
            "name": "test_simple",
            "source": fix_path("./tests/test_pytest.py:164"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::TestParam",
        },
        {
            "id": "./tests/test_pytest.py::TestParam::test_param_13[x0]",
            "name": "test_param_13[x0]",
            "source": fix_path("./tests/test_pytest.py:167"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::TestParam::test_param_13",
        },
        {
            "id": "./tests/test_pytest.py::TestParam::test_param_13[x1]",
            "name": "test_param_13[x1]",
            "source": fix_path("./tests/test_pytest.py:167"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::TestParam::test_param_13",
        },
        {
            "id": "./tests/test_pytest.py::TestParam::test_param_13[x2]",
            "name": "test_param_13[x2]",
            "source": fix_path("./tests/test_pytest.py:167"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::TestParam::test_param_13",
        },
        {
            "id": "./tests/test_pytest.py::TestParamAll::test_param_13[x0]",
            "name": "test_param_13[x0]",
            "source": fix_path("./tests/test_pytest.py:175"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::TestParamAll::test_param_13",
        },
        {
            "id": "./tests/test_pytest.py::TestParamAll::test_param_13[x1]",
            "name": "test_param_13[x1]",
            "source": fix_path("./tests/test_pytest.py:175"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::TestParamAll::test_param_13",
        },
        {
            "id": "./tests/test_pytest.py::TestParamAll::test_param_13[x2]",
            "name": "test_param_13[x2]",
            "source": fix_path("./tests/test_pytest.py:175"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::TestParamAll::test_param_13",
        },
        {
            "id": "./tests/test_pytest.py::TestParamAll::test_spam_13[x0]",
            "name": "test_spam_13[x0]",
            "source": fix_path("./tests/test_pytest.py:178"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::TestParamAll::test_spam_13",
        },
        {
            "id": "./tests/test_pytest.py::TestParamAll::test_spam_13[x1]",
            "name": "test_spam_13[x1]",
            "source": fix_path("./tests/test_pytest.py:178"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::TestParamAll::test_spam_13",
        },
        {
            "id": "./tests/test_pytest.py::TestParamAll::test_spam_13[x2]",
            "name": "test_spam_13[x2]",
            "source": fix_path("./tests/test_pytest.py:178"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::TestParamAll::test_spam_13",
        },
        {
            "id": "./tests/test_pytest.py::test_fixture",
            "name": "test_fixture",
            "source": fix_path("./tests/test_pytest.py:192"),
            "markers": [],
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::test_mark_fixture",
            "name": "test_mark_fixture",
            "source": fix_path("./tests/test_pytest.py:196"),
            "markers": [],
            "parentid": "./tests/test_pytest.py",
        },
        {
            "id": "./tests/test_pytest.py::test_param_fixture[x0]",
            "name": "test_param_fixture[x0]",
            "source": fix_path("./tests/test_pytest.py:201"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_fixture",
        },
        {
            "id": "./tests/test_pytest.py::test_param_fixture[x1]",
            "name": "test_param_fixture[x1]",
            "source": fix_path("./tests/test_pytest.py:201"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_fixture",
        },
        {
            "id": "./tests/test_pytest.py::test_param_fixture[x2]",
            "name": "test_param_fixture[x2]",
            "source": fix_path("./tests/test_pytest.py:201"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_fixture",
        },
        {
            "id": "./tests/test_pytest.py::test_param_mark_fixture[x0]",
            "name": "test_param_mark_fixture[x0]",
            "source": fix_path("./tests/test_pytest.py:207"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_mark_fixture",
        },
        {
            "id": "./tests/test_pytest.py::test_param_mark_fixture[x1]",
            "name": "test_param_mark_fixture[x1]",
            "source": fix_path("./tests/test_pytest.py:207"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_mark_fixture",
        },
        {
            "id": "./tests/test_pytest.py::test_param_mark_fixture[x2]",
            "name": "test_param_mark_fixture[x2]",
            "source": fix_path("./tests/test_pytest.py:207"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_param_mark_fixture",
        },
        {
            "id": "./tests/test_pytest.py::test_fixture_param[spam]",
            "name": "test_fixture_param[spam]",
            "source": fix_path("./tests/test_pytest.py:216"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_fixture_param",
        },
        {
            "id": "./tests/test_pytest.py::test_fixture_param[eggs]",
            "name": "test_fixture_param[eggs]",
            "source": fix_path("./tests/test_pytest.py:216"),
            "markers": [],
            "parentid": "./tests/test_pytest.py::test_fixture_param",
        },
        ######
        {
            "id": "./tests/test_pytest_param.py::test_param_13[x0]",
            "name": "test_param_13[x0]",
            "source": fix_path("./tests/test_pytest_param.py:8"),
            "markers": [],
            "parentid": "./tests/test_pytest_param.py::test_param_13",
        },
        {
            "id": "./tests/test_pytest_param.py::test_param_13[x1]",
            "name": "test_param_13[x1]",
            "source": fix_path("./tests/test_pytest_param.py:8"),
            "markers": [],
            "parentid": "./tests/test_pytest_param.py::test_param_13",
        },
        {
            "id": "./tests/test_pytest_param.py::test_param_13[x2]",
            "name": "test_param_13[x2]",
            "source": fix_path("./tests/test_pytest_param.py:8"),
            "markers": [],
            "parentid": "./tests/test_pytest_param.py::test_param_13",
        },
        {
            "id": "./tests/test_pytest_param.py::TestParamAll::test_param_13[x0]",
            "name": "test_param_13[x0]",
            "source": fix_path("./tests/test_pytest_param.py:14"),
            "markers": [],
            "parentid": "./tests/test_pytest_param.py::TestParamAll::test_param_13",
        },
        {
            "id": "./tests/test_pytest_param.py::TestParamAll::test_param_13[x1]",
            "name": "test_param_13[x1]",
            "source": fix_path("./tests/test_pytest_param.py:14"),
            "markers": [],
            "parentid": "./tests/test_pytest_param.py::TestParamAll::test_param_13",
        },
        {
            "id": "./tests/test_pytest_param.py::TestParamAll::test_param_13[x2]",
            "name": "test_param_13[x2]",
            "source": fix_path("./tests/test_pytest_param.py:14"),
            "markers": [],
            "parentid": "./tests/test_pytest_param.py::TestParamAll::test_param_13",
        },
        {
            "id": "./tests/test_pytest_param.py::TestParamAll::test_spam_13[x0]",
            "name": "test_spam_13[x0]",
            "source": fix_path("./tests/test_pytest_param.py:17"),
            "markers": [],
            "parentid": "./tests/test_pytest_param.py::TestParamAll::test_spam_13",
        },
        {
            "id": "./tests/test_pytest_param.py::TestParamAll::test_spam_13[x1]",
            "name": "test_spam_13[x1]",
            "source": fix_path("./tests/test_pytest_param.py:17"),
            "markers": [],
            "parentid": "./tests/test_pytest_param.py::TestParamAll::test_spam_13",
        },
        {
            "id": "./tests/test_pytest_param.py::TestParamAll::test_spam_13[x2]",
            "name": "test_spam_13[x2]",
            "source": fix_path("./tests/test_pytest_param.py:17"),
            "markers": [],
            "parentid": "./tests/test_pytest_param.py::TestParamAll::test_spam_13",
        },
        ######
        {
            "id": "./tests/test_unittest.py::MyTests::test_dynamic_",
            "name": "test_dynamic_",
            "source": fix_path("./tests/test_unittest.py:54"),
            "markers": [],
            "parentid": "./tests/test_unittest.py::MyTests",
        },
        {
            "id": "./tests/test_unittest.py::MyTests::test_failure",
            "name": "test_failure",
            "source": fix_path("./tests/test_unittest.py:34"),
            "markers": [],
            "parentid": "./tests/test_unittest.py::MyTests",
        },
        {
            "id": "./tests/test_unittest.py::MyTests::test_known_failure",
            "name": "test_known_failure",
            "source": fix_path("./tests/test_unittest.py:37"),
            "markers": [],
            "parentid": "./tests/test_unittest.py::MyTests",
        },
        {
            "id": "./tests/test_unittest.py::MyTests::test_maybe_not_skipped",
            "name": "test_maybe_not_skipped",
            "source": fix_path("./tests/test_unittest.py:17"),
            "markers": [],
            "parentid": "./tests/test_unittest.py::MyTests",
        },
        {
            "id": "./tests/test_unittest.py::MyTests::test_maybe_skipped",
            "name": "test_maybe_skipped",
            "source": fix_path("./tests/test_unittest.py:13"),
            "markers": [],
            "parentid": "./tests/test_unittest.py::MyTests",
        },
        {
            "id": "./tests/test_unittest.py::MyTests::test_simple",
            "name": "test_simple",
            "source": fix_path("./tests/test_unittest.py:6"),
            "markers": [],
            "parentid": "./tests/test_unittest.py::MyTests",
        },
        {
            "id": "./tests/test_unittest.py::MyTests::test_skipped",
            "name": "test_skipped",
            "source": fix_path("./tests/test_unittest.py:9"),
            "markers": [],
            "parentid": "./tests/test_unittest.py::MyTests",
        },
        {
            "id": "./tests/test_unittest.py::MyTests::test_skipped_inside",
            "name": "test_skipped_inside",
            "source": fix_path("./tests/test_unittest.py:21"),
            "markers": [],
            "parentid": "./tests/test_unittest.py::MyTests",
        },
        {
            "id": "./tests/test_unittest.py::MyTests::test_with_nested_subtests",
            "name": "test_with_nested_subtests",
            "source": fix_path("./tests/test_unittest.py:46"),
            "markers": [],
            "parentid": "./tests/test_unittest.py::MyTests",
        },
        {
            "id": "./tests/test_unittest.py::MyTests::test_with_subtests",
            "name": "test_with_subtests",
            "source": fix_path("./tests/test_unittest.py:41"),
            "markers": [],
            "parentid": "./tests/test_unittest.py::MyTests",
        },
        {
            "id": "./tests/test_unittest.py::OtherTests::test_simple",
            "name": "test_simple",
            "source": fix_path("./tests/test_unittest.py:61"),
            "markers": [],
            "parentid": "./tests/test_unittest.py::OtherTests",
        },
        ###########
        {
            "id": "./tests/v/test_eggs.py::test_simple",
            "name": "test_simple",
            "source": fix_path("./tests/v/spam.py:2"),
            "markers": [],
            "parentid": "./tests/v/test_eggs.py",
        },
        {
            "id": "./tests/v/test_eggs.py::TestSimple::test_simple",
            "name": "test_simple",
            "source": fix_path("./tests/v/spam.py:8"),
            "markers": [],
            "parentid": "./tests/v/test_eggs.py::TestSimple",
        },
        ######
        {
            "id": "./tests/v/test_ham.py::test_simple",
            "name": "test_simple",
            "source": fix_path("./tests/v/spam.py:2"),
            "markers": [],
            "parentid": "./tests/v/test_ham.py",
        },
        {
            "id": "./tests/v/test_ham.py::test_not_hard",
            "name": "test_not_hard",
            "source": fix_path("./tests/v/spam.py:2"),
            "markers": [],
            "parentid": "./tests/v/test_ham.py",
        },
        ######
        {
            "id": "./tests/v/test_spam.py::test_simple",
            "name": "test_simple",
            "source": fix_path("./tests/v/spam.py:2"),
            "markers": [],
            "parentid": "./tests/v/test_spam.py",
        },
        {
            "id": "./tests/v/test_spam.py::test_simpler",
            "name": "test_simpler",
            "source": fix_path("./tests/v/test_spam.py:4"),
            "markers": [],
            "parentid": "./tests/v/test_spam.py",
        },
        ###########
        {
            "id": "./tests/w/test_spam.py::test_simple",
            "name": "test_simple",
            "source": fix_path("./tests/w/test_spam.py:4"),
            "markers": [],
            "parentid": "./tests/w/test_spam.py",
        },
        {
            "id": "./tests/w/test_spam_ex.py::test_simple",
            "name": "test_simple",
            "source": fix_path("./tests/w/test_spam_ex.py:4"),
            "markers": [],
            "parentid": "./tests/w/test_spam_ex.py",
        },
        ###########
        {
            "id": "./tests/x/y/z/test_ham.py::test_simple",
            "name": "test_simple",
            "source": fix_path("./tests/x/y/z/test_ham.py:2"),
            "markers": [],
            "parentid": "./tests/x/y/z/test_ham.py",
        },
        ######
        {
            "id": "./tests/x/y/z/a/test_spam.py::test_simple",
            "name": "test_simple",
            "source": fix_path("./tests/x/y/z/a/test_spam.py:11"),
            "markers": [],
            "parentid": "./tests/x/y/z/a/test_spam.py",
        },
        {
            "id": "./tests/x/y/z/b/test_spam.py::test_simple",
            "name": "test_simple",
            "source": fix_path("./tests/x/y/z/b/test_spam.py:7"),
            "markers": [],
            "parentid": "./tests/x/y/z/b/test_spam.py",
        },
    ],
}

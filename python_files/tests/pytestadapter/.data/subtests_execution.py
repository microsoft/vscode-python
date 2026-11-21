# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
import unittest

import pytest


# Each subtest reports with its parent's node id, so the parent must fail if any subtest fails,
# no matter which subtest reports first.
def test_pass_then_fail(subtests):
    with subtests.test("passes"):
        assert True
    with subtests.test("fails"):
        assert 1 == 2


def test_fail_then_pass(subtests):
    with subtests.test("fails"):
        assert 1 == 2
    with subtests.test("passes"):
        assert True


def test_all_pass(subtests):
    with subtests.test("first"):
        assert True
    with subtests.test("second"):
        assert True


def test_pass_then_body_fails(subtests):
    with subtests.test("passes"):
        assert True
    pytest.fail("the test body fails after its subtests")


class TestUnittestSubTest(unittest.TestCase):
    def test_pass_then_fail(self):
        with self.subTest(i=0):
            self.assertEqual(1, 1)
        with self.subTest(i=1):
            self.assertEqual(1, 2)

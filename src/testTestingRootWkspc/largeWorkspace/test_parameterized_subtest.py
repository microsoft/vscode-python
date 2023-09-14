# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
import pytest
import unittest


@pytest.mark.parametrize("num", range(0, 2000))
def test_odd_even(num):
    assert num % 2 == 0


class NumbersTest(unittest.TestCase):
    def test_even(self):
        for i in range(0, 2000):
            with self.subTest(i=i):
                self.assertEqual(i % 2, 0)

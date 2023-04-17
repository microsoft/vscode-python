# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
import unittest


def add(a, b):
    return a + b


class TestAddFunction(unittest.TestCase):
    # This test's id is unittest_folder/test_add.py::TestAddFunction::test_add_positive_numbers.
    # This test passes.
    def test_add_positive_numbers(self):  # test_marker--test_add_positive_numbers
        result = add(2, 3)
        self.assertEqual(result, 5)

    # This test's id is unittest_folder/test_add.py::TestAddFunction::test_add_negative_numbers.
    # This test passes.
    def test_add_negative_numbers(self):  # test_marker--test_add_negative_numbers
        result = add(-2, -3)
        self.assertEqual(result, -5)

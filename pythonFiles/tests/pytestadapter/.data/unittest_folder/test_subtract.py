# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
import unittest


def subtract(a, b):
    return a - b


class TestSubtractFunction(unittest.TestCase):
    # This test's id is unittest_folder/test_subtract.py::TestSubtractFunction::test_subtract_positive_numbers.
    # This test passes.
    def test_subtract_positive_numbers(  # test_marker--test_subtract_positive_numbers
        self,
    ):
        result = subtract(5, 3)
        self.assertEqual(result, 2)

    # This test's id is unittest_folder/test_subtract.py::TestSubtractFunction::test_subtract_negative_numbers.
    # This test passes.
    def test_subtract_negative_numbers(  # test_marker--test_subtract_negative_numbers
        self,
    ):
        result = subtract(-2, -3)
        self.assertEqual(result, 1)

# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import unittest


class TreeThreeFileOne(unittest.TestCase):
    """
    Test class for the test_build_error_tree test.
    build_test_tree should build a test tree with the valid test cases,
    and return error messages for the failed discovered tests.
    """

    def test_one(self) -> None:
        self.assertGreater(2, 1)

    def test_two(self) -> None:
        self.assertNotEqual(2, 1)

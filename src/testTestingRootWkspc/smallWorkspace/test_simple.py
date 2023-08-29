# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
import unittest


def test_a():
    assert 1 == 1


class SimpleClass(unittest.TestCase):
    def test_simple_unit(self):
        assert True

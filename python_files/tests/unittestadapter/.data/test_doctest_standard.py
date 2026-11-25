# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
"""Test file with standard doctest integration that should be blocked."""

import unittest
import doctest
import doctest_standard


def load_tests(loader, tests, ignore):
    """
    Standard hook for unittest to load tests.
    This uses standard doctest without any patching.
    """
    tests.addTests(doctest.DocTestSuite(doctest_standard))
    return tests

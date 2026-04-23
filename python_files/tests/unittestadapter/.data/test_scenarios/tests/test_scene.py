# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import unittest

from testscenarios import TestWithScenarios, generate_scenarios


def load_tests(loader, standard_tests, pattern):  # noqa: ARG001
    # Pre-expand ``TestWithScenarios`` scenarios at load time so individual
    # scenario-multiplied test IDs (e.g. ``test_operations(add)``) can be
    # resolved by ``unittest.TestLoader.loadTestsFromName``. Without this,
    # ``TestWithScenarios`` only multiplies scenarios at ``run()`` time and
    # loading a specific scenario by name raises ``AttributeError``.
    result = unittest.TestSuite()
    result.addTests(generate_scenarios(standard_tests))
    return result


class TestMathOperations(TestWithScenarios):
    scenarios = [
        ('add', {'test_id': 'test_add', 'a': 5, 'b': 3, 'expected': 8}),
        ('subtract', {'test_id': 'test_subtract', 'a': 5, 'b': 3, 'expected': 2}),
        ('multiply', {'test_id': 'test_multiply', 'a': 5, 'b': 3, 'expected': 15}),
    ]
    a: int = 0
    b: int = 0
    expected: int = 0
    test_id: str = ""

    def test_operations(self):
        result = None
        if self.test_id == 'test_add':
            result = self.a + self.b
        elif self.test_id == 'test_subtract':
            result = self.a - self.b
        elif self.test_id == 'test_multiply':
            result = self.a * self.b
        self.assertEqual(result, self.expected)

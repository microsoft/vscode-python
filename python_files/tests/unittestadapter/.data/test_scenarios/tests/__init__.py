# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

from testscenarios import generate_scenarios


def load_tests(loader, tests, pattern):  # noqa: ARG001
    # Pre-expand TestWithScenarios scenarios at load time so individual
    # scenario-multiplied test IDs (e.g. ``test_operations(add)``) can be
    # resolved by ``unittest.TestLoader.loadTestsFromName``. Without this,
    # ``TestWithScenarios`` only multiplies scenarios at ``run()`` time and
    # loading a specific scenario by name raises ``AttributeError``.
    import unittest

    result = unittest.TestSuite()
    result.addTests(generate_scenarios(tests))
    return result

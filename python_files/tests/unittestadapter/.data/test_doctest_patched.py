# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
"""Test file with patched doctest integration that should work."""

import unittest
import doctest
import sys
import doctest_patched_module


# Patch DocTestCase to modify test IDs to be compatible with the extension
original_init = doctest.DocTestCase.__init__


def patched_init(self, test, optionflags=0, setUp=None, tearDown=None, checker=None):
    """Patch to modify doctest names to have proper hierarchy."""
    if hasattr(test, 'name'):
        # Get module name
        module_hierarchy = test.name.split('.')
        module_name = module_hierarchy[0] if module_hierarchy else 'unknown'

        # Reconstruct with proper formatting to have enough components
        # Format: module.file.class.function
        if test.filename.endswith('.py'):
            file_base = test.filename.split('/')[-1].replace('.py', '')
            test_name = test.name.split('.')[-1] if '.' in test.name else test.name
            # Create a properly formatted ID with enough components
            test.name = f"{module_name}.{file_base}._DocTests.{test_name}"

    # Call original init
    original_init(self, test, optionflags, setUp, tearDown, checker)


# Apply the patch
doctest.DocTestCase.__init__ = patched_init


def load_tests(loader, tests, ignore):
    """
    Standard hook for unittest to load tests.
    This uses patched doctest to create compatible test IDs.
    """
    tests.addTests(doctest.DocTestSuite(doctest_patched_module))
    return tests


# Clean up the patch after loading
def tearDownModule():
    """Restore original DocTestCase.__init__"""
    doctest.DocTestCase.__init__ = original_init

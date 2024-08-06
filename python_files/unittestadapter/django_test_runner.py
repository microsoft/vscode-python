# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import os
import pathlib
import sys
from unittest import TestSuite, TextTestResult

from django.test.runner import DiscoverRunner
# from execution import UnittestTestResult

script_dir = pathlib.Path(__file__).parent
sys.path.append(os.fspath(script_dir))

print("HELLO!!!")


class CustomTestRunner(DiscoverRunner):
    def get_test_runner_kwargs(self):
        print("get_test_runner_kwargs")
        kwargs = super().get_test_runner_kwargs()
        if kwargs["resultclass"] is not None:
            raise ValueError(
                "Resultclass already set, cannot use custom test runner design for VS Code compatibility."
            )
        # kwargs["resultclass"] = UnittestTestResult
        return kwargs

    def build_suite(self, test_labels, extra_tests=None, **kwargs):
        print("build_suite")
        suite = super().build_suite(test_labels)
        return suite

    def run_suite(self, suite: TestSuite, **kwargs) -> TextTestResult:
        print("EJFB HELLO!!!")
        return super().run_suite(suite, **kwargs)


# import unittest
# from django.test.runner import DiscoverRunner


# class CustomTestRunner(DiscoverRunner):
#     def run_tests(self, test_labels, extra_tests=None, **kwargs):
#         try:
#             # Set up the test environment
#             print("Setting up test environment...")
#             self.setup_test_environment()

#             # Set up the test databases
#             print("Setting up test databases...")
#             old_config = self.setup_databases()

#             # Call the default build_suite method to create the test suite
#             print("Building test suite...")
#             print(f"test_labels: {test_labels}")
#             print(f"extra_tests: {extra_tests}")
#             suite = self.build_suite(test_labels)

#             # Print out the test suite
#             test_names = [str(test) for test in suite]
#             for name in sorted(test_names):
#                 print(name)

#             # Run the tests normally
#             print("Running tests...")
#             result = self.test_runner(verbosity=self.verbosity).run(suite)

#             # Tear down the test databases
#             print("Tearing down test databases...")
#             self.teardown_databases(old_config)

#             # Tear down the test environment
#             print("Tearing down test environment...")
#             self.teardown_test_environment()

#             return self.suite_result(suite, result)
#         except Exception as e:
#             print(f"Error running tests: {e}")
#             raise

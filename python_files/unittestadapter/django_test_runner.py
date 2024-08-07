# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import os
import pathlib
import sys
from unittest import TestSuite, TextTestResult
import unittest

from django.test.runner import DiscoverRunner


# from execution import UnittestTestResult

script_dir = pathlib.Path(__file__).parent.parent
sys.path.append(os.fspath(script_dir))
from pvsc_utils import (
    DiscoveryPayloadDict,
    EOTPayloadDict,
    VSCodeUnittestError,
    build_test_tree,
    send_post_request,
)
from execution import UnittestTestResult


print("HELLO!!!")


class CustomDiscoveryTestRunner(DiscoverRunner):
    # def get_test_runner_kwargs(self):
    #     print("get_test_runner_kwargs")
    #     kwargs = super().get_test_runner_kwargs()
    #     if kwargs["resultclass"] is not None:
    #         raise ValueError(
    #             "Resultclass already set, cannot use custom test runner design for VS Code compatibility."
    #         )
    #     # kwargs["resultclass"] = UnittestTestResult
    #     return kwargs

    # def build_suite(self, test_labels, extra_tests=None, **kwargs):
    #     print("build_suite")
    #     suite = super().build_suite(test_labels)
    #     return suite

    # def run_suite(self, suite: TestSuite, **kwargs) -> TextTestResult:
    #     print("EJFB HELLO!!!")
    #     return super().run_suite(suite, **kwargs)

    def run_tests(self, test_labels, **kwargs):
        try:
            print("Running tests...")
            print("test labels: ", test_labels)
            print("kwargs: ", kwargs)
            suite: unittest.TestSuite = self.build_suite(test_labels, **kwargs)
            test_names = [str(test) for test in suite]
            for name in sorted(test_names):
                print(name)

            # # If the top level directory is not provided, then use the start directory.
            # if top_level_dir is None:
            #     top_level_dir = start_dir
            cwd = pathlib.Path.cwd()
            # Get abspath of top level directory for build_test_tree.
            top_level_dir = os.path.abspath(cwd)  # noqa: PTH100

            payload: DiscoveryPayloadDict = {
                "cwd": os.fspath(cwd),
                "status": "success",
                "tests": None,
            }

            tests, error = build_test_tree(
                suite, top_level_dir
            )  # test tree built successfully here.

            payload["tests"] = tests if tests is not None else None  # or overloading

            if len(error):
                payload["status"] = "error"
                payload["error"] = error

            test_run_pipe = os.getenv("TEST_RUN_PIPE")
            if not test_run_pipe:
                error_msg = (
                    "UNITTEST ERROR: TEST_RUN_PIPE is not set at the time of unittest trying to send data. "
                    "Please confirm this environment variable is not being changed or removed "
                    "as it is required for successful test discovery and execution."
                    f"TEST_RUN_PIPE = {test_run_pipe}\n"
                )
                print(error_msg, file=sys.stderr)
                raise VSCodeUnittestError(error_msg)
            send_post_request(payload, test_run_pipe)
            # Post EOT token.
            eot_payload: EOTPayloadDict = {"command_type": "discovery", "eot": True}
            send_post_request(eot_payload, test_run_pipe)

            return 0  # Skip actual test execution for now
        except Exception as e:
            print(f"Error running tests: {e}")
            raise


class CustomExecutionTestRunner(DiscoverRunner):
    def get_test_runner_kwargs(self):
        """Override to provide custom test runner kwargs, such as resultclass."""
        # Get existing kwargs
        kwargs = super().get_test_runner_kwargs()
        # Add custom resultclass
        kwargs["resultclass"] = UnittestTestResult
        return kwargs

    def get_test_runner(self):
        return unittest.TextTestRunner(resultclass=UnittestTestResult)

    def run_tests(self, test_labels, **kwargs):
        print("Running tests...")
        print("test labels:", test_labels)
        print("kwargs: ", kwargs)
        result = super().run_tests(test_labels, **kwargs)
        return result

    def addSuccess(self, test):
        print("add success??")
        super().addSuccess(test)
        self.successes.append(test)

    def suite_result(self, suite, result, **kwargs):
        # send ending here
        test_run_pipe = os.getenv("TEST_RUN_PIPE")
        if not test_run_pipe:
            print("Error[vscode-unittest]: TEST_RUN_PIPE env var is not set.")
            raise VSCodeUnittestError("Error[vscode-unittest]: TEST_RUN_PIPE env var is not set.")
        eot_payload: EOTPayloadDict = {"command_type": "execution", "eot": True}
        send_post_request(eot_payload, test_run_pipe)
        print("suite_result")
        print("suite: ", suite)
        print("result: ", result)
        return super().suite_result(suite, result, **kwargs)

    # def run_tests(self, test_labels, **kwargs):
    #     suite: unittest.TestSuite = self.build_suite(test_labels, **kwargs)
    #     super().run_suite(suite, **kwargs)
    #     try:
    #         print("Running tests...")
    #         print("test labels: ", test_labels)
    #         print("kwargs: ", kwargs)
    #         suite: unittest.TestSuite = self.build_suite(test_labels, **kwargs)
    #         test_names = [str(test) for test in suite]
    #         for name in sorted(test_names):
    #             print(name)

    #         # # If the top level directory is not provided, then use the start directory.
    #         # if top_level_dir is None:
    #         #     top_level_dir = start_dir
    #         cwd = pathlib.Path.cwd()
    #         # Get abspath of top level directory for build_test_tree.
    #         top_level_dir = os.path.abspath(cwd)  # noqa: PTH100

    #         payload: DiscoveryPayloadDict = {
    #             "cwd": os.fspath(cwd),
    #             "status": "success",
    #             "tests": None,
    #         }

    #         tests, error = build_test_tree(
    #             suite, top_level_dir
    #         )  # test tree built successfully here.

    #         payload["tests"] = tests if tests is not None else None

    #         if len(error):
    #             payload["status"] = "error"
    #             payload["error"] = error

    #         test_run_pipe = os.getenv("TEST_RUN_PIPE")
    #         if not test_run_pipe:
    #             error_msg = (
    #                 "UNITTEST ERROR: TEST_RUN_PIPE is not set at the time of unittest trying to send data. "
    #                 "Please confirm this environment variable is not being changed or removed "
    #                 "as it is required for successful test discovery and execution."
    #                 f"TEST_RUN_PIPE = {test_run_pipe}\n"
    #             )
    #             print(error_msg, file=sys.stderr)
    #             raise VSCodeUnittestError(error_msg)
    #         send_post_request(payload, test_run_pipe)
    #         # Post EOT token.
    #         eot_payload: EOTPayloadDict = {"command_type": "discovery", "eot": True}
    #         send_post_request(eot_payload, test_run_pipe)

    #         return 0  # Skip actual test execution for now
    #     except Exception as e:
    #         print(f"Error running tests: {e}")
    #         raise

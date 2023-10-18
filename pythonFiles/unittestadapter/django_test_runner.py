from django.test.runner import DiscoverRunner
import sys
import os
import pathlib

script_dir = pathlib.Path(__file__).parent
sys.path.append(os.fspath(script_dir))

from execution import UnittestTestResult


class CustomTestRunner(DiscoverRunner):
    def get_test_runner_kwargs(self):
        print("get_test_runner_kwargs")
        kwargs = super().get_test_runner_kwargs()
        if kwargs["resultclass"] is not None:
            raise ValueError(
                "Resultclass already set, cannot use custom test runner design for VS Code compatibility."
            )
        kwargs["resultclass"] = UnittestTestResult
        return kwargs

# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.
import importlib.util
import os
import pathlib
import sys
import sysconfig

import pytest

# Adds the scripts directory to the PATH as a workaround for enabling shell for test execution.
path_var_name = "PATH" if "PATH" in os.environ else "Path"
os.environ[path_var_name] = (
    sysconfig.get_paths()["scripts"] + os.pathsep + os.environ[path_var_name]
)

script_dir = pathlib.Path(__file__).parent.parent
sys.path.append(os.fspath(script_dir))
sys.path.append(os.fspath(script_dir / "lib" / "python"))


class CoverageSavePlugin:
    """Stop and save coverage before the VS Code plugin reports it."""

    def __init__(self, cov):
        self._coverage = cov

    @pytest.hookimpl(tryfirst=True)
    def pytest_sessionfinish(self, session, exitstatus):  # noqa: ARG002
        self._coverage.stop()
        self._coverage.save()


def has_coverage_arg(args):
    return any(arg == "--cov" or "--cov=" in arg for arg in args)


def configure_coverage(args):
    """Configure coverage for a VS Code coverage run."""
    if os.environ.get("COVERAGE_ENABLED") != "True" or has_coverage_arg(args):
        return args, None

    if importlib.util.find_spec("pytest_cov") is not None:
        return [*args, "--cov=.", "--cov-branch"], None

    import coverage

    cov = coverage.Coverage()
    cov.start()
    return args, CoverageSavePlugin(cov)


def run_pytest(args, test_ids=None, coverage_plugin=None):
    arg_array = ["-p", "vscode_pytest", *args]
    if test_ids:
        arg_array.extend(test_ids)
    plugins = [coverage_plugin] if coverage_plugin else None
    pytest.main(arg_array, plugins=plugins)


# This script handles running pytest via pytest.main(). It is called via run in the
# pytest execution adapter and gets the test_ids to run via stdin and the rest of the
# args through sys.argv. It then runs pytest.main() with the args and test_ids.

if __name__ == "__main__":
    # Add the root directory to the path so that we can import the plugin.
    directory_path = pathlib.Path(__file__).parent.parent
    sys.path.append(os.fspath(directory_path))
    sys.path.insert(0, os.getcwd())  # noqa: PTH109
    # Get the rest of the args to run with pytest.
    args = sys.argv[1:]

    args, coverage_plugin = configure_coverage(args)

    run_test_ids_pipe = os.environ.get("RUN_TEST_IDS_PIPE")
    if run_test_ids_pipe:
        ids_path = pathlib.Path(run_test_ids_pipe)
        try:
            # Read the test ids from the file and run pytest.
            ids = ids_path.read_text(encoding="utf-8").splitlines()
        except Exception as e:
            print("Error[vscode-pytest]: unable to read testIds from temp file" + str(e))
            run_pytest(args, coverage_plugin=coverage_plugin)
        else:
            print("Running pytest with args: " + str(["-p", "vscode_pytest", *args, *ids]))
            run_pytest(args, ids, coverage_plugin)
        finally:
            # Delete the test ids temp file.
            try:
                ids_path.unlink()
            except Exception as e:
                print("Error[vscode-pytest]: unable to delete temp file" + str(e))
    else:
        print("Error[vscode-pytest]: RUN_TEST_IDS_PIPE env var is not set.")
        run_pytest(args, coverage_plugin=coverage_plugin)

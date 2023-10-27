import subprocess
import os
import pathlib
import sys
from typing import Union

from pythonFiles.unittestadapter.execution import VSCodeUnittestError


def django_execution_runner(start_dir: Union[str, None]):
    # Get path to manage.py if set as an env var, otherwise use the default
    manage_py_path = os.environ.get("MANAGE_PY_PATH")

    if manage_py_path is None:
        # Search for default manage.py path at the root of the workspace
        if not start_dir:
            print(
                "Error running Django, no start_dir provided or value for MANAGE_PY_PATH"
            )

        cwd = os.path.abspath(start_dir)
        manage_py_path = os.path.join(cwd, "manage.py")

    try:
        # Get path to the custom_test_runner.py parent folder, add to sys.path.
        custom_test_runner_dir = pathlib.Path(__file__).parent
        sys.path.insert(0, custom_test_runner_dir)
        custom_test_runner = "django_test_runner.CustomTestRunner"

        # Build command to run 'python manage.py test'.
        python_executable = sys.executable
        command = [
            python_executable,
            "manage.py",
            "test",
            "--testrunner",
            custom_test_runner,
        ]
        print("Running Django run tests with command: ", command)
        try:
            subprocess.run(" ".join(command), shell=True, check=True)
        except subprocess.CalledProcessError as e:
            print(f"Error running 'manage.py test': {e}")
            raise VSCodeUnittestError(f"Error running 'manage.py test': {e}")
    except Exception as e:
        print(f"Error configuring Django test runner: {e}")
        raise VSCodeUnittestError(f"Error configuring Django test runner: {e}")

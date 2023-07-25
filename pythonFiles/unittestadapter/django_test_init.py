"""
This module sets up a Django environment to run Django tests.
"""

import os
import re
import sys


def setup_django_test_env(workspace_directory="."):
    """Configures the Django environment for running Django tests.

    If Django is not installed, workspace_directory is not in sys.path or
    manage.py can not be found inside the given workspace_directory, the function fails quietly.

    Args:
        workspace_directory (str): The current workspace directory that is expected to contain manage.py module

    Returns:
        None
    """

    # To avoid false positive ModuleNotFoundError from django.setup() due to missing current workspace in sys.path
    sys.path.insert(0, os.getcwd())

    try:
        import django
    except ImportError:
        return

    manage_py_module = os.path.join(workspace_directory, "manage.py")
    if not os.path.exists(manage_py_module):
        return

    dj_settings_module = None

    with open(manage_py_module, "r") as manage_py:
        pattern = r"^os\.environ\.setdefault\((\'|\")DJANGO_SETTINGS_MODULE(\'|\"), (\'|\")(?P<settings_path>[\w.]+)(\'|\")\)$"
        for line in manage_py.readlines():
            match_result = re.match(pattern, line.strip())
            if match_result is not None:
                dj_settings_module = match_result.groupdict().get("settings_path", None)
                break

    if dj_settings_module is None:
        return

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", dj_settings_module)

    try:
        django.setup()
    except ModuleNotFoundError:
        return

    return

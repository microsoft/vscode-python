import subprocess
import os
import pathlib
import re
import sys


def find_settings_module(path_to_manage_py):
    dj_settings_module = None
    with open(path_to_manage_py, "r") as manage_py:
        pattern = r"^os\.environ\.setdefault\((['\"])(DJANGO_SETTINGS_MODULE)\1, (['\"])(?P<settings_path>[\w.]+)\3\)$"
        for line in manage_py.readlines():
            match_result = re.match(pattern, line.strip())
            if match_result is not None:
                dj_settings_module = match_result.groupdict().get("settings_path", None)
                break
    return dj_settings_module


def configure_test_runner(path_to_manage_py):
    # Getting the DJANGO_SETTINGS_MODULE from manage.py
    dj_settings_module = find_settings_module(path_to_manage_py)
    if dj_settings_module is None:
        raise Exception("DJANGO_SETTINGS_MODULE not found in manage.py")

    # Construct the path to the settings.py file
    settings_file = os.path.join(
        os.path.dirname(dj_settings_module.replace(".", os.sep)), "settings.py"
    )
    # Check if the settings.py file exists
    if not os.path.exists(settings_file):
        raise Exception(f"settings.py file not found at {settings_file}")
    # Read the content of the existing settings.py file
    with open(settings_file, "r") as f:
        original_settings_content = f.read()

    # Check if TEST_RUNNER is already defined in the settings
    if "TEST_RUNNER" in original_settings_content:
        print("TEST_RUNNER is already defined in settings.py. but continuing")
        print("settings_content: ", original_settings_content)
    else:
        # Add the custom test runner to the settings.py file

        # Get path to the custom_test_runner.py parent folder, add to sys.path
        custom_test_runner_dir = pathlib.Path(__file__).parent
        sys.path.insert(0, custom_test_runner_dir)

        # Import your custom test runner class
        # from execution import UnittestTestResult

        # Set the TEST_RUNNER setting
        setting_content = original_settings_content + (
            "\n\n"
            + "# Use custom test runner\n"
            + "import sys\n"
            + f"sys.path.insert(0, '{custom_test_runner_dir}')\n"
            + f"TEST_RUNNER = 'django_test_runner.CustomTestRunner'\n"
        )

        # Write the updated content back to the settings.py file
        with open(settings_file, "w") as f:
            f.write(setting_content)

        print("TEST_RUNNER setting added to settings.py.")
    return settings_file, original_settings_content


# Define a cleanup method
def cleanup(settings_file, original_settings_content):
    # Restore the original content of settings.py
    with open(settings_file, "w") as f:
        f.write(original_settings_content)
    print("Settings.py has been restored to its original state.")

    return True


def runner():
    # Define the path to your manage.py file
    # could get path to manage.py from environment variable
    # get Django test boolean
    django_test_enabled = os.environ.get("DJANGO_TEST_ENABLED")
    manage_py_path = os.environ.get("MANAGE_PY_PATH")

    if (
        django_test_enabled is not None
        and django_test_enabled.lower() == "true"
        and manage_py_path is not None
    ):
        # attempt to configure and run tests as django tests
        try:
            settings_file, original_settings_content = configure_test_runner(
                manage_py_path
            )
            # Command to run 'python manage.py test'
            python_executable = sys.executable
            command = [python_executable, "manage.py", "test"]
            print("running test command: ", command)
            # Run the command
            try:
                subprocess.run(" ".join(command), shell=True, check=True)
                # Cleanup
                cleanup(settings_file, original_settings_content)
            except subprocess.CalledProcessError as e:
                print(f"Error running 'manage.py test': {e}")
        except Exception as e:
            print(f"Error configuring Django test runner: {e}")

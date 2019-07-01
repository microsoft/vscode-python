# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import os.path
import sys

import behave

import uitests.tools
import uitests.vscode.quick_input
import uitests.vscode.quick_open
import uitests.vscode.settings


@behave.given('a Python Interpreter containing the name "{name}" is selected')
def given_select_interpreter_with_name(context, name):
    uitests.vscode.quick_open.select_command(context, "Python: Select Interpreter")
    uitests.vscode.quick_input.select_value(context, name)


@behave.given('a venv with the name "{name}" is created')
def given_venv_created(context, name):
    context.execute_steps("Given a terminal is opened")
    context.execute_steps(
        f'When I send the command ""{context.options.python3_path}" -m venv "{name}"" to the terminal'
    )
    uitests.tools.wait_for_python_env(context.options.workspace_folder, name)


@behave.given("a pipenv environment is created")
def given_pipenv_created(context):
    context.execute_steps("Given a terminal is opened")
    context.execute_steps(
        f'When I send the command "pipenv shell --anyway" to the terminal'
    )
    uitests.tools.wait_for_pipenv(context.options.workspace_folder)


@behave.given('a conda environment is created with the name "{name}"')
def given_conda_env_created(context, name):
    context.execute_steps("Given a terminal is opened")
    context.execute_steps(
        f'When I send the command ""{context.options.conda_path}" create --yes --name "{name}"" to the terminal'
    )
    uitests.tools.wait_for_conda_env(context.options.conda_path, name)


@behave.given("a generic Python Interpreter is selected")
def given_select_generic_interpreter(context):
    uitests.vscode.settings.update_workspace_settings(
        context, {"python.pythonPath": sys.executable}
    )


@behave.when('I select the Python Interpreter containing the name "{name}"')
def when_select_interpreter_with_name(context, name):
    uitests.vscode.quick_open.select_command(context, "Python: Select Interpreter")
    uitests.vscode.quick_input.select_value(context, name)


@behave.when("I select the default mac Interpreter")
def select_interpreter(context):
    uitests.vscode.quick_open.select_command(context, "Python: Select Interpreter")
    uitests.vscode.quick_input.select_value(context, "/usr/bin/python")


@behave.then(
    'the contents of the file "{name}" does not contain the current python interpreter'
)
def file_not_contains_interpreter(context, name):
    with open(os.path.join(context.options.workspace_folder, name), "r") as file:
        contents = file.read()
        assert (
            context.options.python_path not in contents
        ), f"{context.options.python_path} in {contents}"


@behave.then(
    'the contents of the file "{name}" contains the current python interpreter'
)
def file_contains_interpreter(context, name):
    with open(os.path.join(context.options.workspace_folder, name), "r") as file:
        contents = file.read()
        assert (
            context.options.python_path in contents
        ), f"{context.options.python_path} not in {contents}"

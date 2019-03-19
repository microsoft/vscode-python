# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import behave
import tests


@behave.given('a Python Interpreter containing the name "{name}" is selected')
def given_select_interpreter_with_name(context, name: str):
    tests.wow.vscode.quick_open.select_command(context, "Python: Select Interpreter")
    tests.vscode.quick_input.select_value(context, name)


@behave.when('I select the Python Interpreter containing the name "{name}" is selected')
def when_select_interpreter_with_name(context, name: str):
    tests.vscode.quick_open.select_command(context, "Python: Select Interpreter")
    tests.vscode.quick_input.select_value(context, name)


@behave.when("I select the default mac Interpreter")
def select_interpreter(context):
    tests.vscode.quick_open.select_command(context, "Python: Select Interpreter")
    tests.vscode.quick_input.select_value(context, "/usr/bin/python")

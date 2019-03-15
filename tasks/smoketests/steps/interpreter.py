# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


from behave import given, when

from tasks.smoketests.vscode.base import Context


@given('a Python Interpreter containing the name "{name}" is selected')
def given_select_interpreter_with_name(context: Context, name: str):
    context.app.quick_open.select_command("Python: Select Interpreter")
    context.app.quick_input.select_value(name)


@when('I select the Python Interpreter containing the name "{name}" is selected')
def when_select_interpreter_with_name(context: Context, name: str):
    context.app.quick_open.select_command("Python: Select Interpreter")
    context.app.quick_input.select_value(name)


@when("I select the default mac Interpreter")
def select_interpreter(context: Context):
    context.app.quick_open.select_command("Python: Select Interpreter")
    context.app.quick_input.select_value("/usr/bin/python")

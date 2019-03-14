# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


from behave import when, then
from tasks.smoketests.vscode.base import Context


@when("I select default mac Interpreter")
def select_interpreter(context: Context):
    context.app.quick_open.select_command("Python: Select Interpreter")
    context.app.quick_input.select_value("/usr/bin/python")


@then('a message with the text "{message}" is displayed')
def show_message(context: Context, message: str):
    context.app.notifications.wait_for_message(message)


@then('a message containing the text "{message}" is displayed')
def show_message_containing(context: Context, message: str):
    context.app.notifications.wait_for_message_containing(message)

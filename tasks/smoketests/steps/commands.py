# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


from behave import given, when

from tasks.smoketests.vscode.base import Context


@given('the command "{command}" is selected')
def given_command_selected(context: Context, command: str):
    context.app.quick_open.select_command(command)


@when('I select the command "{command}"')
def when_select_command(context: Context, command: str):
    context.app.quick_open.select_command(command)

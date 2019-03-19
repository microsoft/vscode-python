# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import behave
import tests


@behave.given('the command "{command}" is selected')
def given_command_selected(context, command: str):
    tests.wow.vscode.quick_open.select_command(context, command)


@behave.when('I select the command "{command}"')
def when_select_command(context, command: str):
    tests.vscode.quick_open.select_command(context, command)

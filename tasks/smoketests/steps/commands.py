# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import behave


@behave.given('the command "{command}" is selected')
def given_command_selected(context, command: str):
    context.app.quick_open.select_command(command)


@behave.when('I select the command "{command}"')
def when_select_command(context, command: str):
    context.app.quick_open.select_command(command)

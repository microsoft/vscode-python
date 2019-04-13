# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import os.path
import time

import behave

import uitests.vscode.quick_open


@behave.given("a terminal is opened")
def terminal_opened(context):
    uitests.vscode.quick_open.select_command(
        context, "Terminal: Create New Integrated Terminal"
    )
    time.sleep(5)  # wait for terminal to open and wait for activation.


@behave.when('I send the command "{command}" to the terminal')
def send_command_to_terminal(context, command):
    with open(
        os.path.join(context.options.extensions_dir, "commands.txt"), "w"
    ) as file:
        file.write(command)
    uitests.vscode.quick_open.select_command(context, "Smoke: Run Command In Terminal")

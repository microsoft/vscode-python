# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import os.path
import sys
import time

import behave

import uitests.vscode.application
import uitests.vscode.notifications
import uitests.vscode.quick_open


@behave.given("a terminal is opened")
def terminal_opened(context):
    uitests.vscode.quick_open.select_command(
        context, "Terminal: Create New Integrated Terminal"
    )
    # Take a couple of screen shots (for logging purposes, in case things don't work out).
    # Sending commands to terminals is flaky, hence logs just take screenshots - just in case.
    uitests.vscode.application.capture_screen(context)
    time.sleep(10)  # wait for terminal to open and wait for activation.
    uitests.vscode.application.capture_screen(context)


@behave.when('I send the command "{command}" to the terminal')
def send_command_to_terminal(context, command):
    """We're unable send text directly to the terminal (no idea how to do this).
    Can't find the exact element to send text to.
    Easy work around, use the bootstrap extension to send text to the terminal."""
    with open(
        os.path.join(context.options.extensions_dir, "commands.txt"), "w"
    ) as file:
        file.write(command)

    # Ensure the shell is Command Prompt for Windows & bash for Linux
    _ensure_shell_is_cmd(context)
    _ensure_shell_is_bash(context)

    # Take a couple of screen shots (for logging purposes, in case things don't work out).
    # Sending commands to terminals is flaky, hence logs just take screenshots - just in case.
    uitests.vscode.application.capture_screen(context)
    uitests.vscode.quick_open.select_command(context, "Smoke: Run Command In Terminal")
    uitests.vscode.application.capture_screen(context)
    # wait for command to be sent to the terminal by the bootstrap extension.
    time.sleep(5)
    uitests.vscode.application.capture_screen(context)


@behave.when("I change the terminal shell to Command Prompt")
def change_shell_to_cmd(context):
    uitests.vscode.quick_open.select_command(context, "Terminal: Select Default Shell")
    uitests.vscode.quick_input.select_value(context, "Command Prompt")
    # Wait for changes to take affect before opening a new terminal.
    time.sleep(1)


@behave.when("I change the terminal shell to bash")
def change_shell_to_bash(context):
    command = 'I update the workspace setting "terminal.integrated.shell.linux" with the value "/bin/bash"'
    context.execute_steps(f"When {command.strip()}")
    # Wait for changes to take affect before opening a new terminal.
    # Take screenshots, as VSC seems to display prompts asking using to allow this change.
    # This has been observed to happen once while testing.
    uitests.vscode.application.capture_screen(context)
    time.sleep(1)
    uitests.vscode.application.capture_screen(context)


def _ensure_shell_is_cmd(context):
    if not sys.platform.startswith("win"):
        return
    try:
        current_value = uitests.vscode.settings.get_user_setting(
            context, "terminal.integrated.shell.windows"
        )
    except Exception:
        current_value = ""

    if current_value is not None and "cmd.exe" in current_value:
        return
    change_shell_to_cmd(context)


def _ensure_shell_is_bash(context):
    if not sys.platform.startswith("linux"):
        return
    try:
        current_value = uitests.vscode.settings.get_user_setting(
            context, "terminal.integrated.shell.linux"
        )
    except Exception:
        current_value = ""

    if current_value is not None and "bash" in current_value:
        return
    change_shell_to_bash(context)

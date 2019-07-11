# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import logging
import sys
import time

import behave
from selenium.webdriver.common.keys import Keys

import uitests.tools
import uitests.vscode.application
import uitests.vscode.core
import uitests.vscode.extension
import uitests.vscode.quick_open


@behave.given("In Windows,{step}")
def given_on_windows(context, step):
    """Executes a `Give` step when on Windows.

    Parameters:
    step (string): `Given` Step to be executed.

    """
    if not sys.platform.startswith("win"):
        return
    context.execute_steps(f"Given {step.strip()}")


@behave.given("In Mac,{step}")
def given_on_mac(context, step):
    """Executes a `Give` step when on Mac.

    Parameters:
    step (string): `Given` Step to be executed.

    """
    if not sys.platform.startswith("darwin"):
        return
    context.execute_steps(f"Given {step.strip()}")


@behave.given("In Linux,{step}")
def given_on_linux(context, step):
    """Executes a `Give` step when on Linux.

    Parameters:
    step (string): `Given` Step to be executed.

    """
    if not sys.platform.startswith("linux"):
        return
    context.execute_steps(f"When {step.strip()}")


@behave.when("In Windows,{step}")
def when_on_widows(context, step):
    """Executes a `When` step when on Windows.

    Parameters:
    step (string): `When` Step to be executed.

    """
    if not sys.platform.startswith("win"):
        return
    context.execute_steps(f"When {step.strip()}")


@behave.when("In Mac,{step}")
def when_on_mac(context, step):
    """Executes a `When` step when on Mac.

    Parameters:
    step (string): `When` Step to be executed.

    """
    if not sys.platform.startswith("darwin"):
        return
    context.execute_steps(f"When {step.strip()}")


@behave.when("In Linux,{step}")
def when_on_linux(context, step):
    """Executes a `When` step when on Linux.

    Parameters:
    step (string): `When` Step to be executed.

    """
    if not sys.platform.startswith("linux"):
        return
    context.execute_steps(f"When {step.strip()}")


@behave.then("In Windows,{step}")
def then_on_windows(context, step):
    """Executes a `Then` step when on Widows.

    Parameters:
    step (string): `Then` Step to be executed.

    """
    if not sys.platform.startswith("win"):
        return
    context.execute_steps(f"Then {step.strip()}")


@behave.then("In Mac,{step}")
def then_on_mac(context, step):
    """Executes a `Then` step when on Mac.

    Parameters:
    step (string): `Then` Step to be executed.

    """
    if not sys.platform.startswith("darwin"):
        return
    context.execute_steps(f"Then {step.strip()}")


@behave.then("In Linux,{step}")
def then_on_linux(context, step):
    """Executes a `Then` step when on Linux.

    Parameters:
    step (string): `Then` Step to be executed.

    """
    if not sys.platform.startswith("linux"):
        return
    context.execute_steps(f"Then {step.strip()}")


@behave.when("I wait for {seconds:g} seconds")
def when_sleep(context, seconds):
    """Wait for n seconds.

    Parameters:
    seconds (int): Time in seconds to wait.

    """
    time.sleep(seconds)


@behave.when("I wait for 1 second")
def when_sleep1(context):
    """Wait for n seconds.

    Parameters:
    seconds (int): Time in seconds to wait.

    """
    time.sleep(1)


@behave.then("nothing")
def then_nothing(context):
    """Do nothing."""
    pass


@behave.then("do nothing")
def then_do_nothing(context):
    """Do nothing."""
    pass


@behave.when("I reload VSC")
def when_reload_vsc(context):
    """Reload VS Code."""
    uitests.vscode.application.reload(context)


@behave.when("I open VS Code for the first time")
def when_open_vscode_first_time(context):
    """Delete the user folder.
    Delete the language server folder
    (that's pretty much same as Opening VSC from scratch).

    """
    uitests.vscode.application.exit(context)
    uitests.vscode.application.clear_vscode(context.options)
    uitests.vscode.application.reload(context)


@behave.when("I reload VS Code")
def when_reload_vscode(context):
    """Reload VS Code."""
    uitests.vscode.application.reload(context)


@behave.then("reload VSC")
def then_reload_vsc(context):
    """Reload VS Code."""
    uitests.vscode.application.reload(context)


@behave.then("reload VS Code")
def then_reload_vscode(context):
    """Reload VS Code."""
    uitests.vscode.application.reload(context)


@behave.then("wait for {seconds:g} seconds")
def then_sleep(context, seconds):
    """Wait for n seconds.

    Parameters:
    seconds (int): Time in seconds to wait.

    """
    time.sleep(1)

    time.sleep(seconds)


@behave.then("wait for 1 second")
def then_sleep1(context, seconds):
    """Wait for n seconds.

    Parameters:
    seconds (int): Time in seconds to wait.

    """
    time.sleep(1)

    time.sleep(seconds)


@behave.then('log the message "{message}"')
def log_message(context, message):
    """Logs a message to stdout.

    Parameters:
    message (string): Message to be logged.

    """
    time.sleep(1)

    logging.info(message)


@behave.then("take a screenshot")
def capture_screen(context):
    """Captures a screenshot."""
    uitests.vscode.application.capture_screen(context)


@behave.when("I wait for the Python extension to activate")
def when_extension_has_loaded(context):
    """Activate the Python extension and wait for it to complete activating."""
    uitests.vscode.extension.activate_python_extension(context)


def _get_key(key):
    if key.lower() == "ctrl":
        return Keys.CONTROL
    if key.lower() == "cmd":
        return Keys.COMMAND
    return getattr(Keys, key.upper(), key)


@behave.when("I press {key_combination}")
def when_I_press(context, key_combination):
    """Press a Key.
    Supports one key or a combination of keys.
    E.g. I press A, I press ctrl, I press space, I press ctrl+space

    Parameters:
    key_combination (string): Key or a combination of keys.

    """
    keys = map(_get_key, key_combination.split("+"))
    uitests.vscode.core.dispatch_keys(context.driver, *list(keys))


@behave.given("the Python extension has been activated")
def given_extension_has_loaded(context):
    """Activate the Python extension and wait for it to complete activating."""
    uitests.vscode.extension.activate_python_extension(context)


@behave.then('the text "{text}" is displayed in the Interactive Window')
def text_on_screen(context, text):
    """Checks whether some text is displayed in the Interactive Window."""
    text_on_screen = uitests.vscode.screen.get_screen_text(context)
    if text not in text_on_screen:
        raise SystemError(f"{text} not found in {text_on_screen}")

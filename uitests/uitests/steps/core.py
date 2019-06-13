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


@behave.given("In Windows,{command}")
def given_on_windows(context, command):
    if not sys.platform.startswith("win"):
        return
    context.execute_steps(f"Given {command.strip()}")


@behave.given("In Mac,{command}")
def given_on_mac(context, command):
    if not sys.platform.startswith("darwin"):
        return
    context.execute_steps(f"Given {command.strip()}")


@behave.given("In Linux,{command}")
def given_on_linux(context, command):
    if not sys.platform.startswith("linux"):
        return
    context.execute_steps(f"When {command.strip()}")


@behave.when("In Windows,{command}")
def when_on_widows(context, command):
    if not sys.platform.startswith("win"):
        return
    context.execute_steps(f"When {command.strip()}")


@behave.when("In Mac,{command}")
def when_on_mac(context, command):
    if not sys.platform.startswith("darwin"):
        return
    context.execute_steps(f"When {command.strip()}")


@behave.when("In Linux,{command}")
def when_on_linux(context, command):
    if not sys.platform.startswith("linux"):
        return
    context.execute_steps(f"When {command.strip()}")


@behave.then("In Windows,{command}")
def then_on_windows(context, command):
    if not sys.platform.startswith("win"):
        return
    context.execute_steps(f"Then {command.strip()}")


@behave.then("In Mac,{command}")
def then_on_mac(context, command):
    if not sys.platform.startswith("darwin"):
        return
    context.execute_steps(f"Then {command.strip()}")


@behave.then("In Linux,{command}")
def then_on_linux(context, command):
    if not sys.platform.startswith("linux"):
        return
    context.execute_steps(f"Then {command.strip()}")


@behave.when("I wait for {seconds:g} seconds")
def when_sleep(context, seconds):
    time.sleep(seconds)


@behave.when("I wait for 1 second")
def when_sleep1(context):
    time.sleep(1)


@behave.then("nothing")
def then_nothing(context):
    pass


@behave.when("I reload VSC")
def when_reload_vsc(context):
    uitests.vscode.application.reload(context)


@behave.when("I open VS Code for the first time")
def when_open_vscode_first_time(context):
    """
    Delete the user folder.
    Delete the language server folder
    (that's pretty much starting from scratch).
    """
    uitests.vscode.application.close(context)
    uitests.vscode.application.clear_vscode(context.options)
    uitests.vscode.application.reload(context)


@behave.when("I reload VS Code")
def when_reload_vscode(context):
    uitests.vscode.application.reload(context)


@behave.then("reload VSC")
def then_reload_vsc(context):
    uitests.vscode.application.reload(context)


@behave.then("reload VS Code")
def then_reload_vscode(context):
    uitests.vscode.application.reload(context)


@behave.then("wait for {seconds:g} seconds")
def then_sleep(context, seconds):
    time.sleep(seconds)


@behave.then("wait for 1 second")
def then_sleep1(context, seconds):
    time.sleep(seconds)


@behave.then('log the message "{message}"')
def log_message(context, message):
    logging.info(message)


@behave.then("take a screenshot")
def capture_screen(context):
    uitests.vscode.application.capture_screen(context)


@behave.when("I wait for the Python extension to activate")
def when_extension_has_loaded(context):
    uitests.vscode.extension.activate_python_extension(context)


def get_key(key):
    if key.lower() == "ctrl":
        return Keys.CONTROL
    if key.lower() == "cmd":
        return Keys.COMMAND
    return getattr(Keys, key.upper(), key)


@behave.when("I press {key_combination}")
def when_I_press(context, key_combination):
    """
    Supports one key or a combination of keys.
    E.g. I press A, I press ctrl, I press space
    I press ctrl+space
    """
    keys = map(get_key, key_combination.split("+"))
    uitests.vscode.core.dispatch_keys(context.driver, *list(keys))


@behave.given("the Python extension has been activated")
def given_extension_has_loaded(context):
    uitests.vscode.extension.activate_python_extension(context)


@behave.then('the text "{text}" is displayed in the Interactive Window')
def text_on_screen(context, text):
    text_on_screen = uitests.vscode.screen.get_screen_text(context)
    if text not in text_on_screen:
        raise SystemError(f"{text} not found in {text_on_screen}")

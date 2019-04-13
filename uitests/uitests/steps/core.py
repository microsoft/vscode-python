# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import logging
import sys
import time

import behave

import uitests.vscode.application
import uitests.vscode.quick_open
import uitests.vscode.startup


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


@behave.when("I wait for {seconds:n} seconds")
def when_sleep(context, seconds):
    time.sleep(seconds)


@behave.when("I wait for 1 second")
def when_sleep1(context):
    time.sleep(1)


@behave.when("I reload VSC")
def when_reload(context):
    uitests.vscode.startup.reload(context)


@behave.then("reload VSC")
def then_reload(context):
    uitests.vscode.startup.reload(context)


@behave.then("wait for {seconds:n} seconds")
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

# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import time

from behave import then, when

from tasks.smoketests.vscode.base import Context


@when("I wait for {seconds:n} seconds")
def sleep(context: Context, seconds: int):
    time.sleep(seconds)


@then("take a screenshot")
def capture_screen(context: Context):
    context.app.capture_screen()

# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import time

import behave
import tests


@behave.when("I wait for {seconds:n} seconds")
def sleep(context, seconds: int):
    time.sleep(seconds)


@behave.then("take a screenshot")
def capture_screen(context):
    tests.vscode.application.capture_screen(context)

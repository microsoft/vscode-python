# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import time

import behave


@behave.when("I wait for {seconds:n} seconds")
def sleep(context, seconds: int):
    time.sleep(seconds)


@behave.then("take a screenshot")
def capture_screen(context):
    context.app.capture_screen()

# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import behave
import uitests.vscode.application


@behave.given("we have behave installed")
def step_impl(context):
    uitests.vscode.application.capture_screen(context)
    pass


@behave.when("we implement a test")
def implement_test(context):
    assert True is not False


@behave.then("behave will test it for us!")
def test_it(context):
    uitests.vscode.application.capture_screen(context)
    assert True


@behave.then("Another one!")
def another(context):
    assert True

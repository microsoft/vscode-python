# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import behave


@behave.given("we have behave installed")
def step_impl(context):
    print("11234")
    context.app.capture_screen()
    pass


@behave.when("we implement a test")
def implement_test(context):
    print("test implemented")
    assert True is not False


@behave.then("behave will test it for us!")
def test_it(context):
    context.app.capture_screen()
    assert True


@behave.then("Another one!")
def another(context):
    assert True

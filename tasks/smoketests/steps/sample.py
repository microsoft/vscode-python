# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


from behave import given, when, then


@given("we have behave installed")
def step_impl(context):
    print("11234")
    pass


@when("we implement a test")
def implement_test(context):
    print("test implemented")
    assert True is not False


@then("behave will test it for us!")
def test_it(context):
    assert True


@then("Another one!")
def another(context):
    assert True

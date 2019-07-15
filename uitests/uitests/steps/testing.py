# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import time

import behave

import uitests.vscode.testing
import uitests.tools

node_status_icon_mapping = {
    "UNKNOWN": "status-unknown.svg",
    "SKIP": "status-unknown.svg",
    "PROGRESS": "discovering-tests.svg",
    "OK": "status-ok.svg",
    "PASS": "status-ok.svg",
    "SUCCESS": "status-ok.svg",
    "FAIL": "status-error.svg",
    "ERROR": "status-error.svg",
}


@behave.then("the test explorer icon will be visible")
@uitests.tools.retry(AssertionError)
def icon_visible(context):
    uitests.vscode.testing.wait_for_explorer_icon(context)


@behave.when("I run the test node number {number:Number}")
def run_node(context, number):
    uitests.vscode.testing.click_node_action_item(context, number, "Run")


@behave.when('I run the test node "{label}"')
def run_node_by_name(context, label):
    number = uitests.vscode.testing.get_node_number(context, label)
    run_node(context, number)


@behave.when("I debug the test node number {number:Number}")
def debug_node(context, number):
    uitests.vscode.testing.click_node_action_item(context, number, "Debug")


@behave.when('I debug the test node "{label}"')
def debug_node_by_name(context, label):
    number = uitests.vscode.testing.get_node_number(context, label)
    debug_node(context, number)


@behave.when("I navigate to the code associated with test node number {number:Number}")
def navigate_node(context, number):
    uitests.vscode.testing.click_node_action_item(context, number, "Open")


@behave.when('I navigate to the code associated with test node "{label}"')
def navigate_node_by_name(context, label):
    number = uitests.vscode.testing.get_node_number(context, label)
    navigate_node(context, number)


@behave.then("there are {count:Number} nodes in the tree")
def explorer_node_count(context, count):
    total_count = uitests.vscode.testing.get_node_count(context)
    assert total_count == count, f"{total_count} != {count}"


@behave.when("I expand all of the test tree nodes")
def explorer_expand_nodes(context):
    try:
        uitests.vscode.testing.expand_nodes(context)
        return
    except TimeoutError:
        # Rediscover tests.
        uitests.vscode.quick_open.select_command(context, "Python: Discover Tests")
        # As this is a flaky scenario, lets wait for 5s.
        # Enough time for tests to start & perhaps complete.
        time.sleep(5)
        # If tests discovery has not completed, then lets wait.
        wait_for_discovery_to_complete(context)
    # try again.
    uitests.vscode.testing.expand_nodes(context)


@behave.when("I click node number {number:Number}")
def click_node(context, number):
    uitests.vscode.testing.click_node(context, number)


@behave.when('I click node "{label}"')
def click_node_by_name(context, label):
    number = uitests.vscode.testing.get_node_number(context, label)
    click_node(context, number)


@behave.then("all of the test tree nodes have an unknown icon")
def all_unknown(context):
    icons = uitests.vscode.testing.get_node_icons(context)
    assert all("status-unknown.svg" in icon.get_attribute("style") for icon in icons)


@behave.then('the node number {number:Number} has a status of "{status}"')
@uitests.tools.retry(AssertionError)
def node_status(context, number, status):
    icon = uitests.vscode.testing.get_node_icon(context, number)
    assert node_status_icon_mapping.get(status.upper(), "") in icon.get_attribute(
        "style"
    )


@behave.then('the node "{label}" has a status of "{status}"')
@uitests.tools.retry(AssertionError)
def node_status_by_name(context, label, status):
    number = uitests.vscode.testing.get_node_number(context, label)
    node_status(context, number, status)


@behave.then('{number:Number} nodes have a status of "{status}"')
@uitests.tools.retry(AssertionError)
def node_count_status(context, number, status):
    check_node_count_status(context, number, status)


@behave.then('1 node has a status of "{status}"')
@uitests.tools.retry(AssertionError)
def node_one_status(context, status):
    check_node_count_status(context, 1, status)


@behave.then("all of the test tree nodes have a progress icon")
@uitests.tools.retry(AssertionError, tries=20, delay=0.5)
def all_progress(context):
    """Retry, & wait for 0.5 seconds (longer than default 0.1).
    Wait for long enough for tests to start and UI get updated."""
    icons = uitests.vscode.testing.get_node_icons(context)
    assert all("discovering-tests.svg" in icon.get_attribute("style") for icon in icons)


@behave.then("the stop icon is visible in the toolbar")
@uitests.tools.retry(AssertionError, tries=20, delay=0.5)
def stop_icon_visible(context):
    """Retry, & wait for 0.5 seconds (longer than default 0.1).
    Wait for long enough for tests to start and UI get updated."""
    uitests.vscode.testing.wait_for_stop_icon(context)


@behave.then("the stop icon is not visible in the toolbar")
@uitests.tools.retry(AssertionError)
def stop_icon_not_visible(context):
    uitests.vscode.testing.wait_for_stop_hidden(context)


@behave.then("the run failed tests icon is visible in the toolbar")
@uitests.tools.retry(AssertionError)
def fun_failed_icon_visible(context):
    uitests.vscode.testing.wait_for_run_failed_icon(context)


@behave.then("the run failed tests icon is not visible in the toolbar")
@uitests.tools.retry(AssertionError)
def fun_failed_icon_not_visible(context):
    uitests.vscode.testing.wait_for_run_failed_hidden(context)


@behave.when("I wait for tests to complete running")
@uitests.tools.retry(AssertionError)
def wait_for_run_to_complete(context):
    uitests.vscode.testing.wait_for_stop_hidden(context)


@behave.when("I wait for tests discovery to complete")
@uitests.tools.retry(AssertionError)
def wait_for_discovery_to_complete(context):
    uitests.vscode.testing.wait_for_stop_hidden(context)


@behave.when("I stop discovering tests")
def when_stop_discovering(context):
    uitests.vscode.testing.stop(context)


@behave.when("I run failed tests")
def when_run_failed_tests(context):
    uitests.vscode.testing.run_failed_tests(context)


@behave.when("I stop running tests")
def when_stop_running(context):
    uitests.vscode.testing.stop(context)


@behave.then("stop discovering tests")
def then_stop_discovering(context):
    uitests.vscode.testing.stop(context)


def check_node_count_status(context, number, status):
    icon_name = node_status_icon_mapping.get(status.upper(), "")
    icons = uitests.vscode.testing.get_node_icons(context)
    assert (
        len(list(icon for icon in icons if icon_name in icon.get_attribute("style")))
        == number
    )

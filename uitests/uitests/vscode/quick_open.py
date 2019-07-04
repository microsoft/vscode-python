# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import time

from selenium.webdriver.common.keys import Keys

import uitests.tools

from . import core
from .selectors import get_selector

QUICK_OPEN = "div.monaco-quick-open-widget"
QUICK_OPEN_HIDDEN = 'div.monaco-quick-open-widget[aria-hidden="true"]'
QUICK_OPEN_INPUT = f"{QUICK_OPEN} .quick-open-input input"
QUICK_OPEN_FOCUSED_ELEMENT = (
    f"{QUICK_OPEN} .quick-open-tree .monaco-tree-row.focused .monaco-highlighted-label"
)
QUICK_OPEN_ENTRY_SELECTOR = 'div[aria-label="Quick Picker"] .monaco-tree-rows.show-twisties .monaco-tree-row .quick-open-entry'  # noqa
QUICK_OPEN_ENTRY_LABEL_SELECTOR = 'div[aria-label="Quick Picker"] .monaco-tree-rows.show-twisties .monaco-tree-row .quick-open-entry .label-name'  # noqa
QUICK_OPEN_ENTRY_LABEL_SELECTOR_FOCUSED = 'div[aria-label="Quick Picker"] .monaco-tree-rows.show-twisties .monaco-tree-row.focused .quick-open-entry .label-name'  # noqa


def select_command(context, command, **kwargs):
    if command == "View: Close All Editors":
        try:
            close_all_editors(context)
        except Exception:
            pass
        return
    if command == "Debug: Continue":
        # When debugging, add a delay of 0.5s before continuing.
        time.sleep(0.5)
    element = _open(context, command, **kwargs)
    core.dispatch_keys(context.driver, Keys.ENTER, element=element)


@uitests.tools.retry(AssertionError)
@uitests.tools.log_exceptions()
def close_all_editors(context):
    element = _open(context, "View: Close All Editors")
    core.dispatch_keys(context.driver, Keys.ENTER, element=element)
    # Wait for tabs to close
    time.sleep(0.5)
    # If we have any editors, close them one by one.
    selector = (
        'div[id="workbench.parts.editor"] .title.tabs .tab-close a.close-editor-action'
    )
    elements = context.driver.find_elements_by_css_selector(selector)
    if not elements:
        return
    for button in elements:
        button.click()
        time.sleep(0.5)
    elements = context.driver.find_elements_by_css_selector(selector)
    if elements:
        raise AssertionError("Tabs not closed")


def select_value(context, value):
    element = core.wait_for_element(context.driver, QUICK_OPEN_INPUT)
    core.dispatch_keys(context.driver, value, element=element)
    core.dispatch_keys(context.driver, Keys.ENTER, element=element)


def wait_until_selected(context, value, **kwargs):
    def find(eles):
        try:
            if eles[0].text == value:
                return [eles[0]]
            if any([ele for ele in eles if ele.text == value]):
                # Check if the item that matches exactly is highlighted,
                # If it is, then select that and return it
                highlighted_element = core.wait_for_element(
                    context.driver, QUICK_OPEN_ENTRY_LABEL_SELECTOR_FOCUSED
                )
                if highlighted_element.text == value:
                    return [highlighted_element]
                return []

            return [eles[0]] if eles[0].text == value else []
        except Exception:
            return []

    return core.wait_for_elements(
        context.driver, QUICK_OPEN_ENTRY_LABEL_SELECTOR, find, **kwargs
    )


def _open(context, value, **kwargs):
    retry = kwargs.get("retry", 30)
    timeout = kwargs.get("timeout", 10)
    # This is a hack, we cannot send key strokes to the electron app using selenium.
    # So, lets bring up the `Go to line` input window
    # then type in the character '>' to turn it into a quick input window 😊
    last_ex = None
    for _ in range(retry, -1, -1):
        element = core.wait_for_element(
            context.driver,
            get_selector("STATUS_BAR_SELECTOR", context.options.channel).format("Py"),
            timeout=timeout,
        )
        element.click()
        try:
            element = core.wait_for_element(context.driver, QUICK_OPEN_INPUT)
            core.dispatch_keys(context.driver, f"> {value}", element=element)
            wait_until_selected(context, value, timeout=timeout)
            return element
        except Exception as ex:
            last_ex = ex
            continue
    else:
        raise SystemError("Failed to open quick open") from last_ex

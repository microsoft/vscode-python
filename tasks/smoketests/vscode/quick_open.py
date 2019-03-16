# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


from selenium.webdriver.common.keys import Keys

from . import core

QUICK_OPEN = "div.monaco-quick-open-widget"
QUICK_OPEN_HIDDEN = 'div.monaco-quick-open-widget[aria-hidden="true"]'
QUICK_OPEN_INPUT = f"{QUICK_OPEN} .quick-open-input input"
QUICK_OPEN_FOCUSED_ELEMENT = (
    f"{QUICK_OPEN} .quick-open-tree .monaco-tree-row.focused .monaco-highlighted-label"
)
QUICK_OPEN_ENTRY_SELECTOR = 'div[aria-label="Quick Picker"] .monaco-tree-rows.show-twisties .monaco-tree-row .quick-open-entry'  # noqa
QUICK_OPEN_ENTRY_LABEL_SELECTOR = 'div[aria-label="Quick Picker"] .monaco-tree-rows.show-twisties .monaco-tree-row .quick-open-entry .label-name'  # noqa


def select_command(context, command: str, **kwargs):
    element = _open(context, command, **kwargs)
    core.dispatch_keys(context.driver, Keys.ENTER, element=element)


def select_value(context, value: str, **kwargs):
    element = _wait_until_opened(context, 5)
    core.dispatch_keys(context.driver, value, element=element)
    core.dispatch_keys(context.driver, Keys.ENTER, element=element)


def wait_until_selected(context, value: str, **kwargs):
    def find(eles):
        try:
            return [eles[0]] if eles[0].text == value else []
        except Exception:
            return []

    return core.wait_for_elements(
        context, QUICK_OPEN_ENTRY_LABEL_SELECTOR, find, **kwargs
    )


def _open(context, value: str, **kwargs):
    retry = kwargs.get("retry", 5)
    # This is a hack, we cannot send key strokes to the electron app using selenium.
    # So, lets bring up the `Go to line` input window
    # then type in the character '>' to turn it into a quick input window 😊
    last_ex = None
    for _ in range(retry, -1, -1):
        element = core.wait_for_element(
            context.driver,
            ".part.statusbar .statusbar-item.left.statusbar-entry a[title='PySmoke']",
            timeout=5,
        )
        element.click()
        try:
            element = _wait_until_opened(context, 10)
            core.dispatch_keys(context.driver, f"> {value}", element=element)
            wait_until_selected(context, value, timeout=5)
            return element
        except Exception as ex:
            last_ex = ex
            continue
    else:
        raise SystemError("Failed to open quick open") from last_ex


def _wait_until_opened(context, retry_count=10, is_command=True):
    return core.wait_for_element(
        context.driver, QUICK_OPEN_INPUT, retry_count=retry_count
    )

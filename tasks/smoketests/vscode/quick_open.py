# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


from selenium.webdriver.common.keys import Keys
from .base import QuickOpen as BaseQuickOpen, Component

QUICK_OPEN = "div.monaco-quick-open-widget"
QUICK_OPEN_HIDDEN = 'div.monaco-quick-open-widget[aria-hidden="true"]'
QUICK_OPEN_INPUT = f"{QUICK_OPEN} .quick-open-input input"
QUICK_OPEN_FOCUSED_ELEMENT = (
    f"{QUICK_OPEN} .quick-open-tree .monaco-tree-row.focused .monaco-highlighted-label"
)
QUICK_OPEN_ENTRY_SELECTOR = 'div[aria-label="Quick Picker"] .monaco-tree-rows.show-twisties .monaco-tree-row .quick-open-entry' # noqa
QUICK_OPEN_ENTRY_LABEL_SELECTOR = 'div[aria-label="Quick Picker"] .monaco-tree-rows.show-twisties .monaco-tree-row .quick-open-entry .label-name' # noqa


class QuickOpen(BaseQuickOpen, Component):
    def select_command(self, command: str, **kwargs):
        element = self._open(command, **kwargs)
        self.app.core.dispatch_keys(Keys.ENTER, element=element)

    def select_value(self, value: str, **kwargs):
        element = self._wait_until_opened(5)
        self.app.core.dispatch_keys(value, element=element)
        self.app.core.dispatch_keys(Keys.ENTER, element=element)

    def wait_until_selected(self, value: str, **kwargs):
        def find(eles):
            try:
                return [eles[0]] if eles[0].text == value else []
            except Exception:
                return []

        return self.app.core.wait_for_elements(
            QUICK_OPEN_ENTRY_LABEL_SELECTOR, find, **kwargs
        )

    def _open(self, value: str, **kwargs):
        retry = kwargs.get("retry", 5)
        # This is a hack, we cannot send key strokes to the electron app using selenium.
        # So, lets bring up the `Go to line` input window
        # then type in the character '>' to turn it into a quick input window 😊
        last_ex = None
        for _ in range(retry, -1, -1):
            element = self.app.core.wait_for_element(
                ".part.statusbar .statusbar-item.left.statusbar-entry a[title='PySmoke']",
                timeout=5,
            )
            element.click()
            try:
                element = self._wait_until_opened(10)
                self.app.core.dispatch_keys(f"> {value}", element=element)
                self.wait_until_selected(value, timeout=5)
                return element
            except Exception as ex:
                last_ex = ex
                continue
        else:
            raise SystemError("Failed to open quick open") from last_ex

    def _wait_until_opened(self, retry_count=10, is_command=True):
        return self.app.core.wait_for_element(QUICK_OPEN_INPUT, retry_count=retry_count)

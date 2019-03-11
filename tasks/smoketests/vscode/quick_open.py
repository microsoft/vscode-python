# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os
import shutil
import time
from platform import platform
from typing import List
from dataclasses import dataclass
from enum import Enum
from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from .base import QuickOpen as BaseQuickOpen, Component
from ..utils.tools import Platform, get_platform

QUICK_OPEN = "div.monaco-quick-open-widget"
QUICK_OPEN_HIDDEN = 'div.monaco-quick-open-widget[aria-hidden="true"]'
QUICK_OPEN_INPUT = f"{QUICK_OPEN} .quick-open-input input"
QUICK_OPEN_GENERIC_INPUT = f"{QUICK_OPEN} .quick-input-box input"
QUICK_OPEN_FOCUSED_ELEMENT = (
    f"{QUICK_OPEN} .quick-open-tree .monaco-tree-row.focused .monaco-highlighted-label"
)
QUICK_OPEN_ENTRY_SELECTOR = 'div[aria-label="Quick Picker"] .monaco-tree-rows.show-twisties .monaco-tree-row .quick-open-entry'
QUICK_OPEN_ENTRY_LABEL_SELECTOR = 'div[aria-label="Quick Picker"] .monaco-tree-rows.show-twisties .monaco-tree-row .quick-open-entry .label-name'


class QuickOpen(BaseQuickOpen, Component):
    def open(self, value: str, is_command=False, **kwargs):
        retry = kwargs.get("retry", 5)
        # This is a hack, we cannot send key strokes to the electron app using selenium.
        # So, lets bring up the `Go to line` input window
        # then type in the character '>' to turn it into a quick input window 😊
        last_ex = None
        while retry >= 0:
            retry -= 1
            ele = self.app.core.wait_for_element(
                ".part.statusbar .statusbar-item.left.statusbar-entry a[title='PySmoke']",
                timeout=5,
            )
            ele.click()
            try:
                ele = self._wait_until_opened(10)
                keys = f"> {value}" if is_command else value
                self.app.core.dispatch_keys(keys, element=ele)
                self.wait_until_selected(value, timeout=5)
                return ele
            except Exception as ex:
                last_ex = ex
                continue
        else:
            raise SystemError("Failed to open quick open") from last_ex

    def select_command(self, command: str, **kwargs):
        ele = self.open(command, is_command=True, **kwargs)
        self.app.core.dispatch_keys(Keys.ENTER, element=ele)

    # def select_value(self, value: str, **kwargs):
    #     ele = self.open(command, is_command=True, **kwargs)
    #     self.app.core.dispatch_keys(Keys.ENTER, element=ele)

    def wait_until_selected(self, value: str, **kwargs):
        def find(eles):
            if len(eles) > 0:
                try:
                    return eles[0].text == value
                except Exception:
                    return False

        return self.app.core.wait_for_elements(
            QUICK_OPEN_ENTRY_LABEL_SELECTOR, find, **kwargs
        )

    def _wait_until_opened(self, retry_count=10):
        return self.app.core.wait_for_element(QUICK_OPEN_INPUT, retry_count=retry_count)

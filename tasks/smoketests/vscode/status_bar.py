# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


from typing import List

from .base import Component
from .base import StatusBar as BaseStatusBar
from .constants import PYTHON_STATUS_BAR_PREFIX, PYTHON_STATUS_BAR_PRIORITY

STATUS_BAR_SELECTOR = 'div[id="workbench.parts.statusbar"]'


class StatusBar(BaseStatusBar, Component):
    def wait_for_item_with_tooltip(self, value: str, **kwargs):
        selector = f'{STATUS_BAR_SELECTOR} span[title="${value}"]'
        return self.app.core.wait_for_element(selector)

    def wait_for_python_statusbar(self, parts: List[str] = []):
        selector = f"div.statusbar-item.left.statusbar-entry[statusbar-entry-priority='{PYTHON_STATUS_BAR_PRIORITY}']"

        def find(elements):
            for element in elements:
                if element.text.index(PYTHON_STATUS_BAR_PREFIX) != 0:
                    continue
                if not parts:
                    return [element]
                text_parts = element.text.split(" ")
                if all(map(text_parts.index, parts)):
                    return [element]
            return []

        return self.app.core.wait_for_elements(selector, find)[0]

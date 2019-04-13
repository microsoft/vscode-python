# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


from typing import List

from . import constants, core

STATUS_BAR_SELECTOR = 'div[id="workbench.parts.statusbar"]'


def wait_for_item_with_tooltip(context, value):
    selector = f'{STATUS_BAR_SELECTOR} span[title="${value}"]'
    core.wait_for_element(context.driver, selector)


def wait_for_python_statusbar(context, parts: List[str] = []):
    selector = f"div.statusbar-item.left.statusbar-entry[statusbar-entry-priority='{constants.PYTHON_STATUS_BAR_PRIORITY}'] a"  # noqa

    def find(elements):
        for element in elements:
            if element.text.index(constants.PYTHON_STATUS_BAR_PREFIX) != 0:
                continue
            if not parts:
                return [element]
            text_parts = element.text.split(" ")
            if all(map(text_parts.index, parts)):
                return [element]
        return []

    return core.wait_for_elements(context.driver, selector, find)[0]

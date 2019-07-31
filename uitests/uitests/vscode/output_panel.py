# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import time

from selenium.common.exceptions import StaleElementReferenceException

import uitests.tools

from . import core


# The ui can get updated, hence retry at least 10 times.
@uitests.tools.retry(StaleElementReferenceException)
def get_output_panel_lines(context, **kwargs):
    selector = ".part.panel.bottom .view-lines .view-line span span"
    elements = core.wait_for_elements(context.driver, selector, **kwargs)
    return [element.text for element in elements]


def maximize_bottom_panel(context):
    try:
        selector = ".part.panel.bottom a.icon.maximize-panel-action"
        element = core.wait_for_element(context.driver, selector)
        element.click()
        # Wait for some time for click to take affect.
        time.sleep(0.5)
    except Exception:
        pass


def minimize_bottom_panel(context):
    try:
        selector = ".part.panel.bottom a.icon.minimize-panel-action"
        element = core.wait_for_element(context.driver, selector)
        element.click()
        # Wait for some time for click to take affect.
        time.sleep(0.5)
    except Exception:
        pass

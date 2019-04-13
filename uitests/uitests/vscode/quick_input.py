# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


from selenium.webdriver.common.keys import Keys

from . import core

QUICK_OPEN_GENERIC = f".quick-input-widget"
QUICK_OPEN_GENERIC_INPUT = f"{QUICK_OPEN_GENERIC} .quick-input-box input"


def select_value(context, value, **kwargs):
    element = _wait_until_opened(context, 5, is_command=False)
    core.dispatch_keys(context.driver, value, element=element)
    core.dispatch_keys(context.driver, Keys.ENTER, element=element)


def _wait_until_opened(context, retry_count=10, is_command=True):
    return core.wait_for_element(
        context.driver, QUICK_OPEN_GENERIC_INPUT, retry_count=retry_count
    )

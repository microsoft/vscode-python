# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


from selenium.webdriver.common.keys import Keys
from .base import QuickInput as BaseQuickInput, Component

QUICK_OPEN_GENERIC = f".quick-input-widget"
QUICK_OPEN_GENERIC_INPUT = f"{QUICK_OPEN_GENERIC} .quick-input-box input"


class QuickInput(BaseQuickInput, Component):
    def select_value(self, value: str, **kwargs):
        element = self._wait_until_opened(5, is_command=False)
        self.app.core.dispatch_keys(value, element=element)
        self.app.core.dispatch_keys(Keys.ENTER, element=element)

    def _wait_until_opened(self, retry_count=10, is_command=True):
        return self.app.core.wait_for_element(
            QUICK_OPEN_GENERIC_INPUT, retry_count=retry_count
        )

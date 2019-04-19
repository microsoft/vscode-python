# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


from selenium.common.exceptions import StaleElementReferenceException

import uitests.tools

from . import core


# The ui can get updated, hence retry at least 10 times.
@uitests.tools.retry(StaleElementReferenceException)
def get_output_panel_lines(context, **kwargs):
    selector = ".part.panel.bottom .view-lines .view-line span span"
    elements = core.wait_for_elements(context.driver, selector, **kwargs)
    return [element.text for element in elements]

# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


from . import core


def get_output_panel_lines(context, **kwargs):
    selector = ".part.panel.bottom .view-lines .view-line span span"

    elements = core.wait_for_elements(context.driver, selector, **kwargs)
    return [element.text for element in elements]

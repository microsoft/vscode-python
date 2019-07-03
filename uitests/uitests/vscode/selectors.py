# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

SELECTORS = {
    "STATUS_BAR_SELECTOR": {
        "stable": ".part.statusbar *[title='{}']",
        "insider": ".part.statusbar *[title='{}'] a",
    },
    "GOTO_STATUS_BAR_SELECTOR": {
        "stable": 'div.statusbar-item a[title="Go to Line"]',
        "insider": 'div.statusbar-item[title="Go to Line"] a',
    },
}


def get_selector(selector, channel="stable"):
    return SELECTORS[selector][channel] or SELECTORS[selector]["stable"]

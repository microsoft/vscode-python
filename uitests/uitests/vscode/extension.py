# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import json
import os.path

from . import core, quick_open, status_bar
from .selectors import get_selector

_localized_strings = {}


def activate_python_extension(context):
    last_error = None
    for _ in range(5):
        quick_open.select_command(context, "Activate Python Extension")
        try:
            # Sometimes it takes a while, specially on Windows.
            # So lets wait for 30 seconds.
            core.wait_for_element(
                context.driver,
                get_selector("STATUS_BAR_SELECTOR", context.options.channel).format(
                    "Py2"
                ),
                timeout=30,
            )
            break
        except Exception as ex:
            last_error = ex
            continue
    else:
        raise SystemError("Failed to activate extension") from last_error
    status_bar.wait_for_python_statusbar(context)
    _initialize_localized_strings(context)


def get_localized_string(key):
    """
    Gets a localized string from the `package.nls.json` file of the Python Extension.
    This is used to ensure we do not hardcord labels in our tests.
    """
    return _localized_strings[key]


def _initialize_localized_strings(context):
    """Load the localized strings."""
    with open(
        os.path.join(context.options.python_extension_dir, "package.nls.json"), "r"
    ) as fp:
        global _localized_strings
        _localized_strings = json.load(fp)

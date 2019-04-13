# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


from . import notifications, quick_open, status_bar


def activate_python_extension(context):
    last_error = None
    for _ in range(5):
        quick_open.select_command(context, "Activate Python Extension")
        try:
            # Sometimes it takes a while, specially on Windows.
            notifications.wait_for_message(context, "Python Extension Activated", timeout=30)
            break
        except Exception as ex:
            last_error = ex
            continue
    else:
        raise SystemError("Failed to activate extension") from last_error
    status_bar.wait_for_python_statusbar(context)
    notifications.clear(context)

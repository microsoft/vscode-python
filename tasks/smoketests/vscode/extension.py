# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


from . import documents, notifications, quick_open, status_bar


def load_python_extension(context):
    documents.create_new_untitled_file(context, "Python")
    last_error = None
    for _ in range(5):
        quick_open.select_command("Activate Python Extension")
        try:
            notifications.wait_for_message("Python Extension Activated")
            break
        except Exception as ex:
            last_error = ex
            continue
    else:
        raise SystemError("Failed to activate extension") from last_error
    status_bar.wait_for_python_statusbar(context)
    notifications.clear(context)

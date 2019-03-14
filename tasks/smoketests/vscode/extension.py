# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


from .base import BaseApplication


def load_python_extension(app: BaseApplication):
    app.documents.create_new_untitled_file("Python")
    last_error = None
    for i in range(5):
        app.quick_open.select_command("Activate Python Extension")
        try:
            app.notifications.wait_for_message("Python Extension Activated")
            break
        except Exception as ex:
            last_error = ex
            continue
    else:
        raise SystemError("Failed to activate extension") from last_error
    app.status_bar.wait_for_python_statusbar()
    app.notifications.clear()

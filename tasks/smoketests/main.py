# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os.path
from .vscode.application import Application, get_options


def start_smoketests(destination=".vscode-smoke", channel="stable", vsix="ms-python-insiders.vsix"):
    """Starts the smoke tests"""

    vsix = os.path.abspath(vsix)
    options = get_options(destination, vsix)
    app = Application.start(options=options)

    # VSC open some file
    # This is due to us not being able to control the cli args passed by the chrome driver.
    # Files get opened coz chrome driver assumes the executable is chrome,
    # however it isn't, it is VSC and those args are not recognized by VSC,
    # hence VSC assumes they are files and opens editors for those.
    # Just do 3 times, to be sure chrome driver doesn't open other files.
    app.quick_open.select_command("View: Revert and Close Editor")
    app.quick_open.select_command("View: Revert and Close Editor")
    app.quick_open.select_command("View: Revert and Close Editor")
    app.quick_open.select_command("View: Close All Editors")
    app.quick_open.select_command("View: Close Panel")
    # Do this last, some popups open a few seconds after opening VSC.
    app.quick_open.select_command("Notifications: Clear All Notifications")
    app.documents.open_file('one.py')
    import time

    time.sleep(10)
    print("Done2")

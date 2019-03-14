# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os.path
import time
from .vscode.application import Application, get_options


def start_smoketests(vscode_directory=".vscode-smoke", channel="stable", vsix="ms-python-insiders.vsix"):
    """Start the smoke tests"""
    vsix = os.path.abspath(vsix)
    options = get_options(vscode_directory, vsix)
    app = Application.start(options=options)

    # Wait for sometime, until some messages appear.
    time.sleep(2)

    # VSC open some file
    # This is due to us not being able to control the cli args passed by the chrome driver.
    # Files get opened coz chrome driver assumes the executable is chrome,
    # however it isn't, it is VSC and those args are not recognized by VSC,
    # hence VSC assumes they are files and opens editors for those.
    # Just do 3 times, to be sure chrome driver doesn't open other files.
    app.quick_open.select_command("View: Revert and Close Editor")
    app.quick_open.select_command("View: Revert and Close Editor")
    app.quick_open.select_command("View: Revert and Close Editor")
    app.quick_open.select_command("Terminal: Kill the Active Terminal Instance")
    app.quick_open.select_command("Debug: Remove All Breakpoints")
    app.quick_open.select_command("View: Close All Editors")
    app.quick_open.select_command("View: Close Panel")
    # Do this last, some popups open a few seconds after opening VSC.
    app.quick_open.select_command("Notifications: Clear All Notifications")

    return app

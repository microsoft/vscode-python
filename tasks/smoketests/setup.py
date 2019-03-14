# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import os.path
import json
import os
import time
from tasks.smoketests.vscode.application import Application, Options
from tasks.smoketests.utils.tools import run_command
from tasks.smoketests.utils.io import ensure_directory, empty_directory, copy_recursive


def start_application(options: Options):
    print("Starting application")
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
    clear_code(app)
    # Do this last, some popups open a few seconds after opening VSC.
    app.quick_open.select_command("Notifications: Clear All Notifications")

    return app


def clear_code(app: Application):
    app.quick_open.select_command("View: Revert and Close Editor")
    app.quick_open.select_command("Terminal: Kill the Active Terminal Instance")
    app.quick_open.select_command("Debug: Remove All Breakpoints")
    app.quick_open.select_command("View: Close All Editors")
    app.quick_open.select_command("View: Close Panel")
    app.quick_open.select_command("Notifications: Clear All Notifications")


def setup_workspace(source_repo: str, target: str, temp_folder: str):
    print(f"Setting up workspace folder as {target}")
    print(f"Setting up workspace folder from {source_repo}")
    empty_directory(target)
    source_folder = os.path.join(temp_folder, os.path.basename(source_repo))
    print(f"Closing repo into {source_folder}")
    _download_repo(source_repo, source_folder)
    copy_recursive(source_folder, target)
    settings_json = os.path.join(target, ".vscode", "settings.json")
    _setup_setttings_json(settings_json)


def setup_user_settings(user_folder: str, **kwargs):
    folder = os.path.join(user_folder, "User")
    ensure_directory(folder)
    settings_json = os.path.join(folder, "settings.json")
    _setup_setttings_json(settings_json)
    user_settings = kwargs.get("user_settings", None)
    if user_settings is not None:
        _update_settings(settings_json, user_settings)


def _download_repo(source_repo: str, target: str):
    if os.path.exists(target):
        return
    run_command(["git", "clone", source_repo, target])


def _setup_setttings_json(settings_json: str):
    if os.path.exists(settings_json):
        return
    with open(settings_json, "w") as file:
        file.write("{}")


def _update_settings(settings_json: str, settings: dict):
    existing_settings = {}
    if os.path.exists(settings_json):
        with open(settings_json, "r") as file:
            existing_settings = json.loads(file.read())

    with open(settings_json, "w") as file:
        existing_settings.update(settings)
        json.dump(existing_settings, file, indent=4)

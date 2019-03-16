# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import json
import os
import os.path
import sys
import time

from tasks.smoketests import tools

from . import application, extension, quick_open


def start(options):
    tools.empty_directory(options.workspace_folder)
    settings = {"python.pythonPath": sys.executable}
    setup_user_settings(options.user_dir, user_settings=settings)
    app_context = start_vscode(options)
    extension.load_python_extension(app_context)


def start_vscode(options):
    print("Starting application")
    application.setup_environment(options)
    driver = application.launch_extension(options)
    context = {"options": options, "driver": driver}
    # Wait for sometime, until some messages appear.
    time.sleep(2)

    # VSC open some file
    # This is due to us not being able to control the cli args passed by the chrome driver.
    # Files get opened coz chrome driver assumes the executable is chrome,
    # however it isn't, it is VSC and those args are not recognized by VSC,
    # hence VSC assumes they are files and opens editors for those.
    # Just do 3 times, to be sure chrome driver doesn't open other files.
    quick_open.select_command(context, "View: Revert and Close Editor")
    quick_open.select_command(context, "View: Revert and Close Editor")
    quick_open.select_command(context, "View: Revert and Close Editor")
    clear_code(context)
    # Do this last, some popups open a few seconds after opening VSC.
    quick_open.select_command(context, "Notifications: Clear All Notifications")

    return context


def clear_code(context):
    quick_open.select_command(context, "View: Revert and Close Editor")
    quick_open.select_command(context, "Terminal: Kill the Active Terminal Instance")
    quick_open.select_command(context, "Debug: Remove All Breakpoints")
    quick_open.select_command(context, "View: Close All Editors")
    quick_open.select_command(context, "View: Close Panel")
    quick_open.select_command(context, "Notifications: Clear All Notifications")


def setup_workspace(source_repo, target, temp_folder):
    print(f"Setting up workspace folder as {target}")
    print(f"Setting up workspace folder from {source_repo}")
    tools.empty_directory(target)
    source_folder = os.path.join(temp_folder, os.path.basename(source_repo))
    print(f"Closing repo into {source_folder}")
    _download_repo(source_repo, source_folder)
    tools.copy_recursive(source_folder, target)
    settings_json = os.path.join(target, ".vscode", "settings.json")
    _setup_setttings_json(settings_json)


def setup_user_settings(user_folder, **kwargs):
    folder = os.path.join(user_folder, "User")
    os.makedirs(folder, exist_ok=True)
    settings_json = os.path.join(folder, "settings.json")
    _setup_setttings_json(settings_json)
    user_settings = kwargs.get("user_settings", None)
    if user_settings is not None:
        _update_settings(settings_json, user_settings)


def _download_repo(source_repo, target):
    if os.path.exists(target):
        return
    tools.run_command(["git", "clone", source_repo, target])


def _setup_setttings_json(settings_json):
    if os.path.exists(settings_json):
        return
    with open(settings_json, "w") as file:
        file.write("{}")


def _update_settings(settings_json, settings):
    existing_settings = {}
    if os.path.exists(settings_json):
        with open(settings_json, "r") as file:
            existing_settings = json.loads(file.read())

    with open(settings_json, "w") as file:
        existing_settings.update(settings)
        json.dump(existing_settings, file, indent=4)

# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import enum
import json
import os
import pathlib
import time

import uitests.tools


class ConfigurationTarget(enum.Enum):
    user = 0
    workspace = 1
    workspace_folder = 2


def _get_workspace_file_path(context):
    file_path = os.path.join(
        context.options.workspace_folder, ".vscode", "settings.json"
    )
    _ensure_setttings_json(file_path)
    return file_path


def _get_user_file_path(context):
    file_path = os.path.join(context.options.user_dir, "User", "settings.json")
    _ensure_setttings_json(file_path)
    return file_path


def update_workspace_settings(context, settings={}):
    crud_settings = {
        "type": "workspaceFolder",
        "update": settings,
        "workspaceFolder": context.options.workspace_folder,
    }
    _send_command_to_bootstrap(context, crud_settings)


def update_user_settings(context, settings={}):
    crud_settings = {"type": "user", "update": settings}
    _send_command_to_bootstrap(context, crud_settings)


def remove_workspace_setting(context, setting):
    crud_settings = {
        "type": "workspaceFolder",
        "remove": [setting],
        "workspaceFolder": context.options.workspace_folder,
    }
    _send_command_to_bootstrap(context, crud_settings)


def remove_user_setting(context, setting):
    crud_settings = {"type": "user", "remove": [setting]}
    _send_command_to_bootstrap(context, crud_settings)


def get_user_setting(context, setting):
    return _get_setting(_get_user_file_path(context), setting)


# For some reason this throws an error on Widows.
@uitests.tools.retry(AssertionError)
def _ensure_setttings_json(settings_json):
    os.makedirs(pathlib.Path(settings_json).parent, exist_ok=True)
    if os.path.exists(settings_json):
        return
    with open(settings_json, "w") as file:
        file.write("{}")


def get_workspace_setting(context, setting):
    return _get_setting(_get_workspace_file_path(context), setting)


def _get_setting(settings_json, setting):
    _ensure_setttings_json(settings_json)
    existing_settings = {}
    with open(settings_json, "r") as file:
        existing_settings = json.loads(file.read())

    return existing_settings.get(setting)


def _send_command_to_bootstrap(context, crud_settings):
    """Let the bootstrap extension update the settings. This way VSC will be aware of it and extensions
    will get the right values. If we update the file directly then VSC might not get notified immediately.
    We'll let the bootstrap extension update the settings and delete the original file.
    When the file has been deleted we know the settings have been updated and VSC is aware of the updates.

    """
    instructions_file = os.path.join(
        context.options.extensions_dir, "settingsToUpdate.txt"
    )
    error_file = os.path.join(
        context.options.extensions_dir, "settingsToUpdate_error.txt"
    )
    if os.path.exists(error_file):
        os.remove(error_file)
    with open(instructions_file, "w") as fp:
        json.dump(crud_settings, fp, indent=4)

    uitests.vscode.quick_open.select_command(context, "Smoke: Update Settings")
    uitests.vscode.application.capture_screen(context)
    # Wait for 5 seconds for settings to get updated.
    # If file has been deleted then yes it has been updated, else error
    for i in range(10):
        if not os.path.exists(instructions_file):
            return
        time.sleep(0.5)
        uitests.vscode.application.capture_screen(context)

    error_message = ""
    if os.path.exists(error_file):
        with open(error_file, "r") as fp:
            error_message += fp.read()
        with open(instructions_file, "r") as fp:
            error_message += fp.read()
    raise SystemError(f"Settings not updated by Bootstrap\n {error_message}")

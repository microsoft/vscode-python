# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import logging
import os
import os.path
import time

from selenium import webdriver

import uitests.tools
from dataclasses import dataclass

from . import application, extension, quick_open, settings

CONTEXT = {"driver": None}


@dataclass
class Context:
    options: application.Options
    driver: webdriver.Chrome


def start(options):
    logging.debug("Starting VS Code")
    uitests.tools.empty_directory(options.workspace_folder)
    user_settings = {
        "python.pythonPath": options.python_path,
        "python.venvFolders": ["envs", ".pyenv", ".direnv", ".local/share/virtualenvs"],
    }
    setup_user_settings(options.user_dir, user_settings=user_settings)
    return launch(options)


def launch(options):
    app_context = _start_vscode(options)
    CONTEXT["driver"] = app_context.driver
    extension.activate_python_extension(app_context)
    return app_context


def _start_vscode(options):
    application.setup_environment(options)
    driver = application.launch_extension(options)
    context = Context(options, driver)
    # Wait for VSC to startup.
    time.sleep(2)
    return context


def reload(context):
    logging.debug("Reloading VS Code")
    application.exit(context)
    app_context = launch(context.options)
    context.driver = app_context.driver
    CONTEXT["driver"] = context.driver
    # clear_everything(app_context)
    return app_context


def clear_everything(context):
    quick_open.select_command(context, "View: Revert and Close Editor")
    quick_open.select_command(context, "Terminal: Kill the Active Terminal Instance")
    quick_open.select_command(context, "Debug: Remove All Breakpoints")
    quick_open.select_command(context, "View: Close All Editors")
    quick_open.select_command(context, "View: Close Panel")
    quick_open.select_command(context, "Notifications: Clear All Notifications")


def reset_workspace(context):
    workspace_folder = context.options.workspace_folder
    if getattr(context, "workspace_repo", None) is None:
        uitests.tools.empty_directory(workspace_folder)
    else:
        logging.debug(f"Resetting workspace folder")
        uitests.tools.run_command(
            ["git", "reset", "--hard"], cwd=workspace_folder, silent=True
        )
        uitests.tools.run_command(
            ["git", "clean", "-fd"], cwd=workspace_folder, silent=True
        )

    settings_json = os.path.join(workspace_folder, ".vscode", "settings.json")
    settings.update_settings(settings_json)


def setup_workspace(source_repo, target, temp_folder):
    logging.debug(f"Setting up workspace folder from {source_repo}")
    uitests.tools.empty_directory(target)
    uitests.tools.run_command(
        ["git", "clone", source_repo, "."], cwd=target, silent=True
    )
    settings_json = os.path.join(target, ".vscode", "settings.json")
    settings.update_settings(settings_json)


def setup_user_settings(user_folder, **kwargs):
    folder = os.path.join(user_folder, "User")
    os.makedirs(folder, exist_ok=True)
    settings_json = os.path.join(folder, "settings.json")
    user_settings = kwargs.get("user_settings", None)
    if user_settings is not None:
        settings.update_settings(settings_json, user_settings)

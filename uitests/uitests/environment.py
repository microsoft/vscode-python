# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os.path

import behave
import parse

import uitests.tools
import uitests.vscode
import uitests.vscode.settings
import uitests.vscode.startup


@parse.with_pattern(r"\d+")
def parse_number(text):
    return int(text)


behave.register_type(Number=parse_number)


def before_all(context):
    options = uitests.vscode.application.get_options(**context.config.userdata)
    app_context = uitests.vscode.startup.start(options)
    uitests.vscode.startup.clear_everything(app_context)
    context.driver = app_context.driver
    context.options = app_context.options
    context.workspace_repo = None


def after_all(context):
    context.driver = uitests.vscode.startup.CONTEXT["driver"]
    uitests.vscode.application.exit(context)


def before_feature(context, feature):
    context.driver = uitests.vscode.startup.CONTEXT["driver"]
    repo = [tag for tag in feature.tags if tag.startswith("git://github.com/")]
    uitests.tools.empty_directory(context.options.workspace_folder)
    if repo:
        context.workspace_repo = repo[0]
        uitests.vscode.startup.setup_workspace(
            repo[0], context.options.workspace_folder, context.options.temp_folder
        )
    else:
        context.workspace_repo = None


def before_scenario(context, scenario):
    # Restore `drive`, as behave will overwrite with original value.
    # Note, its possible we have a new driver instance due to reloading of VSC.
    context.driver = uitests.vscode.startup.CONTEXT["driver"]
    context.options = uitests.vscode.application.get_options(**context.config.userdata)

    # Restore python.pythonPath in user & workspace settings.
    settings_json = os.path.join(context.options.user_dir, "User", "settings.json")
    # workspace_settings_json = os.path.join(
    #     context.options.workspace_folder, ".vscode", "settings.json"
    # )
    uitests.vscode.settings.update_settings(
        settings_json, {"python.pythonPath": context.options.python_path}
    )
    # uitests.vscode.settings.update_settings(
    #     workspace_settings_json, {"python.pythonPath": context.options.python_path}
    # )

    # We want this open so it can get captured in screenshots.
    uitests.vscode.quick_open.select_command(context, "View: Show Explorer")
    uitests.vscode.startup.clear_everything(context)
    if "preserve.workspace" not in scenario.tags:
        uitests.vscode.startup.reset_workspace(context)
        # uitests.vscode.startup.reload(context)


def after_scenario(context, feature):
    uitests.vscode.notifications.clear(context)


def after_step(context, step):
    if step.exception is not None:
        uitests.vscode.application.capture_screen(context)

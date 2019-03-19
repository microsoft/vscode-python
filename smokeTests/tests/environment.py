# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import tests


def before_all(context):
    print("context.config.userdata")
    print(context.config.userdata)
    options = tests.vscode.application.get_options(**context.config.userdata)
    try:
        app_context = tests.vscode.setup.start(options)
        context.driver = app_context.driver
        context.options = app_context.options
    except Exception:
        import traceback

        traceback.print_exc


def after_all(context):
    tests.vscode.application.exit(context)


def before_feature(context, feature):
    repo = [tag for tag in feature.tags if tag.startswith("https://")]
    tests.tools.empty_directory(context.options.workspace_folder)
    if len(repo) == 1:
        tests.vscode.setup.setup_workspace(
            repo[0], context.options.workspace_folder, context.options.temp_folder
        )


def before_scenario(context, feature):
    context.options = tests.vscode.application.get_options(**context.config.userdata)
    tests.tools.empty_directory(context.options.workspace_folder)
    tests.vscode.setup.clear_code(context)


def after_scenario(context, feature):
    if feature.exception is not None:
        tests.vscode.application.capture_screen(context)
    tests.vscode.notifications.clear(context)


def after_step(context, step):
    if step.exception is not None:
        tests.vscode.application.capture_screen(context)
    print("Hello")

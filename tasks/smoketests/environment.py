# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


from tasks.smoketests import tools
from tasks.smoketests.vscode import application, setup


def before_all(context):
    options = application.get_options(**context.config.userdata)
    app_context = setup.start(options)
    context.update(app_context)


def after_all(context):
    application.exit(context)


def before_feature(context, feature):
    repo = [tag for tag in feature.tags if tag.startswith("https://")]
    tools.empty_directory(context.options.workspace_folder)
    if len(repo) == 1:
        setup.setup_workspace(
            repo[0], context.options.workspace_folder, context.options.temp_folder
        )


def before_scenario(context, feature):
    context.options = application.get_options(**context.config.userdata)
    tools.empty_directory(context.options.workspace_folder)
    setup.clear_code(context.app)


def after_scenario(context, feature):
    context.app.notifications.clear()

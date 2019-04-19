# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os.path

import behave

import uitests.vscode.settings


@behave.given('the workspace setting "{name}" has the value "{value}"')
def given_workspace_setting(context, name, value):
    uitests.vscode.settings.update_workspace_settings(context, {name: value})


@behave.given('the workspace setting "{name}" is enabled')
def given_workspace_setting_enabled(context, name):
    uitests.vscode.settings.update_workspace_settings(context, {name: True})


@behave.given('the workspace setting "{name}" is disabled')
def given_workspace_setting_disabled(context, name):
    uitests.vscode.settings.update_workspace_settings(context, {name: False})


@behave.given('the user setting "{name}" is disabled')
def given_user_setting_disabled(context, name):
    settings_json = os.path.join(context.options.user_dir, "User", "settings.json")
    uitests.vscode.settings.update_settings(settings_json, {name: False})


@behave.when('I update the workspace setting "{name}" with the value "{value}"')
def given_workspace_setting_value(context, name, value):
    uitests.vscode.settings.update_workspace_settings(context, {name: value})


@behave.when('I enable the workspace setting "{name}"')
def when_workspace_setting_enable(context, name):
    uitests.vscode.settings.update_workspace_settings(context, {name: True})


@behave.when('I disable the workspace setting "{name}"')
def when_workspace_setting_disable(context, name):
    uitests.vscode.settings.update_workspace_settings(context, {name: False})


@behave.given('the workspace setting "{name}" does not exist')
def given_workspace_setting_is_removed(context, name):
    uitests.vscode.settings.remove_workspace_setting(context, name)


@behave.given('the user setting "{name}" does not exist')
def given_user_setting_is_removed(context, name):
    uitests.vscode.settings.remove_user_setting(context, name)


@behave.given('the user setting "{name}" exists')
def given_user_setting_is_not_empty(context, name):
    settings_json = os.path.join(context.options.user_dir, "User", "settings.json")
    current_value = uitests.vscode.settings.get_setting(settings_json, name)
    assert current_value is not None


@behave.when('I remove the workspace setting "{name}"')
def when_workspace_setting_is_removed(context, name):
    uitests.vscode.settings.remove_workspace_setting(context, name)


@behave.then('the workspace setting "{name}" is enabled')
def then_workspace_setting_enabled(context, name):
    settings_json = os.path.join(
        context.options.workspace_folder, ".vscode", "settings.json"
    )
    assert uitests.vscode.settings.get_setting(settings_json, name) is True


@behave.then('the workspace setting "{name}" is disabled')
def then_workspace_setting_disabled(context, name):
    settings_json = os.path.join(
        context.options.workspace_folder, ".vscode", "settings.json"
    )
    assert uitests.vscode.settings.get_setting(settings_json, name) is False


@behave.then('the workspace setting "{name}" is "{value}"')
def then_workspace_setting_value(context, name, value):
    settings_json = os.path.join(
        context.options.workspace_folder, ".vscode", "settings.json"
    )
    assert uitests.vscode.settings.get_setting(settings_json, name) == value


@behave.then('the workspace setting "{name}" contains the value "{value}"')
def then_workspace_setting_contains_value(context, name, value):
    settings_json = os.path.join(
        context.options.workspace_folder, ".vscode", "settings.json"
    )
    assert value in uitests.vscode.settings.get_setting(settings_json, name)


@behave.then('the workspace setting "{name}" exists')
def then_workspace_setting_is_defined(context, name):
    settings_json = os.path.join(
        context.options.workspace_folder, ".vscode", "settings.json"
    )
    assert uitests.vscode.settings.get_setting(settings_json, name) is not None

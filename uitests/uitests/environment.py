# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import logging
import os
import os.path
import re
import shutil
import time
from functools import wraps

import behave
import behave.model_core
import parse
from behave.contrib.scenario_autoretry import patch_scenario_with_autoretry
from selenium.common.exceptions import WebDriverException

import uitests.tools
import uitests.vscode
import uitests.vscode.core
import uitests.vscode.extension
import uitests.vscode.settings


@parse.with_pattern(r"\d+")
def parse_number(text):
    return int(text)


behave.register_type(Number=parse_number)


def restore_context():
    """The context object gets created a new for every test.
    We need to ensure we keep adding the required items.
    We need to update the `driver` and `options` property of the context.
    Note, its possible we have a new driver instance due to reloading of VSC.
    This needs to be done for every hook.

    """

    def deco_context(f):
        @wraps(f)
        def f_restore_context(*args, **kwargs):
            context = args[0]
            context.driver = uitests.vscode.application.CONTEXT["driver"]
            context.options = uitests.vscode.application.CONTEXT["options"]
            return f(*args, **kwargs)

        return f_restore_context

    return deco_context

@uitests.tools.trace
@uitests.tools.retry((TimeoutError, WebDriverException), tries=5, delay=5)
@uitests.tools.log_exceptions()
def before_all(context):
    options = uitests.vscode.application.get_options(**context.config.userdata)
    # Exit before retrying.
    _exit(context)
    _start_and_clear(context, options)


@uitests.tools.trace
def after_all(context):
    _exit(context)


@uitests.tools.trace
def before_feature(context, feature):
    for scenario in feature.scenarios:
        # If we're working on a scenario, then don't retry.
        if "wip" in scenario.effective_tags:
            continue
        elif "autoretry" in scenario.effective_tags:
            patch_scenario_with_autoretry(scenario, max_attempts=3)
        else:
            # Try at least once.
            # We might want to remove this, but leave it for now.
            # VSC can be flaky at times, here are a few examples:
            # 1. Line number isn't displayed in statusbar of VSC.
            # 2. Invoking `Close All Editors`, doesn't necessarily close everything.
            # 3. Other flaky issues.
            # 4. Download speeds are slow and LS doesn't get downloaded.
            # 5. Starting LS/Jedi is slow for some reason, and go-to-definition is slow/doesn't work.
            # 6. Similar intellisense is slow/doesn't work on both Jedi & LS.
            # We might want to log these as well, so we're aware of the flaky tests.
            patch_scenario_with_autoretry(scenario, max_attempts=2)


@uitests.tools.trace
@uitests.tools.retry((PermissionError, FileNotFoundError), tries=2)
@uitests.tools.log_exceptions()
@restore_context()
def before_scenario(context, scenario):
    """Note:
    - Create new workspace folders for each test.
    - Shutdown and start vscode for every test.

    Reasons:
    - Its alsmost impossible to use the same folder in Windows, as we cannot delete files.
     If VSC is open, Windows won't let us delete files... etc.
    - More VSC issue is `recent files`.
     Assume we open a workspace folder with a file named `hello.py`.
     We open the file for a test.
     Next we open another workspace folder for another test with a file named `some folder/hello.py`.
     Now VSC remembers the files it opened previously (`recent files`).
     So, when we attempt to open files using just file name, then VSC attempts to open `hello.py
     instead of `some folder/hello.py`. At this point, VSC displays an error message to the user.
     However this is not desired in our tests. Hence just create a new folder.
     - As we need to create new folders, and sometimes we have a few flaky issues with selenium,
     its easier to just start vs code evertime.

    """
    _exit(context)

    repo = [
        tag
        for tag in scenario.effective_tags
        if tag.lower().startswith("https://github.com/")
    ]
    uitests.vscode.application.setup_workspace(context, repo[0] if repo else None)

    # Create directory for scenario specific logs.
    context.scenario_log_dir = os.path.join(
        context.options.reports_dir,
        scenario.filename,
        re.sub("[^-a-zA-Z0-9_. ]+", "", scenario.name).strip(),
    ).replace("/", os.path.sep)
    os.makedirs(context.scenario_log_dir, exist_ok=True)
    # Ensure screenshots go here.
    context.options.screenshots_dir = os.path.join(
        context.scenario_log_dir, "screenshots"
    )
    os.makedirs(context.options.screenshots_dir, exist_ok=True)

    # Restore user settings (could have been changed for tests)
    uitests.vscode.application.setup_user_settings(context.options)

    # Always reload, as we create a new workspace folder.
    uitests.vscode.application.reload(context)

    # Possible we restarted VSC, so ensure we clear the onetime messages.
    _dismiss_one_time_messages(context, retry_count=2)


@uitests.tools.trace
@uitests.tools.log_exceptions()
@restore_context()
def after_scenario(context, scenario):
    try:
        # Clear before the next test.
        uitests.vscode.application.clear_everything(context)
    except Exception:
        pass
    _exit(context)

    if scenario.status == behave.model_core.Status.passed:
        try:
            # If passed successfully, then delete screenshots of each step.
            # Save space in logs captured (else logs/artifacts would be too large on CI).
            # By default the screenshots directory is included into reports
            # If tests pass, then no need of the screenshots.
            uitests.tools.empty_directory(
                os.path.join(context.options.screenshots_dir, "steps")
            )
        except Exception:
            pass
    else:
        # Copy all logs & current workspace into scenario specific directory.
        copy_folders = [
            (context.options.logfiles_dir, "logs"),
            (os.path.join(context.options.user_dir, "logs"), "user_logs"),
            (context.options.workspace_folder, "workspace"),
        ]
        for source, target in copy_folders:
            try:
                shutil.copytree(source, os.path.join(context.scenario_log_dir, target))
            except Exception:
                pass
        # We need user settings as well for logs.
        # When running a test that requires us to test loading VSC for the first time,
        # (the step is `I open VS Code for the first time`)
        # then we delete this user settings file (after all this shouldn't exist when loading VSC for first time).
        # However, if the test fails half way through, then the settings.json will not exist.
        # Hence check if the file exists.
        if os.path.exists(
            os.path.join(context.options.user_dir, "User", "settings.json")
        ):
            os.makedirs(os.path.join(context.scenario_log_dir, "User"), exist_ok=True)
            shutil.copyfile(
                os.path.join(context.options.user_dir, "User", "settings.json"),
                os.path.join(context.scenario_log_dir, "User", "settings.json"),
            )
    # We don't need these logs anymore.
    _exit(context)
    uitests.tools.empty_directory(context.options.logfiles_dir)
    uitests.tools.empty_directory(os.path.join(context.options.user_dir, "logs"))
    os.makedirs(context.options.logfiles_dir, exist_ok=True)


@uitests.tools.trace
@uitests.tools.log_exceptions()
@restore_context()
def before_step(context, step):
    logging.info("Before step")


@uitests.tools.trace
@uitests.tools.log_exceptions()
@restore_context()
def after_step(context, step):
    logging.info("After step")

    # Lets take screenshots after every step for logging purposes.
    # If the scenario passes, then delete all screenshots.
    # These screenshots are captured into a special directory.
    try:
        # This is a hack, hence handle any error.
        step_index = context._stack[0]["scenario"].steps.index(step)
        screenshot_file_name = os.path.join(
            context.options.screenshots_dir, "steps", f"step_{step_index}.png"
        )
        os.makedirs(
            os.path.join(context.options.screenshots_dir, "steps"), exist_ok=True
        )
        uitests.vscode.application.capture_screen_to_file(context, screenshot_file_name)
    except Exception:
        pass

    # If this is the last step, then add a screenshot.
    # This is just for reporting purposes. I.e. take screenshots after every test.
    add_screenshot = False
    try:
        # This is a hack, hence handle any error.
        add_screenshot = context._stack[0]["scenario"].steps[-1:][0] == step
    except Exception:
        pass

    if add_screenshot or step.exception is not None:
        try:
            uitests.vscode.application.capture_screen(context)
            # # We might want folder view in screenshots as well.
            # uitests.vscode.quick_open.select_command(context, "View: Show Explorer")
            # uitests.vscode.application.capture_screen(context)
            # # We might want panels without
            # uitests.vscode.notifications.clear()
            # uitests.vscode.application.capture_screen(context)
        except Exception:
            # Possible vsc has died as part of the exception.
            # Or we closed it as part of a step.
            pass

    # Attach the traceback (behave doesn't add tb if assertions have an error message)
    if step.exception is not None:
        try:
            uitests.vscode.application.capture_exception(context, step)
        except Exception:
            pass


@uitests.tools.trace
@restore_context()
def _exit(context):
    uitests.vscode.application.exit(context)
    uitests.vscode.application.CONTEXT["driver"] = None


@uitests.tools.trace
def _start_and_clear(context, options):
    # Clear VS Code folders (do not let VSC save state).
    # During tests, this can be done as a step `When I load VSC for the first time`.
    # But when starting tests from scratch, always start fresh.
    uitests.vscode.application.clear_vscode(options)

    app_context = uitests.vscode.application.start(options)
    context.driver = app_context.driver
    context.options = app_context.options

    try:
        # For VS Code to start displaying messages, we need to perform some UI operations.
        # Right now, loading extension does that.
        # Ensure extension loads
        # Also loading extensions will display extension messages which we can close.
        uitests.vscode.extension.activate_python_extension(context)

        _dismiss_one_time_messages(context)
    except Exception:
        try:
            uitests.vscode.application.capture_screen_to_file(
                context, os.path.join(options.reports_dir, "Start_Clear_Failed.png")
            )
        except Exception:
            pass
        raise


@uitests.tools.trace
def _dismiss_one_time_messages(context, retry_count=100, retry_interval=0.1):
    # Dismiss one time VSC messages.
    # Dismiss one time extension messages.
    # Append to previous messages, possibly they weren't dimissed as they timed out.
    messages_to_dismiss = [
        ("Help improve VS Code by allowing",),
        ("Tip: you can change the Python interpreter", "Got it!"),
    ]

    # Using the step `I open VS Code for the first time` will ensure these messages
    #   get displayed again. Check out application.clear_vscode()
    # We don't care if we are unable to dismiss these messages.
    for i in range(retry_count):
        message = messages_to_dismiss.pop(0)

        try:
            uitests.vscode.notifications.dismiss_message(
                context, *message, retry_count=1, retry_interval=0.1
            )
        except Exception:
            # Re-queue to try and dismiss it again.
            messages_to_dismiss.append(message)
            # Wait for message to appear.
            time.sleep(0.5)

        if len(messages_to_dismiss) == 0:
            break

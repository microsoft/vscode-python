# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import logging
import os.path
import pathlib
import re
import time
import traceback
from urllib.parse import quote

from selenium.webdriver.common.keys import Keys

import uitests.tools
import uitests.vscode.application
import uitests.vscode.core
import uitests.vscode.debugger
import uitests.vscode.quick_open
import uitests.vscode.testing

from . import core, quick_input, quick_open

LINE_COLUMN_REGEX = re.compile("Ln (?P<line>\d+), Col (?P<col>\d+)")
LINE_COLUMN_REGEX_FROM_PY_STATUS_BAR = re.compile("(?P<line>\d+),(?P<col>\d+)")
LINE_REGEX_FROM_GOTO_LABEL = re.compile("Current Line: (?P<line>\d+). Type a .*")


def is_explorer_sidebar_visible(context):
    try:
        uitests.vscode.core.wait_for_element(
            context.driver, ".composite.viewlet.explorer-viewlet", retry_count=2
        )
        return True
    except TimeoutError:
        return False


def _refresh_file_explorer(context):
    # Check what explorer is currently visible
    is_debug_explorer_visbile = uitests.vscode.debugger.is_debugg_sidebar_visible(
        context
    )
    if not is_debug_explorer_visbile:
        is_test_explorer_visbile = uitests.vscode.testing.is_explorer_sidebar_visible(
            context
        )

    # Refresh the explorer, its possible a new file was created, we need to ensure
    # VSC is aware of this. Else opening files in vsc fails.
    # Note: This will cause explorer to be displayed.
    uitests.vscode.quick_open.select_command(context, "File: Refresh Explorer")
    # Wait for explorer to get refreshed.
    time.sleep(0.5)

    if is_debug_explorer_visbile:
        uitests.vscode.quick_open.select_command(context, "View: Show Debug")
    if is_test_explorer_visbile:
        uitests.vscode.quick_open.select_command(context, "View: Show Test")


@uitests.tools.retry(TimeoutError, tries=5)
def open_file(context, filename):
    _refresh_file_explorer(context)
    quick_open.select_command(context, "Go to File...")
    quick_open.select_value(context, filename)
    _wait_for_editor_focus(context, filename)


def is_file_open(context, filename, **kwargs):
    _wait_for_active_tab(context, filename, **kwargs)
    _wait_for_editor_focus(context, filename)


def create_file_with_contents(context, filename, text):
    os.makedirs(
        pathlib.Path(os.path.join(context.options.workspace_folder, filename)).parent,
        exist_ok=True,
    )
    with open(os.path.join(context.options.workspace_folder, filename), "w") as file:
        file.write("")

    try:
        # Using `core.dispatch_keys(context.driver, text)` will not always work, as its the same as typing in editor.
        # Sometimes VSC takes over and completes text, such as brackets (auto completion items).
        # Hence the solution is to open the file and paste the text into the editor (without typing it out).
        # This could bomb out, in case we're unable to copy to the clipboard.
        uitests.tools.copy_to_clipboard(text)
        open_file(context, filename)
        _wait_for_editor_focus(context, filename)
        quick_open.select_command(context, "Paste")
    except Exception:
        open_file(context, filename)
        _wait_for_editor_focus(context, filename)
        # Just update the file manually.
        with open(
            os.path.join(context.options.workspace_folder, filename), "w"
        ) as file:
            file.write(text)
        # Let VSC see the changes (dirty hack, but this is a fallback).
        time.sleep(1)

    quick_open.select_command(context, "File: Save")
    quick_open.select_command(context, "View: Close Editor")


def create_new_untitled_file_with_contents(context, text):
    quick_open.select_command(context, "File: New Untitled File")
    _wait_for_editor_focus(context, "Untitled-1")
    core.dispatch_keys(context.driver, text)


def create_new_untitled_file(context, language="Python"):
    quick_open.select_command(context, "File: New Untitled File")
    _wait_for_editor_focus(context, "Untitled-1")
    quick_open.select_command(context, "Change Language Mode")
    quick_input.select_value(context, language)


def change_document_language(context, language="Python"):
    quick_open.select_command(context, "Change Language Mode")
    quick_input.select_value(context, language)


def scroll_to_top(context):
    go_to_line(context, 1)


def go_to_line(context, line_number):
    quick_open.select_command(context, "Go to Line...")
    quick_open.select_value(context, str(line_number))
    _wait_for_line(context, line_number)


@uitests.tools.retry(AssertionError, tries=5)
def go_to_line_column(context, line_number, column):
    go_to_line(context, line_number)
    for i in range(column - 1):
        core.dispatch_keys(context.driver, Keys.RIGHT)
        time.sleep(0.1)

    try:
        position = get_current_position(context)
        assert position == (
            line_number,
            column,
        ), f"{position} != ({line_number}, {column})"
    except Exception:
        logging.info(
            f"Failed to get position using get_current_position, assuming column is as expected, {traceback.format_exc()}"  # noqa
        )
        # Some times VSC does not display the line numbers in the status bar.
        # Got some screenshots from CI where this has happened (for over 10 seconds no line line in statusbar!!!).
        # As a fallback, use another CSS query.
        # If the line number is equal, assume the column number is what's expected as well.
        line = get_current_line(context)
        assert line == line_number


@uitests.tools.retry((AssertionError, ValueError), tries=2)
def get_current_line(context):
    try:
        position = get_current_position(context, retry_count=30, retry_interval=0.1)
        return position[0]
    except Exception:
        uitests.vscode.application.capture_screen_to_file(
            context, prefix="get_position_failed_1"
        )
        logging.info(
            f"Failed to get position using get_current_position, {traceback.format_exc()}"
        )

    try:
        # Some times VSC does not display the line numbers in the status bar.
        # Got some screenshots from CI where this has happened (for over 10 seconds no line line in statusbar!!!).
        # As a fallback, use another CSS query.
        selector = ".part.statusbar .statusbar-item.left.statusbar-entry a[title='Py2']"
        element = core.wait_for_element(
            context.driver, selector, retry_count=30, retry_interval=0.1
        )
        match = LINE_COLUMN_REGEX_FROM_PY_STATUS_BAR.match(element.text)
        if match is None:
            raise ValueError(f"Unable to detemrine line & column")
        return int(match.group("line")), int(match.group("col"))
    except Exception:
        uitests.vscode.application.capture_screen_to_file(
            context, prefix="get_line_failed_2"
        )
        logging.info(
            f"Failed to get position using Bootstrap extension, {traceback.format_exc()}"
        )

    try:
        # Some times VSC does not display the line numbers in the status bar.
        # Got some screenshots from CI where this has happened (for over 10 seconds no line line in statusbar!!!).
        # As a fallback, use another CSS query.
        selector = ".quick-open-entry .quick-open-row a.label-name span span"
        element = core.wait_for_element(
            context.driver, selector, retry_count=30, retry_interval=0.1
        )
        return int(element.text.strip())
    except Exception:
        uitests.vscode.application.capture_screen_to_file(
            context, prefix="get_line_failed_3"
        )
        logging.info(
            f"Failed to get position using editor highlighted line, {traceback.format_exc()}"
        )

    # Try to go to a line, the popup that appears contains the current line number.
    element = uitests.vscode.quick_open._open(context, "Go to Line...")
    try:
        selector = ".margin .margin-view-overlays .current-line + .line-numbers"
        element = core.wait_for_element(
            context.driver, selector, retry_count=30, retry_interval=0.1
        )
        match = LINE_REGEX_FROM_GOTO_LABEL.match(element.text)
    except Exception:
        uitests.vscode.application.capture_screen_to_file(
            context, prefix="get_line_goto_failed_4"
        )
        logging.info(
            f"Failed to get position using Go to line, {traceback.format_exc()}"
        )
    finally:
        # Close the go to line, prompt
        core.dispatch_keys(context.driver, Keys.ESCAPE, element=element)

    if match is None:
        raise ValueError(f"Unable to detemrine line from Go to label")
    return int(match.group("line"))


def get_current_position(context, **kwargs):
    selector = 'div.statusbar-item a[title="Go to Line"]'
    element = core.wait_for_element(context.driver, selector, **kwargs)
    match = LINE_COLUMN_REGEX.match(element.text)
    if match is None:
        raise ValueError(f"Unable to detemrine line & column")
    return int(match.group("line")), int(match.group("col"))


def send_text_to_editor(context, filename, text):
    """Send text to the editor."""
    selector = f'.monaco-editor[data-uri$="{quote(filename)}"] textarea'
    element = core.wait_for_element(context.driver, selector)
    core.dispatch_keys(context.driver, text, element=element)


def get_completion_list(context):
    selector = ".editor-widget.suggest-widget.visible .monaco-list-row a.label-name .monaco-highlighted-label"
    elements = core.wait_for_elements(context.driver, selector)
    return [element.text for element in elements]


@uitests.tools.retry(AssertionError, tries=15, delay=1)
def _wait_for_line(context, line_number):
    line = get_current_position(context)
    assert line[0] == line_number, f"{line[0]} != {line_number}"


def _wait_for_active_tab(context, filename, is_dirty=False):
    """Wait till a tab is active with the given file name."""
    dirty_class = ".dirty" if is_dirty else ""
    dirty_class = ""
    filename = os.path.basename(filename)
    selector = f'.tabs-container div.tab.active{dirty_class}[aria-selected="true"][aria-label="{filename}, tab"]'
    core.wait_for_element(context.driver, selector)


def _wait_for_active_editor(context, filename, is_dirty=False):
    """Wait till an editor with the given file name is active."""
    selector = (
        f'.editor-instance .monaco-editor[data-uri$="{quote(filename)}"] textarea'
    )
    core.wait_for_element(context.driver, selector)


def _wait_for_editor_focus(context, filename, is_dirty=False, **kwargs):
    """Wait till an editor with the given file name receives focus."""
    _wait_for_active_tab(context, filename, is_dirty, **kwargs)
    _wait_for_active_editor(context, filename, is_dirty, **kwargs)

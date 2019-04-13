# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import re
import time
from urllib.parse import quote

from . import core, quick_input, quick_open

LINE_COLUMN_REGEX = re.compile("Ln (?P<line>\d+), Col (?P<col>\d+)")


def open_file(context, filename):
    last_exception = None
    for _ in range(5):
        try:
            quick_open.select_command(context, "Go to File...")
            quick_open.select_value(context, filename)
            _wait_for_editor_focus(context, filename)
            return
        except TimeoutError as ex:
            last_exception = ex
    else:
        raise last_exception


def is_file_open(context, filename, **kwargs):
    _wait_for_active_tab(context, filename, **kwargs)
    _wait_for_editor_focus(context, filename)


def create_new_untitled_file(context, language="Python"):
    quick_open.select_command(context, "File: New Untitled File")
    _wait_for_editor_focus(context, "Untitled-1")
    quick_open.select_command(context, "Change Language Mode")
    quick_input.select_value(context, language)


def scroll_to_top(context):
    go_to_line(context, 1)


def go_to_line(context, line_number):
    quick_open.select_command(context, "Go to Line...")
    quick_open.select_value(context, str(line_number))


def get_current_position(context):
    selector = "a.editor-status-selection"
    element = core.wait_for_element(context.driver, selector)
    match = LINE_COLUMN_REGEX.match(element.text)
    if match is None:
        raise ValueError(f"Unable to detemrine line & column")
    return int(match.group("line")), int(match.group("col"))


def _wait_for_active_tab(context, filename, is_dirty=False):
    """Wait till a tab is active with the given file name."""
    dirty_class = ".dirty" if is_dirty else ""
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

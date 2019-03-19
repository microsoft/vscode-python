# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


from urllib.parse import quote

from selenium.webdriver.common.keys import Keys

from . import core, quick_input, quick_open


def open_file(context, filename: str):
    element = quick_open.open(filename)
    core.dispatch_keys(context.driver, Keys.ENTER, element=element)
    _wait_for_editor_focus(filename)


def is_file_open(context, filename: str, **kwargs):
    _wait_for_active_tab(filename, **kwargs)
    _wait_for_editor_focus(filename)


def create_new_untitled_file(context, language="Python"):
    quick_open.select_command(context, "File: New Untitled File")
    _wait_for_editor_focus(context, "Untitled-1")
    quick_open.select_command(context, "Change Language Mode")
    quick_input.select_value(context, language)


def scroll_to_top(context, self):
    quick_open.select_command(context, "Go to Line...")
    quick_open.select_value(context, "1")


def _wait_for_active_tab(context, filename: str, is_dirty=False):
    dirty_class = ".dirty" if is_dirty else ""
    selector = f'.tabs-container div.tab.active{dirty_class}[aria-selected="true"][aria-label="{filename}, tab"]'
    core.wait_for_element(context.driver, selector)


def _wait_for_active_editor(context, filename: str, is_dirty=False):
    selector = (
        f'.editor-instance .monaco-editor[data-uri$="{quote(filename)}"] textarea'
    )
    core.wait_for_element(context.driver, selector)


def _wait_for_editor_focus(context, filename: str, is_dirty=False, **kwargs):
    _wait_for_active_tab(context, filename, is_dirty, **kwargs)
    _wait_for_active_editor(context, filename, is_dirty, **kwargs)

# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


from selenium.webdriver.common.keys import Keys
from urllib.parse import quote
from .base import Documents as BaseDocuments, Component


class Documents(BaseDocuments, Component):
    def open_file(self, filename: str, **kwargs):
        element = self.app.quick_open.open(filename)
        self.app.core.dispatch_keys(Keys.ENTER, element=element)
        self._wait_for_editor_focus(filename)

    def is_file_open(self, filename: str, **kwargs):
        self._wait_for_active_tab(filename, **kwargs)
        self._wait_for_editor_focus(filename)

    def create_new_untitled_file(self, language="Python", **kwargs):
        self.app.quick_open.select_command("File: New Untitled File")
        self._wait_for_editor_focus("Untitled-1")
        self.app.quick_open.select_command("Change Language Mode")
        self.app.quick_input.select_value(language)

    def scroll_to_top(self, **kwargs):
        self.app.quick_open.select_command("Go to Line...")
        self.app.quick_open.select_value("1")

    def _wait_for_active_tab(self, filename: str, is_dirty=False, **kwargs):
        dirty_class = ".dirty" if is_dirty else ""
        selector = f'.tabs-container div.tab.active{dirty_class}[aria-selected="true"][aria-label="{filename}, tab"]'
        self.app.core.wait_for_element(selector)

    def _wait_for_active_editor(self, filename: str, is_dirty=False, **kwargs):
        selector = (
            f'.editor-instance .monaco-editor[data-uri$="{quote(filename)}"] textarea'
        )
        self.app.core.wait_for_element(selector)

    def _wait_for_editor_focus(self, filename: str, is_dirty=False, **kwargs):
        self._wait_for_active_tab(filename, is_dirty, **kwargs)
        self._wait_for_active_editor(filename, is_dirty, **kwargs)

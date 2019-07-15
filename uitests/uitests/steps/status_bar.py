# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import behave
from selenium.common.exceptions import StaleElementReferenceException

import uitests.vscode.status_bar
import uitests.tools


@behave.then(
    'the python interpreter displayed in the the status bar contains the value "{name}" in the tooltip'
)
@uitests.tools.retry((AssertionError, StaleElementReferenceException))
def then_selected_interpreter_has_tooltip(context, name):
    element = uitests.vscode.status_bar.wait_for_python_statusbar(context)
    title = element.get_attribute("title")
    assert name in title, f"{name} in {title}"


@behave.then(
    'the python interpreter displayed in the the status bar contains the value "{name}" in the display name'
)
@uitests.tools.retry((AssertionError, StaleElementReferenceException))
def then_selected_interpreter_has_text(context, name):
    element = uitests.vscode.status_bar.wait_for_python_statusbar(context)
    assert name in element.text, f"{name} not in {element.text}"


@behave.then(
    'the python interpreter displayed in the the status bar does not contain the value "{name}" in the display name'
)
@uitests.tools.retry((AssertionError, StaleElementReferenceException))
def then_selected_interpreter_does_not_have_text(context, name):
    element = uitests.vscode.status_bar.wait_for_python_statusbar(context)
    assert name not in element.text, f"{name} in {element.text}"

# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import time

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
    assert name in element.get_attribute("title")
    # start_time = time.time()
    # while time.time() - start_time < 5:
    #     element = uitests.vscode.status_bar.wait_for_python_statusbar(context)
    #     try:
    #         assert name in element.get_attribute("title")
    #         return
    #     except (AssertionError, StaleElementReferenceException):
    #         time.sleep(0.5)
    # assert name in element.get_attribute("title")


@behave.then(
    'the python interpreter displayed in the the status bar contains the value "{name}" in the display name'
)
@uitests.tools.retry((AssertionError, StaleElementReferenceException))
def then_selected_interpreter_has_text(context, name):
    element = uitests.vscode.status_bar.wait_for_python_statusbar(context)
    assert name in element.text
    # start_time = time.time()
    # while time.time() - start_time < 10:
    #     element = uitests.vscode.status_bar.wait_for_python_statusbar(context)
    #     try:
    #         assert name in element.text
    #         return
    #     except (AssertionError, StaleElementReferenceException):
    #         time.sleep(0.5)
    # assert name in element.text


@behave.then(
    'the python interpreter displayed in the the status bar does not contain the value "{name}" in the display name'
)
@uitests.tools.retry((AssertionError, StaleElementReferenceException))
def then_selected_interpreter_does_not_have_text(context, name):
    element = uitests.vscode.status_bar.wait_for_python_statusbar(context)
    assert name not in element.text
    # start_time = time.time()
    # while time.time() - start_time < 10:
    #     element = uitests.vscode.status_bar.wait_for_python_statusbar(context)
    #     try:
    #         assert name not in element.text
    #         return
    #     except (AssertionError, StaleElementReferenceException):
    #         time.sleep(0.5)
    # assert name not in element.text

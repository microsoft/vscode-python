# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import time

import uitests.vscode.core
import uitests.vscode.extension


def is_debugg_sidebar_visible(context):
    try:
        uitests.vscode.core.wait_for_element(
            context.driver, ".composite.viewlet.debug-viewlet", retry_count=2
        )
        return True
    except TimeoutError:
        return False


def wait_for_debugger_to_start(context):
    uitests.vscode.core.wait_for_element(context.driver, "div.debug-toolbar")


def wait_for_debugger_to_pause(context):
    # Wait before checking, wait for debug toolbar to get displayed
    time.sleep(1.5)

    find = lambda ele: "Continue" in ele.get_attribute("title")  # noqa
    uitests.vscode.core.wait_for_element(
        context.driver, "div.debug-toolbar .action-item .action-label.icon", find
    )


def wait_for_debugger_to_stop(context, **kwargs):
    # Wait before checking, wait for debug toolbar to get displayed
    time.sleep(1.5)

    uitests.vscode.core.wait_for_element_to_be_hidden(
        context.driver, "div.debug-toolbar", **kwargs
    )


def add_breakpoint(context, file_name, line):
    uitests.vscode.documents.open_file(context, file_name)
    uitests.vscode.documents.go_to_line(context, line)
    uitests.vscode.quick_open.select_command(context, "Debug: Toggle Breakpoint")


def wait_for_python_debug_config_picker(context):
    selector = ".quick-input-widget .quick-input-title"

    debug_label = uitests.vscode.extension.get_localized_string(
        "debug.selectConfigurationTitle"
    )

    def find(elements):
        return [element for element in elements if element.text == debug_label]

    return uitests.vscode.core.wait_for_elements(context.driver, selector, find)


# def get_current_frame_position(context):
#     selector = ".panel-body.debug-call-stack .monaco-list-row.selected"
#     stack_trace = uitests.vscode.core.wait_for_element(context.driver, selector)
#     file_name = stack_trace.find_element_by_css_selector(".file-name").text
#     position = stack_trace.find_element_by_css_selector(".line-number").text.split(":")
#     return file_name, int(position[0]), int(position[1])

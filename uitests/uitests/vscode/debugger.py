# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os.path

import uitests.vscode.core


def wait_for_debugger_to_start(context):
    uitests.vscode.core.wait_for_element(context.driver, "div.debug-toolbar")


def wait_for_debugger_to_pause(context):
    find = lambda ele: "Continue" in ele.get_attribute("title")
    uitests.vscode.core.wait_for_element(
        context.driver, "div.debug-toolbar .action-item .action-label.icon", find
    )


def wait_for_debugger_to_stop(context):
    uitests.vscode.core.wait_for_element_to_be_hidden(
        context.driver, "div.debug-toolbar"
    )


def add_breakpoint(context, file_name, line):
    uitests.vscode.documents.open_file(context, file_name)
    uitests.vscode.documents.go_to_line(context, line)
    uitests.vscode.quick_open.select_command(context, "Debug: Toggle Breakpoint")


# def get_current_frame_position(context):
#     selector = ".panel-body.debug-call-stack .monaco-list-row.selected"
#     stack_trace = uitests.vscode.core.wait_for_element(context.driver, selector)
#     file_name = stack_trace.find_element_by_css_selector(".file-name").text
#     position = stack_trace.find_element_by_css_selector(".line-number").text.split(":")
#     return file_name, int(position[0]), int(position[1])

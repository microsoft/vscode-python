# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import behave

import uitests.tools
import uitests.vscode.debugger


@behave.then("the debugger starts")
def then_starts(context):
    uitests.vscode.debugger.wait_for_debugger_to_start(context)


@behave.then("the debugger stops")
def then_stops(context):
    uitests.vscode.debugger.wait_for_debugger_to_stop(context)


@behave.then("the debugger will stop within {seconds:d} seconds")
def then_stops_in_seconds(context, seconds):
    uitests.vscode.debugger.wait_for_debugger_to_stop(
        context, retry_count=seconds * 1000 / 100, retry_interval=0.1
    )


@behave.then("the debugger pauses")
def then_pauses(context):
    uitests.vscode.debugger.wait_for_debugger_to_pause(context)


@behave.when('I add a breakpoint to line {line:Number} in "{file}"')
def add_breakpoint(context, line, file):
    uitests.vscode.debugger.add_breakpoint(context, file, line)


@behave.then('the current stack frame is at line {line_number:Number} in "{file_name}"')
@uitests.tools.retry(AssertionError)
def current_stack_is(context, line_number, file_name):
    uitests.vscode.documents.is_file_open(context, file_name)
    line = uitests.vscode.documents.get_current_line(context)
    assert line == line_number, f"{line} != {line_number}"


@behave.then("the Python Debug Configuration picker is displayed")
@uitests.tools.retry(AssertionError, tries=5, delay=1)
def python_debug_picker(context):
    uitests.vscode.debugger.wait_for_python_debug_config_picker(context)


@behave.when('I select the debug configuration "{label}"')
def select_debug_config(context, label):
    uitests.vscode.quick_input.select_value(context, label)


# @behave.then(
#     'the current stack frame is not at line {line_number:Number} in "{file_name}"'
# )
# def current_stack_is_not(context, line_number, file_name):
#     try:
#         current_frame = uitests.vscode.debugger.get_current_frame_position(context)
#         assert current_frame[0] != file_name
#         assert current_frame[1] != line_number
#     except Exception:
#         pass

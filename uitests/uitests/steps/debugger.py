# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os.path
import time

import behave

import uitests.vscode.debugger
import uitests.tools


@behave.then("the debugger starts")
def then_starts(context):
    uitests.vscode.debugger.wait_for_debugger_to_start(context)


@behave.then("the debugger stops")
def then_stops(context):
    uitests.vscode.debugger.wait_for_debugger_to_stop(context)


@behave.then("the debugger pauses")
def then_stops(context):
    uitests.vscode.debugger.wait_for_debugger_to_pause(context)


@behave.when('I add a breakpoint to line {line:Number} in "{file}"')
def add_breakpoint(context, line, file):
    uitests.vscode.debugger.add_breakpoint(context, file, line)


@behave.then('the current stack frame is at line {line_number:Number} in "{file_name}"')
@uitests.tools.retry(AssertionError)
def current_stack_is(context, line_number, file_name):
    uitests.vscode.documents.is_file_open(context, file_name)
    current_position = uitests.vscode.documents.get_current_position(context)
    assert current_position[0] == line_number


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

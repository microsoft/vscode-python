# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os.path

import behave
import time

import uitests.vscode.documents
import uitests.tools


@behave.given('a file named "{name}" is created with the following contents')
def given_file_create(context, name):
    with open(os.path.join(context.options.workspace_folder, name), "w") as file:
        file.write(context.text)


@behave.when('the file "{name}" has the following content')
def when_file_with_content(context, name):
    with open(os.path.join(context.options.workspace_folder, name), "w") as file:
        file.write(context.text)


@behave.given('a file named "{name}" does not exist')
def given_file_no_exist(context, name):
    try:
        os.unlink(os.path.join(context.options.workspace_folder, name))
    except Exception:
        pass


@behave.given('the file "{name}" does not exist')
def given_the_file_no_exist(context, name):
    try:
        os.unlink(os.path.join(context.options.workspace_folder, name))
    except Exception:
        pass


@behave.then('a file named "{name}" is created')
@uitests.tools.retry(AssertionError)
def then_file_exists(context, name):
    assert os.path.exists(os.path.join(context.options.workspace_folder, name))
    # start_time = time.time()
    # while (time.time() - start_time) < 5:
    #     try:
    #         assert os.path.exists(os.path.join(context.options.workspace_folder, name))
    #         return
    #     except Exception:
    #         time.sleep(0.1)
    # assert os.path.exists(os.path.join(context.options.workspace_folder, name))


@behave.given('the file "{name}" is open')
def given_file_opened(context, name):
    uitests.vscode.documents.open_file(context, name)


@behave.then('the file "{name}" is opened')
def given_file_opened(context, name):
    uitests.vscode.documents.is_file_open(context, name)


@behave.when("I go to line {line_number:Number}")
def when_go_to_line(context, line_number):
    uitests.vscode.documents.go_to_line(context, line_number)


@behave.then("the cursor is on line {line_number:Number}")
@uitests.tools.retry(AssertionError)
def then_line(context, line_number):
    value = uitests.vscode.documents.get_current_position(context)
    assert line_number == value[0]


@behave.then("the cursor is on line {line_number:Number} and column {column:Number}")
@uitests.tools.retry(AssertionError)
def then_line(context, line_number, column):
    value = uitests.vscode.documents.get_current_position(context)
    assert line_number == value[0]
    assert column == value[0]


@behave.then('the file "{name}" contains the value "{value}"')
@uitests.tools.retry(AssertionError)
def file_contains(context, name, value):
    file_name = os.path.join(context.options.workspace_folder, name)
    with open(file_name, "r") as file:
        contents = file.read()
        assert value in contents
    # start_time = time.time()
    # file_name = os.path.join(context.options.workspace_folder, name)
    # while (time.time() - start_time) < 10:
    #     try:
    #         with open(file_name, "r") as file:
    #             contents = file.read()
    #             assert value in contents
    #             return
    #     except AssertionError:
    #         time.sleep(0.1)
    # assert value in contents


@behave.then('the file "{name}" does not contain the value "{value}"')
@uitests.tools.retry(AssertionError)
def file_not_contains(context, name, value):
    file_name = os.path.join(context.options.workspace_folder, name)
    with open(file_name, "r") as file:
        contents = file.read()
        assert value not in contents
    # start_time = time.time()
    # file_name = os.path.join(context.options.workspace_folder, name)
    # while (time.time() - start_time) < 10:
    #     try:
    #         with open(file_name, "r") as file:
    #             contents = file.read()
    #             assert value not in contents
    #             return
    #     except AssertionError:
    #         time.sleep(0.1)
    # assert value not in contents


@behave.when('I open the file "{name}"')
def when_file_opened(context, name):
    uitests.vscode.documents.open_file(context, name)


@behave.then('open the file "{name}"')
def then_open_file(context, name):
    uitests.vscode.documents.open_file(context, name)

# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os.path
import time

import behave
import uitests.tools
import uitests.vscode.documents


@behave.given('a file named "{name}" is created with the following contents')
def given_file_create(context, name):
    uitests.vscode.documents.create_file_with_contents(context, name, context.text)


@behave.when('the file "{name}" has the following content')
def when_file_with_content(context, name):
    uitests.vscode.documents.create_file_with_contents(context, name, context.text)


@behave.when("I create a new file with the following contents")
def when_new_file_with_content(context):
    uitests.vscode.documents.create_new_untitled_file_with_contents(
        context, context.text
    )


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


@behave.then('a file named "{name}" will be created')
@uitests.tools.retry(AssertionError)
def then_file_exists(context, name):
    assert os.path.exists(
        os.path.join(context.options.workspace_folder, name)
    ), os.path.join(context.options.workspace_folder, name)


@behave.then('a file named "{name}" will be created within {time:Number} seconds')
def then_file_exists_retry(context, name, time):
    @uitests.tools.retry(AssertionError, tries=time, delay=1)
    def check(context, name):
        assert os.path.exists(
            os.path.join(context.options.workspace_folder, name)
        ), os.path.join(context.options.workspace_folder, name)

    check(context, name)


@behave.given('the file "{name}" is open')
def given_file_opened(context, name):
    uitests.vscode.documents.open_file(context, name)


@behave.then('the file "{name}" is opened')
def then_file_opened(context, name):
    uitests.vscode.documents.is_file_open(context, name)


@behave.when("I go to line {line_number:d}")
def when_go_to_line(context, line_number):
    # Wait for 1/2 second, else things happen too quickly.
    time.sleep(0.5)
    uitests.vscode.documents.go_to_line(context, line_number)


@behave.when("I go to line {line_number:d}, column {column:d}")
def when_go_to_line_column(context, line_number, column):
    # Wait for 1/2 second, else things happen too quickly.
    time.sleep(0.5)
    uitests.vscode.documents.go_to_line_column(context, line_number, column)


@behave.then("the cursor is on line {line_number:d}")
@uitests.tools.retry(AssertionError, tries=30, delay=1)
def then_line(context, line_number):
    line = uitests.vscode.documents.get_current_line(context)
    assert line == line_number, AssertionError(f"{line} != {line_number}")


@behave.then("the cursor is on line {line_number:Number} and column {column:Number}")
@uitests.tools.retry(AssertionError, tries=30, delay=1)
def then_line_and_column(context, line_number, column):
    value = uitests.vscode.documents.get_current_position(context)
    assert line_number == value[0], f"{line_number} != {value[0]}"
    assert column == value[0], f"{column} != {value[0]}"


@behave.then('the file "{name}" contains the value "{value}"')
@uitests.tools.retry(AssertionError)
def file_contains(context, name, value):
    file_name = os.path.join(context.options.workspace_folder, name)
    with open(file_name, "r") as file:
        contents = file.read()
        assert value in contents, f"{value} not in {contents}"


@behave.then('the file "{name}" does not contain the value "{value}"')
@uitests.tools.retry(AssertionError)
def file_not_contains(context, name, value):
    file_name = os.path.join(context.options.workspace_folder, name)
    with open(file_name, "r") as file:
        contents = file.read()
        assert value not in contents, f"{value} not in {contents}"


@behave.when('I open the file "{name}"')
def when_file_opened(context, name):
    uitests.vscode.documents.open_file(context, name)


@behave.then('open the file "{name}"')
def then_open_file(context, name):
    uitests.vscode.documents.open_file(context, name)


@behave.when("I create an untitled Python file with the following contents")
def create_untitled_python_file(context):
    create_new_python_file(context)


@behave.when("I change the language of the file to {language}")
def change_language(context, language):
    """You could either quote the language within " or not."""
    uitests.vscode.documents.change_document_language(
        context, language=language.strip('"')
    )


@behave.when("I create an new Python file with the following contents")
def create_new_python_file(context):
    uitests.vscode.documents.create_new_untitled_file(context)
    uitests.vscode.documents.send_text_to_editor(context, "Untitled-1", context.text)


@behave.then("auto completion list will contain the item {label}")
@uitests.tools.retry(AssertionError)
def auto_complete_list_contains(context, label):
    """You could either quote the label within " or not."""
    items = uitests.vscode.documents.get_completion_list(context)
    label = label.strip('"').lower()
    contents = "".join(items).lower()
    assert label in contents, f"{label} not in {contents}"

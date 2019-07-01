# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import behave
from selenium.common.exceptions import StaleElementReferenceException

import uitests.vscode.status_bar
import uitests.tools
import uitests.vscode.problems


@behave.then("there are no problems in the problems panel")
@uitests.tools.retry((AssertionError, StaleElementReferenceException))
def then_no_problems(context):
    count = uitests.vscode.problems.get_problem_count(context)
    assert count == 0, f"Number of problems is {count}"


@behave.then("there is at least one problem in the problems panel")
@uitests.tools.retry((AssertionError, StaleElementReferenceException))
def then_atleast_one_problem(context):
    count = uitests.vscode.problems.get_problem_count(context)
    assert count > 0


@behave.then("there are at least {problem_count:Number} problems in the problems panel")
@uitests.tools.retry((AssertionError, StaleElementReferenceException))
def then_atleast_n_problems(context, problem_count):
    count = uitests.vscode.problems.get_problem_count(context)
    assert problem_count >= count, f"{problem_count} should be >= {count}"


@behave.then('there is a problem with the message "{message}"')
@uitests.tools.retry((AssertionError, StaleElementReferenceException))
def then_has_problem_with_message(context, message):
    messages = uitests.vscode.problems.get_problems(context)
    all_problems = "".join(messages)
    assert message in all_problems, f"{message} not in {all_problems}"


@behave.then('there is a problem with the file named "{name}"')
@uitests.tools.retry((AssertionError, StaleElementReferenceException))
def then_has_poroblem_in_filename(context, name):
    files = uitests.vscode.problems.get_problem_files(context)
    all_files = "".join(files)
    assert name in all_files, f"{all_files} not in {all_files}"

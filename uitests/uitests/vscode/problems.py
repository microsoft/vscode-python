# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


from enum import Enum

from . import core, quick_open


class ProblemType(Enum):
    All = 0
    Error = 1
    Warning = 2
    Info = 3


def get_problem_count(context, problem_type=ProblemType.All, **kwargs):
    if problem_type == ProblemType.All:
        selector = ".part.panel.bottom .action-item.checked .badge-content"
        element = core.wait_for_element(context.driver, selector, **kwargs)
        if element.text == "":
            return 0
        else:
            return int(element.text)

    if problem_type == ProblemType.Errors:
        selector = ".part.panel.bottom .content .tree-container .monaco-tl-row .marker-icon.error"
    elif problem_type == ProblemType.Warning:
        selector = ".part.panel.bottom .content .tree-container .monaco-tl-row .marker-icon.warning"
    elif problem_type == ProblemType.Info:
        selector = ".part.panel.bottom .content .tree-container .monaco-tl-row .marker-icon.info"

    return len(core.wait_for_elements(context.driver, selector, **kwargs))


def get_problem_files(context, **kwargs):
    selector = ".part.panel.bottom .content .tree-container .monaco-tl-row .file-icon .label-name span span"

    elements = core.wait_for_elements(context.driver, selector, **kwargs)
    return [element.text for element in elements]

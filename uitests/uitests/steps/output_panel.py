# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import behave

import uitests.tools
import uitests.vscode.output_panel


@behave.then('the output panel contains the text "{text}"')
@uitests.tools.retry(AssertionError)
def then_output_contains(context, text):
    lines = uitests.vscode.output_panel.get_output_panel_lines(context)
    assert text.lower() in "".join(lines).lower()

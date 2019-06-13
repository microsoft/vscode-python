# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import behave

import uitests.tools
import uitests.vscode.output_panel


@behave.then('the output panel contains the text "{text}"')
@uitests.tools.retry(AssertionError)
def then_output_contains(context, text):
    """Add retries, e.g. download LS can be slow on CI"""

    then_output_contains_within(context, text, seconds=100, delay=0.1)


@behave.then(
    'the text "{text}" will be displayed in the output panel within {seconds:n} seconds'
)
def then_output_contains_within(context, text, seconds=1000, delay=0.1):
    """Add retries, e.g. download LS can be slow on CI"""

    # Append messages, in case the list is large.
    messages_seen_thus_far = ""

    @uitests.tools.retry(AssertionError, tries=seconds, delay=delay)
    def check_output(context, text):
        lines = uitests.vscode.output_panel.get_output_panel_lines(context)
        text = text.strip('"').lower()
        nonlocal messages_seen_thus_far
        messages_seen_thus_far = messages_seen_thus_far + "".join(lines).lower()
        assert text in messages_seen_thus_far, f"{text} not in {messages_seen_thus_far}"

    try:
        # Maximize the panel so we can see everything in the panel.
        # Lines in output panels are virtualized.
        uitests.vscode.output_panel.maximize_bottom_panel(context)
        check_output(context, text)
    except Exception:
        raise
    finally:
        uitests.vscode.output_panel.minimize_bottom_panel(context)

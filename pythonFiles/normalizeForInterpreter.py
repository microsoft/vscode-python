# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import ast
import textwrap
import sys


def _get_multiline_statements(selection):
    """
    Process a multiline selection into a list of its top-level statements.
    This will remove empty newlines around and within the selection, dedent it,
    and split it using the result of `ast.parse()`.
    """
    statements = []

    # Remove blank lines within the selection to prevent the REPL from thinking the block is finished.
    lines = [line for line in selection.splitlines(False) if line.strip() != ""]

    # Dedent the selection and parse it using the ast module.
    # Note that leading comments in the selection will be discarded during parsing.
    source = textwrap.dedent("\n".join(lines))
    tree = ast.parse(source)

    # We'll need the dedented lines to rebuild the selection.
    lines = source.splitlines(False)

    # Get the line ranges for top-level blocks returned from parsing the dedented text
    # and split the selection accordingly.
    # tree.body is a list of AST objects, which we rely on to extract top-level statements.
    # If we supported Python 3.8+ only we could use the lineno and end_lineno attributes of each object
    # to get the boundaries of each block.
    # However, earlier Python versions only have the lineno attribute, which is the range start position (1-indexed).
    # Therefore, to retrieve the end line of each block in a version-agnostic way we need to do
    # `end = next_block.lineno - 1`
    # for all blocks except the last one, which will will just run until the last line.
    last_idx = len(tree.body) - 1
    for idx, node in enumerate(tree.body):
        # Given this selection:
        # if (m > 0 and
        #        n < 3):
        #     print('foo')
        # value = 'bar'
        #
        # The first block would have lineno = 1,and the second block lineno = 4
        start = node.lineno - 1
        end = len(lines) if idx == last_idx else tree.body[idx + 1].lineno - 1
        block = "\n".join(lines[start:end])

        # If the block is multiline, add an extra newline character at its end.
        # This way, when joining blocks back together, there will be a blank line between each multiline statement
        # and no blank lines between single-line statements, or it would look like this:
        # >>> x = 22
        # >>>
        # >>> y = 30
        # >>>
        # >>> total = x + y
        # >>>
        if end - start > 1:
            block += "\n"

        statements.append(block)

    return statements


def normalize_lines(selection):
    """
    Normalize the text selection received from the extension and send it to the REPL.

    If it is a single line selection, dedent it, append a newline and send it to the REPL.
    Otherwise, sanitize the multiline selection before sending it to the REPL:
    split it in a list of top-level statements
    and add newlines between each of them to tell the REPL where each block ends.
    """

    # Check if it is a singleline or multiline selection.
    is_singleline = len(selection.splitlines()) == 1

    # If it is a single line statement: Dedent and skip to the end.
    # Else: Parse the multiline selection into a list of top-level blocks.
    if is_singleline:
        statements = [textwrap.dedent(selection)]
    else:
        statements = _get_multiline_statements(selection)

    # Insert a newline between each top-level statement, and append a newline to the selection.
    source = "\n".join(statements) + "\n"

    # Finally, send the formatted selection to the REPL.
    sys.stdout.write(source)
    sys.stdout.flush()


if __name__ == "__main__":
    contents = sys.argv[1]
    try:
        default_encoding = sys.getdefaultencoding()
        encoded_contents = contents.encode(default_encoding, "surrogateescape")
        contents = encoded_contents.decode(default_encoding, "replace")
    except (UnicodeError, LookupError):
        pass
    if isinstance(contents, bytes):
        contents = contents.decode("utf8")
    normalize_lines(contents)

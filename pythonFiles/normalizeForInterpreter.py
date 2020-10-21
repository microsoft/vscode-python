# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import ast
import textwrap
import re
import sys


def split_lines(source):
    """
    Split selection lines in a version-agnostic way.

    Python grammar only treats \r, \n, and \r\n as newlines.
    But splitlines() in Python 3 has a much larger list: for example, it also includes \v, \f.
    As such, this function will split lines across all Python versions.
    """
    return re.split(r"[\n\r]+", source)


def _get_multiline_statements(split):
    """
    Process a multiline selection into a list of its top-level statements.
    This will remove empty newlines around and within the selection, dedent it,
    and split it using the result of `ast.parse()`.
    """

    # Remove blank lines within the selection to prevent the REPL from thinking the block is finished.
    lines = (line for line in split if line.strip() != "")

    # Dedent the selection and parse it using the ast module.
    # Note that leading comments in the selection will be discarded during parsing.
    source = textwrap.dedent("\n".join(lines))
    tree = ast.parse(source)

    # We'll need the dedented lines to rebuild the selection.
    lines = split_lines(source)

    # Get the line ranges for top-level blocks returned from parsing the dedented text
    # and split the selection accordingly.
    # tree.body is a list of AST objects, which we rely on to extract top-level statements.
    # If we supported Python 3.8+ only we could use the lineno and end_lineno attributes of each object
    # to get the boundaries of each block.
    # However, earlier Python versions only have the lineno attribute, which is the range start position (1-indexed).
    # Therefore, to retrieve the end line of each block in a version-agnostic way we need to do
    # `end = next_block.lineno - 1`
    # for all blocks except the last one, which will will just run until the last line.
    ends = [node.lineno - 1 for node in tree.body[1:]] + [len(lines)]
    for node, end in zip(tree.body, ends):
        # Given this selection:
        # if (m > 0 and
        #        n < 3):
        #     print('foo')
        # value = 'bar'
        #
        # The first block would have lineno = 1,and the second block lineno = 4
        start = node.lineno - 1
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

        yield block


def normalize_lines(selection):
    """
    Normalize the text selection received from the extension and send it to the REPL.

    If it is a single line selection, dedent it, append a newline and send it to the REPL.
    Otherwise, sanitize the multiline selection before sending it to the REPL:
    split it in a list of top-level statements
    and add newlines between each of them to tell the REPL where each block ends.
    """

    # Check if it is a singleline or multiline selection.
    split = selection.splitlines()
    is_singleline = len(split) == 1

    # If it is a single line statement: Dedent and skip to the end.
    # Else: Parse the multiline selection into a list of top-level blocks.
    if is_singleline:
        statements = [textwrap.dedent(selection)]
    else:
        statements = _get_multiline_statements(split)

    # Insert a newline between each top-level statement, and append a newline to the selection.
    source = "\n".join(statements) + "\n"

    # Finally, send the formatted selection to the REPL.
    # source is a unicode instance at this point on Python 2,
    # so if we used `sys.stdout.write`, Python will implicitly encode it using sys.getdefaultencoding(),
    # which is almost certainly the wrong thing.
    stdout = sys.stdout if sys.version_info < (3,) else sys.stdout.buffer
    stdout.write(source.encode("utf-8"))
    stdout.flush()


if __name__ == "__main__":
    # This will fail on a large file.
    # See https://github.com/microsoft/vscode-python/issues/14471
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

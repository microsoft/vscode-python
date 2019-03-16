# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import pytest
import textwrap

import normalizeForInterpreter


class TestNormalizationScript(object):
    """Basic unit tests for the normalization script."""

    def test_basicNormalization(self, capsys):
        src = 'print("this is a test")'
        normalizeForInterpreter.normalize_lines(src)
        captured = capsys.readouterr()
        assert captured.out == src

    def test_moreThanOneLine(self, capsys):
        src = textwrap.dedent("""\
            # Some rando comment

            def show_something():
                print("Something")
            """
        )
        normalizeForInterpreter.normalize_lines(src)
        captured = capsys.readouterr()
        assert captured.out == src

    def test_withHangingIndent(self, capsys):
        src = textwrap.dedent("""\
            x = 22
            y = 30
            z = -10
            result = x + y + z

            if result == 42:
                print("The answer to life, the universe, and everything")
            """
        )
        normalizeForInterpreter.normalize_lines(src)
        captured = capsys.readouterr()
        assert captured.out == src

    def test_clearOutExtraneousNewlines(self, capsys):
        src = textwrap.dedent("""\
            value_x = 22

            value_y = 30

            value_z = -10

            print(value_x + value_y + value_z)

            """
        )
        expectedResult = textwrap.dedent("""\
            value_x = 22
            value_y = 30
            value_z = -10
            print(value_x + value_y + value_z)

            """
        )
        normalizeForInterpreter.normalize_lines(src)
        result = capsys.readouterr()
        assert result.out == expectedResult

    def test_clearOutExtraLinesAndWhitespace(self, capsys):
        src = textwrap.dedent("""\
            if True:
                x = 22

                y = 30

                z = -10

            print(x + y + z)

            """
        )
        expectedResult = textwrap.dedent("""\
            if True:
                x = 22
                y = 30
                z = -10

            print(x + y + z)

            """
        )
        normalizeForInterpreter.normalize_lines(src)
        result = capsys.readouterr()
        assert result.out == expectedResult

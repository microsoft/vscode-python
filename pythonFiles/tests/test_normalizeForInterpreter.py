# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import pytest

import normalizeForInterpreter


class TestNormalizationScript(object):
    """Basic unit tests for the normalization script."""

    def test_basicNormalization(self, capsys):
        src = 'print("this is a test")'
        normalizeForInterpreter.normalize_lines(src)
        captured = capsys.readouterr()
        assert captured.out == src

    def test_moreThanOneLine(self, capsys):
        src = "\n".join(
            [
                "# Some rando comment",
                "",
                "def show_something():",
                '    print("Something")',
            ]
        )

        normalizeForInterpreter.normalize_lines(src)
        captured = capsys.readouterr()
        assert captured.out == src

    def test_withHangingIndent(self, capsys):
        src = "\n".join(
            [
                "x = 22",
                "y = 30",
                "z = -10",
                "result = x + y + z",
                "",
                "if (result == 42):",
                '    print("The answer to life, the universe, and everything")',
            ]
        )

        normalizeForInterpreter.normalize_lines(src)
        captured = capsys.readouterr()
        assert captured.out == src

    def test_clearOutExtraneousNewlines(self, capsys):
        src = "\n".join(
            [
                "value_x = 22",
                "",
                "value_y = 30",
                "",
                "value_z = -10",
                "",
                "print(value_x + value_y + value_z)",
                "",
            ]
        )

        expectedResult = "\n".join(
            [
                "value_x = 22",
                "value_y = 30",
                "value_z = -10",
                "print(value_x + value_y + value_z)",
                "",
            ]
        )

        normalizeForInterpreter.normalize_lines(src)
        result = capsys.readouterr()
        assert result.out == expectedResult

    def test_clearOutExtraLinesAndWhitespace(self, capsys):
        src = "\n".join(
            [
                "if (1 == 1):",
                "    x = 22",
                "    ",
                "    y = 30",
                "    ",
                "    z = -10",
                "    ",
                "print(x + y + z)",
                "",
            ]
        )

        expectedResult = "\n".join(
            [
                "if (1 == 1):",
                "    x = 22",
                "    y = 30",
                "    z = -10",
                "",
                "print(x + y + z)",
                "",
            ]
        )

        normalizeForInterpreter.normalize_lines(src)
        result = capsys.readouterr()
        assert result.out == expectedResult

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
        src = (
            "# Some rando comment\n"
            "\n"
            "def show_something():\n"
            '    print("Something")\n'
        )

        normalizeForInterpreter.normalize_lines(src)
        captured = capsys.readouterr()
        assert captured.out == src

    def test_withHangingIndent(self, capsys):
        src = (
            "x = 22\n"
            "y = 30\n"
            "z = -10\n"
            "result = x + y + z\n"
            "\n"
            "if (result == 42):\n"
            '    print("The answer to life, the universe, and everything")\n'
        )

        normalizeForInterpreter.normalize_lines(src)
        captured = capsys.readouterr()
        assert captured.out == src

    def test_clearOutExtraneousNewlines(self, capsys):
        src = (
            "x = 22\n",
            "\n",
            "y = 30\n",
            "\n",
            "z = -10\n",
            "\n",
            "print(x + y + z)\n",
        )

        expectedResult = ("x = 22\n", "y = 30\n", "z = -10\n", "print(x + y + z)\n")

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

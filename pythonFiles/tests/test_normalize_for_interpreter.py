# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import pytest
import sys
import textwrap

import normalizeForInterpreter


class TestNormalizationScript(object):
    """Basic unit tests for the normalization script."""

    def test_basicNormalization(self):
        src = 'print("this is a test")'
        result = normalizeForInterpreter.normalize_lines(src)
        assert result == src

    def test_moreThanOneLine(self):
        src = textwrap.dedent(
            """\
            # Some rando comment

            def show_something():
                print("Something")
            """
        )
        result = normalizeForInterpreter.normalize_lines(src)
        assert result == src

    def test_withHangingIndent(self):
        src = textwrap.dedent(
            """\
            x = 22
            y = 30
            z = -10
            result = x + y + z

            if result == 42:
                print("The answer to life, the universe, and everything")
            """
        )
        result = normalizeForInterpreter.normalize_lines(src)
        assert result == src

    def test_clearOutExtraneousNewlines(self):
        src = textwrap.dedent(
            """\
            value_x = 22

            value_y = 30

            value_z = -10

            print(value_x + value_y + value_z)

            """
        )
        expectedResult = textwrap.dedent(
            """\
            value_x = 22
            value_y = 30
            value_z = -10
            print(value_x + value_y + value_z)

            """
        )
        result = normalizeForInterpreter.normalize_lines(src)
        assert result == expectedResult

    def test_clearOutExtraLinesAndWhitespace(self):
        src = textwrap.dedent(
            """\
            if True:
                x = 22

                y = 30

                z = -10

            print(x + y + z)

            """
        )
        expectedResult = textwrap.dedent(
            """\
            if True:
                x = 22
                y = 30
                z = -10

            print(x + y + z)

            """
        )
        result = normalizeForInterpreter.normalize_lines(src)
        assert result == expectedResult

# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import textwrap

import normalizeSelection


class TestNormalizationScript(object):
    """Unit tests for the normalization script."""

    def test_basicNormalization(self, capsys):
        src = 'print("this is a test")'
        expected = src + "\n"
        normalizeSelection.normalize_lines(src)
        captured = capsys.readouterr()
        assert captured.out == expected

    def test_moreThanOneLine(self, capsys):
        src = textwrap.dedent(
            """\
            # Some rando comment

            def show_something():
                print("Something")
            """
        )
        expected = textwrap.dedent(
            """\
            def show_something():
                print("Something")
            
            """
        )
        normalizeSelection.normalize_lines(src)
        captured = capsys.readouterr()
        assert captured.out == expected

    def test_withHangingIndent(self, capsys):
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
        expected = textwrap.dedent(
            """\
            x = 22
            y = 30
            z = -10
            result = x + y + z
            if result == 42:
                print("The answer to life, the universe, and everything")
            
            """
        )
        normalizeSelection.normalize_lines(src)
        captured = capsys.readouterr()
        assert captured.out == expected

    def test_clearOutExtraneousNewlines(self, capsys):
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
        normalizeSelection.normalize_lines(src)
        result = capsys.readouterr()
        assert result.out == expectedResult

    def test_clearOutExtraLinesAndWhitespace(self, capsys):
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
        normalizeSelection.normalize_lines(src)
        result = capsys.readouterr()
        assert result.out == expectedResult

    def test_partialSingleLine(self, capsys):
        src = "   print('foo')"
        expected = textwrap.dedent(src) + "\n"
        normalizeSelection.normalize_lines(src)
        result = capsys.readouterr()
        assert result.out == expected

    def test_multiLineWithIndent(self, capsys):
        src = """\
           
        if (x > 0
            and condition == True):
            print('foo')
        else:

            print('bar')
        """

        expectedResult = textwrap.dedent(
            """\
        if (x > 0
            and condition == True):
            print('foo')
        else:
            print('bar')
        
        """
        )

        normalizeSelection.normalize_lines(src)
        result = capsys.readouterr()
        assert result.out == expectedResult

    def test_multiLineWithComment(self, capsys):
        src = textwrap.dedent(
            """\

            def show_something():
                # A comment
                print("Something")
            """
        )
        expected = textwrap.dedent(
            """\
            def show_something():
                # A comment
                print("Something")
            
            """
        )
        normalizeSelection.normalize_lines(src)
        captured = capsys.readouterr()
        assert captured.out == expected

    def test_exception(self, capsys):
        src = "       if True:"
        expected = src + "\n\n"
        normalizeSelection.normalize_lines(src)
        captured = capsys.readouterr()
        assert captured.out == expected

    def test_multilineException(self, capsys):
        src = textwrap.dedent(
            """\

            def show_something():
                if True:
            """
        )
        expected = src + "\n\n"
        normalizeSelection.normalize_lines(src)
        captured = capsys.readouterr()
        assert captured.out == expected

# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import textwrap

import normalizeSelection


class TestNormalizationScript(object):
    """Unit tests for the normalization script."""

    def test_basicNormalization():
        src = 'print("this is a test")'
        expected = src + "\n"
        result = normalizeSelection.normalize_lines(src)
        assert result["normalized"] == expected

    def test_moreThanOneLine():
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
        result = normalizeSelection.normalize_lines(src)
        assert result["normalized"] == expected

    def test_withHangingIndent():
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
        result = normalizeSelection.normalize_lines(src)
        assert result["normalized"] == expected

    def test_clearOutExtraneousNewlines():
        src = textwrap.dedent(
            """\
            value_x = 22

            value_y = 30

            value_z = -10

            print(value_x + value_y + value_z)

            """
        )
        expected = textwrap.dedent(
            """\
            value_x = 22
            value_y = 30
            value_z = -10
            print(value_x + value_y + value_z)
            """
        )
        result = normalizeSelection.normalize_lines(src)
        assert result["normalized"] == expected

    def test_clearOutExtraLinesAndWhitespace():
        src = textwrap.dedent(
            """\
            if True:
                x = 22

                y = 30

                z = -10

            print(x + y + z)

            """
        )
        expected = textwrap.dedent(
            """\
            if True:
                x = 22
                y = 30
                z = -10

            print(x + y + z)
            """
        )
        result = normalizeSelection.normalize_lines(src)
        assert result["normalized"] == expected

    def test_partialSingleLine():
        src = "   print('foo')"
        expected = textwrap.dedent(src) + "\n"
        result = normalizeSelection.normalize_lines(src)
        assert result["normalized"] == expected

    def test_multiLineWithIndent():
        src = """\
           
        if (x > 0
            and condition == True):
            print('foo')
        else:

            print('bar')
        """

        expected = textwrap.dedent(
            """\
        if (x > 0
            and condition == True):
            print('foo')
        else:
            print('bar')
        
        """
        )

        result = normalizeSelection.normalize_lines(src)
        assert result["normalized"] == expected

    def test_multiLineWithComment():
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
        result = normalizeSelection.normalize_lines(src)
        assert result["normalized"] == expected

    def test_exception():
        src = "       if True:"
        expected = src + "\n\n"
        result = normalizeSelection.normalize_lines(src)
        assert result["normalized"] == expected

    def test_multilineException():
        src = textwrap.dedent(
            """\

            def show_something():
                if True:
            """
        )
        expected = src + "\n\n"
        result = normalizeSelection.normalize_lines(src)
        assert result["normalized"] == expected

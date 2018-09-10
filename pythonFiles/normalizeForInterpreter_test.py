import operator
import os
import unittest


import normalizeForInterpreter as normalizer


class TestNormalizationForInterpreter(unittest.TestCase):
    """Test the various steps used in the `normalizeForInterpreter.py` script."""

    def test_normalized_line_endings_no_newline(self):
        """Ensure that no additions to the line endings are afforded."""

        result = normalizer.get_normalized_line_endings(
            'No line ending at all.')

        self.assertFalse(result.endswith('\n'))

    
    def test_normalized_line_endings_one_lf(self):
        """Ensure a line with a newline (\\n) character is preserved."""

        result = normalizer.get_normalized_line_endings(
            'A single line with a newline character only.\n')

        self.assertFalse(
            result.endswith('\r\n'), 
            msg="Should only ever return an LF, never CRLF")

        self.assertTrue(
            result.endswith('\n'), 
            msg="Should only ever return an LF, never CRLF")
    
    def test_normalized_line_endings_one_crlf(self):
        """Ensure a line with a CRLF (\\r\\n) character is preserved."""

        result = normalizer.get_normalized_line_endings(
            'A single line with a CRLF character as newline.\r\n')

        self.assertTrue(
            result.endswith('\r\n'),
            msg="Should only ever return an CRLF, not just LF")

        self.assertFalse(
            result.endswith('\r\r\n'),
            msg="Should only ever return an CRLF, never with duplicated CR")


    def test_normalized_line_endings_two_newlines_at_end(self):
        """Ensure that 2 trailing blank new lines are preserved."""

        result = normalizer.get_normalized_line_endings(
            'A single line with two newline sequences.\r\n\r\n')

        self.assertTrue(
            result.endswith('sequences.\r\n\r\n'),
            msg='Should preserve the exact content including newlines')


    def test_trailing_newline_none(self):
        """Ensure that no trailing newline is added."""
        test_content = '# A single line with no newline at all.'
        expected_result = ''

        result = normalizer.get_trailing_newline(test_content, [test_content])
        self.assertEqual(expected_result, result,
            msg='We should get back no newline characters.')


    def test_trailing_newline(self):
        """Ensure that a single trailing newline is preserved."""
        test_content = '# A single line with a newline.\n'
        expected_result = '\n'

        result = normalizer.get_trailing_newline(test_content, [test_content])
        self.assertEqual(expected_result, result,
            msg='We should get back a single newline character.')


    def test_trailing_double_newline(self):
        """Ensure that double trailing newlines are preserved."""
        test_content = '# A single line with 2 newlines.\n\n'
        expected_result = '\n\n'

        result = normalizer.get_trailing_newline(test_content, [test_content])
        self.assertEqual(expected_result, result,
            msg='We should get back two newline characters.')


    def test_trailing_multiple_newline(self):
        """Ensure that many trailing newlines are preserved only as 2."""
        test_content = '# A single line with 2 newlines.' + '\n' * 5
        expected_result = '\n\n'

        result = normalizer.get_trailing_newline(test_content, [test_content])
        self.assertEqual(expected_result, result,
            msg='We should get back two newline characters.')


    def test_trailing_newline_one_CRLF(self):
        """Ensure that a single CRLF is kept as LF."""
        test_content = '# A single line with a CRLF newline.\r\n'
        expected_result = '\n'

        result = normalizer.get_trailing_newline(test_content, [test_content])
        self.assertEqual(expected_result, result,
            msg='We should get back a single newline character.')


    def test_trailing_newline_two_CRLF(self):
        """Ensure that two CRLF are kept as 2x LF."""
        test_content = '# A single line with double CRLF newline.\r\n\r\n'
        expected_result = '\n\n'

        result = normalizer.get_trailing_newline(test_content, [test_content])
        self.assertEqual(expected_result, result,
            msg='We should get back a two newline (LF) characters.')


    def test_trailing_newline_many_CRLF(self):
        """Ensure that many CRLF characters are kept as 2x LF."""
        test_content = '# A single line with many CRLF newline.' + '\r\n\r\n' * 5
        expected_result = '\n\n'

        result = normalizer.get_trailing_newline(test_content, [test_content])
        self.assertEqual(expected_result, result,
            msg='We should get back a two newline (LF) character.')


    def test_from_node_tests_multiple_doubles(self):
        """Block of code with multiple newlines preserves trailing 2x CRLF."""
        test_content = "# Sample block 1\r\n\r\ndef square(x):\r\n    return x**2\r\n\r\nprint('hello')\r\n# Sample block 2\r\n\r\na = 2\r\n\r\nif a < 2:\r\n    print('less than 2')\r\nelse:\r\n    print('more than 2')\r\n\r\nprint('hello')\r\n# Sample block 3\r\n\r\nfor i in range(5):\r\n    print(i)\r\n    print(i)\r\n    print(i)\r\n    print(i)\r\n\r\nprint('complete')\r\n\r\n"
        expected_result = '\n\n'

        result = normalizer.get_trailing_newline(test_content, test_content.splitlines(False))
        self.assertEqual(expected_result, result,
            msg='We should get back a two newline (LF) character.')


    def test_remove_empty_lines_from_single_line(self):
        """Single line code block has nothing changed."""
        test_content = "print('sample single line')"
        expected_result = ["print('sample single line')"]

        result = normalizer.remove_empty_lines(test_content)
        self.assertEqual(
            expected_result,
            result,
            'Should have 1 lines returned same, got {}.'
                .format(len(result))
        )


    def test_remove_empty_lines_from_two_line(self):
        """Two-line code block has nothing changed."""
        test_content = 'def something(some_value):\r\n    print(some_value)\r\n'
        expected_result = ['def something(some_value):', '    print(some_value)']

        result = normalizer.remove_empty_lines(test_content)
        self.assertEqual(
            expected_result,
            result,
            'Should have {} lines returned same, got {}.'
                .format(len(expected_result), len(result))
        )


    def test_remove_empty_lines_from_two_line_with_blanks(self):
        """Remove many newlines from two-line code block."""
        test_content = '\r\n\r\n\r\n\r\ndef something(some_value):\r\n\r\n\r\n\r\n    print(some_value)\r\n\r\n\r\n\r\n\r\n'
        expected_result = ['def something(some_value):', '    print(some_value)']

        result = normalizer.remove_empty_lines(test_content)
        self.assertEqual(
            expected_result,
            result,
            'Should have {} lines returned same, got {}.'
                .format(len(expected_result), len(result))
        )


    def test_remove_empty_lines_from_two_line_with_interim_blanks(self):
        """Two-line code with empty in-between block returns 2 lines."""
        test_content = 'def something(some_value):\r\n\r\n\r\n\r\n    print(some_value)\r\n'
        expected_result = ['def something(some_value):', '    print(some_value)']

        result = normalizer.remove_empty_lines(test_content)
        self.assertEqual(
            expected_result,
            result,
            'Should have {} lines returned same, got {}.'
                .format(len(expected_result), len(result))
        )


    def test_remove_empty_lines_from_codesample(self):
        """Block of code with multiple newlines is cleaned properly."""
        self.skipTest('Not ready for prime time, yet!')
        test_content = "# Sample block 1\r\n\r\ndef square(x):\r\n    return x**2\r\n\r\nprint('hello')\r\n# Sample block 2\r\n\r\na = 2\r\n\r\nif a < 2:\r\n    print('less than 2')\r\nelse:\r\n    print('more than 2')\r\n\r\nprint('hello')\r\n# Sample block 3\r\n\r\nfor i in range(5):\r\n    print(i)\r\n    print(i)\r\n    print(i)\r\n    print(i)\r\n\r\nprint('complete')\r\n\r\n"
        expected_result = """# Sample block 1
def square(x):
    return x**2
print('hello')
# Sample block 2
a = 2
if a < 2:
    print('less than 2')
else:
    print('more than 2')

print('hello')
# Sample block 3
for i in range(5):
    print(i)
    print(i)
    print(i)
    print(i)
    
print('complete')"""

        result = normalizer.remove_empty_lines(test_content)

        self.assertEqual(expected_result, result,
            msg='Expected code len: {}, normalized len is {}.'
                .format(len(expected_result), len(result)))


    def test_discover_blocks_single(self):
        """Find a single logical block from a single line of code."""
        test_content = "print('Hello tests')"
        expected_result = [1]

        result = normalizer._get_global_statement_blocks(test_content, [test_content])
        self.assertEqual(len(expected_result), 1, 
                         'Expected only one logical block.')
        result_start_line_numbers = [x[0] for x in result]

        self.assertEqual(expected_result, result_start_line_numbers, 
                         'Line 1 is the only line given.')


    def test_discover_blocks_two(self):
        """Find two logical blocks from two lines of code."""
        test_content = "print('Hello tests')\r\nprint('goodbye, for now!')\r\n"
        expected_result = [1]

        result = normalizer._get_global_statement_blocks(test_content, test_content.splitlines(False))
        self.assertEqual(len(expected_result), 1, 
                         'Expected only one logical block.')
        result_start_line_numbers = [x[0] for x in result]

        self.assertEqual(expected_result, result_start_line_numbers, 
                         'Line 1 is the start of the only logical block.')


    def test_discover_blocks_three(self):
        """Find three logical blocks from three lines of code."""
        test_content = "print('Hello tests')\r\nprint('goodbye, for now!')\r\nprint('Random line for fun.')\r\n"
        expected_result = [1]

        result = normalizer._get_global_statement_blocks(test_content, test_content.splitlines(False))
        self.assertEqual(len(expected_result), len(result), 
                         'Expected only one logical block.')
        result_start_line_numbers = [x[0] for x in result]

        self.assertEqual(expected_result, result_start_line_numbers, 
                         'Line 1 is the start of the only logical block.')


    def test_discover_two_blocks(self):
        """Find two disparate blocks in a simple code sample."""
        test_content = "print('One block')\r\n\r\nprint('Two block')\r\n"
        expected_result = [1, 3]

        result = normalizer._get_global_statement_blocks(test_content, test_content.splitlines(False))
        self.assertEqual(len(expected_result), len(result), 
                         'Expected exactly two logical blocks.')
        result_start_line_numbers = [x[0] for x in result]

        self.assertEqual(expected_result, result_start_line_numbers, 
                         '2 disparate lines separated by whitespace.')


    def test_discover_three_blocks(self):
        """Find three (N) disparate blocks in a simple code sample."""
        test_content = "print('One block')\r\n\r\nif False:\r\n    print('Why am I here?')\r\n\r\nprint('Two block')\r\n"
        expected_result = [1, 3, 6]

        result = normalizer._get_global_statement_blocks(test_content, test_content.splitlines(False))
        self.assertEqual(len(expected_result), len(result), 
                         'Expected exactly three logical blocks.')
        result_start_line_numbers = [x[0] for x in result]

        self.assertEqual(expected_result, result_start_line_numbers, 
                         '3 disparate lines separated by whitespace.')


if __name__ == '__main__':
    unittest.main()

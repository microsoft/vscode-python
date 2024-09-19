# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

from .reverse import reverse_sentence, reverse_string


def test_reverse_sentence():
    """
    Tests the reverse_sentence function to ensure it correctly reverses each word in a sentence.

    Test cases:
    - "hello world" should be reversed to "olleh dlrow"
    - "Python is fun" should be reversed to "nohtyP si nuf"
    - "a b c" should remain "a b c" as each character is a single word
    """
    assert reverse_sentence("hello world") == "olleh dlrow"
    assert reverse_sentence("Python is fun") == "nohtyP si nuf"
    assert reverse_sentence("a b c") == "a b c"

def test_reverse_sentence_error():
    assert reverse_sentence("") == "Error: Input is None"
    assert reverse_sentence(None) == "Error: Input is None"


def test_reverse_string():
    assert reverse_string("hello") == "olleh"
    assert reverse_string("Python") == "nohtyP"
    # this test specifically does not cover the error cases

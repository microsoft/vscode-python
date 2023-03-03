import unittest


def subtract(a, b):
    return a - b


class TestSubtractFunction(unittest.TestCase):
    def test_subtract_positive_numbers(self):
        result = subtract(5, 3)
        self.assertEqual(result, 2)

    def test_subtract_negative_numbers(self):
        result = subtract(-2, -3)
        self.assertEqual(result, 1)

import sys
import os

import unittest

class Test_test3(unittest.TestCase):
    def test_3A(self):
        self.assertEqual(1, 2-1, "Not implemented")

    def test_3B(self):
        self.assertEqual(1, 1, 'Not equal')

    @unittest.skip("demonstrating skipping")
    def test_3C(self):
        self.assertEqual(1, 1, 'Not equal')


if __name__ == '__main__':
    unittest.main()

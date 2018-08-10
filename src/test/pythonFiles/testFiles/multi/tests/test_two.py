import sys
import os

import unittest

class Test_test2(unittest.TestCase):
    def test_2A(self):
        self.fail("Not implemented")

    def test_2B(self):
        self.assertEqual(1, 1, 'Not equal')

    @unittest.skip("demonstrating skipping")
    def test_2C(self):
        self.assertEqual(1, 1, 'Not equal')


if __name__ == '__main__':
    unittest.main()

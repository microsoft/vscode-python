import sys
import os

import unittest

class Test_Root_test1(unittest.TestCase):
    def test_Root_A(self):
        self.fail("Not implemented")

    def test_Root_B(self):
        self.assertEqual(1, 1, 'Not equal')

    @unittest.skip("demonstrating skipping")
    def test_Root_c(self):
        self.assertEqual(1, 1, 'Not equal')


if __name__ == '__main__':
    unittest.main()

import sys
import os

import unittest

class Test_test1(unittest.TestCase):
    def tst_A(self):
        self.fail("Not implemented")

    def tst_B(self):
        self.assertEqual(1, 1, 'Not equal')


if __name__ == '__main__':
    unittest.main()

import sys
import os

import unittest

class Test_Current_Working_Directory(unittest.TestCase):
    def test_cwd(self):
        testDir = os.path.join(os.getcwd(), 'test')
        testFileDir = os.path.dirname(os.path.abspath(__file__))
        self.assertEqual(testDir, testFileDir, 'Not equal' + testDir + testFileDir)


if __name__ == '__main__':
    unittest.main()

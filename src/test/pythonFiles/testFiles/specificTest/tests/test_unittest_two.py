import unittest

class Test_test_two_1(unittest.TestCase):
    def test_1_1_1(self):
        self.assertEqual(1,1,'Not equal')

    def test_1_1_2(self):
        self.assertEqual(1,2,'Not equal')

    @unittest.skip("demonstrating skipping")
    def test_1_1_3(self):
        self.assertEqual(1,2,'Not equal')

class Test_test_two_2(unittest.TestCase):
    def test_2_1_1(self):
        self.assertEqual(1,1,'Not equal')

if __name__ == '__main__':
    unittest.main()

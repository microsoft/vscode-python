import unittest


class Test_test3(unittest.TestCase):
    def test_A(self):
        self.fail("Not implemented")

    def test_B(self):
        self.assertEqual(1, 1, 'Not equal')


if __name__ == '__main__':
    unittest.main()

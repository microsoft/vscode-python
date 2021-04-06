import unittest


class Test_test3(unittest.TestCase):
    def test4A(self):
        self.fail("Not implemented")

    def test4B(self):
        self.assertEqual(1, 1, 'Not equal')


if __name__ == '__main__':
    unittest.main()

import unittest

class Tst_test2(unittest.TestCase):
    def tst_A2(self):
        self.fail("Not implemented")

    def tst_B2(self):
        self.assertEqual(1,1,'Not equal')

    def tst_C2(self):
        self.assertEqual(1,2,'Not equal')

    def tst_D2(self):
        raise ArithmeticError()
        pass

if __name__ == '__main__':
    unittest.main()

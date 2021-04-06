"""pylint option block-disable"""

__revision__ = None

class Foo(object):
    """block-disable test"""

    def __init__(self):
        pass

    def meth1(self, arg):
        """meth1"""
        print self.blop

    def meth2(self, arg):
        """meth2"""
        # pylint: disable=unused-argument
        print self\
              + "foo"

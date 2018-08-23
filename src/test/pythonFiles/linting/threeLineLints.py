"""pylint messages with three lines of output"""

__revision__ = None

class Foo(object):

    def __init__(self):
        pass

    def meth1(self,arg):
        """missing a space after the comma in args"""
        a = (1,2)
        b = (1,2)
        c = (1,2)
        print (self)

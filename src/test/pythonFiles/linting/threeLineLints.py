"""pylint messages with three lines of output"""

__revision__ = None

class Foo(object):

    def __init__(self):
        pass

    def meth1(self,arg):
        """missing a space between 'self' and 'arg'. This should trigger the
        following three line lint warning::

          C: 10, 0: Exactly one space required after comma
              def meth1(self,arg):
                             ^ (bad-whitespace)

        The following three lines of tuples should also cause three-line lint
        errors due to "Exactly one space required after comma" messages.
        """
        a = (1,2)
        b = (1,2)
        c = (1,2)
        print (self)

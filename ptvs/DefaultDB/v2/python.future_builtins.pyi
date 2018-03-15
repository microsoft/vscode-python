import itertools

__doc__ = "This module provides functions that will be builtins in Python 3.0,\nbut that conflict with builtins that already exist in Python 2.x.\n\nFunctions:\n\nascii(arg) -- Returns the canonical string representation of an object.\nfilter(pred, iterable) -- Returns an iterator yielding those items of \n       iterable for which pred(item) is true.\nhex(arg) -- Returns the hexadecimal representation of an integer.\nmap(func, *iterables) -- Returns an iterator that computes the function \n    using arguments from each of the iterables.\noct(arg) -- Returns the octal representation of an integer.\nzip(iter1 [,iter2 [...]]) -- Returns a zip object whose .next() method \n    returns a tuple where the i-th element comes from the i-th iterable \n    argument.\n\nThe typical usage of this module is to replace existing builtins in a\nmodule's namespace:\n \nfrom future_builtins import ascii, filter, map, hex, oct, zip\n"
__name__ = 'future_builtins'
__package__ = None
def ascii(object):
    'ascii(object) -> string\n\nReturn the same as repr().  In Python 3.x, the repr() result will\ncontain printable characters unescaped, while the ascii() result\nwill have such characters backslash-escaped.'
    pass

filter = itertools.ifilter
def hex(number):
    'hex(number) -> string\n\nReturn the hexadecimal representation of an integer or long integer.'
    pass

map = itertools.imap
def oct(number):
    'oct(number) -> string\n\nReturn the octal representation of an integer or long integer.'
    pass

zip = itertools.izip

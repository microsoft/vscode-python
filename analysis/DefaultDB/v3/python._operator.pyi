import operator

__doc__ = "Operator interface.\n\nThis module exports a set of functions implemented in C corresponding\nto the intrinsic operators of Python.  For example, operator.add(x, y)\nis equivalent to the expression x+y.  The function names are those\nused for special methods; variants without leading and trailing\n'__' are also provided for convenience."
__name__ = '_operator'
__package__ = ''
def _compare_digest():
    "compare_digest(a, b) -> bool\n\nReturn 'a == b'.  This function uses an approach designed to prevent\ntiming analysis, making it appropriate for cryptography.\na and b must both be of the same type: either str (ASCII only),\nor any bytes-like object.\n\nNote: If a and b are of different lengths, or if an error occurs,\na timing attack could theoretically reveal information about the\ntypes and lengths of a and b--but not their values.\n"
    pass

def abs(a):
    'abs(a) -- Same as abs(a).'
    pass

def add(a, b):
    'add(a, b) -- Same as a + b.'
    pass

def and_(a, b):
    'and_(a, b) -- Same as a & b.'
    pass

attrgetter = operator.attrgetter
def concat(a, b):
    'concat(a, b) -- Same as a + b, for a and b sequences.'
    pass

def contains(a, b):
    'contains(a, b) -- Same as b in a (note reversed operands).'
    pass

def countOf(a, b):
    'countOf(a, b) -- Return the number of times b occurs in a.'
    pass

def delitem(a, b):
    'delitem(a, b) -- Same as del a[b].'
    pass

def eq(a, b):
    'eq(a, b) -- Same as a==b.'
    pass

def floordiv(a, b):
    'floordiv(a, b) -- Same as a // b.'
    pass

def ge(a, b):
    'ge(a, b) -- Same as a>=b.'
    pass

def getitem(a, b):
    'getitem(a, b) -- Same as a[b].'
    pass

def gt(a, b):
    'gt(a, b) -- Same as a>b.'
    pass

def iadd():
    'a = iadd(a, b) -- Same as a += b.'
    pass

def iand():
    'a = iand(a, b) -- Same as a &= b.'
    pass

def iconcat():
    'a = iconcat(a, b) -- Same as a += b, for a and b sequences.'
    pass

def ifloordiv():
    'a = ifloordiv(a, b) -- Same as a //= b.'
    pass

def ilshift():
    'a = ilshift(a, b) -- Same as a <<= b.'
    pass

def imatmul():
    'a = imatmul(a, b) -- Same as a @= b.'
    pass

def imod():
    'a = imod(a, b) -- Same as a %= b.'
    pass

def imul():
    'a = imul(a, b) -- Same as a *= b.'
    pass

def index(a):
    'index(a) -- Same as a.__index__()'
    pass

def indexOf(a, b):
    'indexOf(a, b) -- Return the first index of b in a.'
    pass

def inv(a):
    'inv(a) -- Same as ~a.'
    pass

def invert(a):
    'invert(a) -- Same as ~a.'
    pass

def ior():
    'a = ior(a, b) -- Same as a |= b.'
    pass

def ipow():
    'a = ipow(a, b) -- Same as a **= b.'
    pass

def irshift():
    'a = irshift(a, b) -- Same as a >>= b.'
    pass

def is_(a, b):
    'is_(a, b) -- Same as a is b.'
    pass

def is_not(a, b):
    'is_not(a, b) -- Same as a is not b.'
    pass

def isub():
    'a = isub(a, b) -- Same as a -= b.'
    pass

itemgetter = operator.itemgetter
def itruediv():
    'a = itruediv(a, b) -- Same as a /= b'
    pass

def ixor():
    'a = ixor(a, b) -- Same as a ^= b.'
    pass

def le(a, b):
    'le(a, b) -- Same as a<=b.'
    pass

def length_hint(obj, default=0):
    'length_hint(obj, default=0) -> int\nReturn an estimate of the number of items in obj.\nThis is useful for presizing containers when building from an\niterable.\n\nIf the object supports len(), the result will be\nexact. Otherwise, it may over- or under-estimate by an\narbitrary amount. The result will be an integer >= 0.'
    pass

def lshift(a, b):
    'lshift(a, b) -- Same as a << b.'
    pass

def lt(a, b):
    'lt(a, b) -- Same as a<b.'
    pass

def matmul(a, b):
    'matmul(a, b) -- Same as a @ b.'
    pass

methodcaller = operator.methodcaller
def mod(a, b):
    'mod(a, b) -- Same as a % b.'
    pass

def mul(a, b):
    'mul(a, b) -- Same as a * b.'
    pass

def ne(a, b):
    'ne(a, b) -- Same as a!=b.'
    pass

def neg(a):
    'neg(a) -- Same as -a.'
    pass

def not_(a):
    'not_(a) -- Same as not a.'
    pass

def or_(a, b):
    'or_(a, b) -- Same as a | b.'
    pass

def pos(a):
    'pos(a) -- Same as +a.'
    pass

def pow(a, b):
    'pow(a, b) -- Same as a ** b.'
    pass

def rshift(a, b):
    'rshift(a, b) -- Same as a >> b.'
    pass

def setitem(a, b, c):
    'setitem(a, b, c) -- Same as a[b] = c.'
    pass

def sub(a, b):
    'sub(a, b) -- Same as a - b.'
    pass

def truediv(a, b):
    'truediv(a, b) -- Same as a / b.'
    pass

def truth(a):
    'truth(a) -- Return True if a is true, False otherwise.'
    pass

def xor(a, b):
    'xor(a, b) -- Same as a ^ b.'
    pass


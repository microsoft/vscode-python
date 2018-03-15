import __builtin__

def __abs__():
    'abs(a) -- Same as abs(a).'
    return __T__()

def __add__():
    'add(a, b) -- Same as a + b.'
    return __T__()

def __and__():
    'and_(a, b) -- Same as a & b.'
    return __T__()

def __concat__():
    'concat(a, b) -- Same as a + b, for a and b sequences.'
    pass

def __contains__(self, value):
    'contains(a, b) -- Same as b in a (note reversed operands).'
    return False

def __delitem__():
    'delitem(a, b) -- Same as del a[b].'
    return None

def __delslice__():
    'delslice(a, b, c) -- Same as del a[b:c].'
    pass

def __div__():
    'div(a, b) -- Same as a / b when __future__.division is not in effect.'
    pass

__doc__ = "Operator interface.\n\nThis module exports a set of functions implemented in C corresponding\nto the intrinsic operators of Python.  For example, operator.add(x, y)\nis equivalent to the expression x+y.  The function names are those\nused for special methods; variants without leading and trailing\n'__' are also provided for convenience."
def __eq__():
    'eq(a, b) -- Same as a==b.'
    return False

def __floordiv__():
    'floordiv(a, b) -- Same as a // b.'
    return 0

def __ge__():
    'ge(a, b) -- Same as a>=b.'
    return False

def __getitem__(self, index):
    'getitem(a, b) -- Same as a[b].'
    pass

def __getslice__():
    'getslice(a, b, c) -- Same as a[b:c].'
    return __T__()

def __gt__():
    'gt(a, b) -- Same as a>b.'
    return False

def __iadd__():
    'a = iadd(a, b) -- Same as a += b.'
    return None

def __iand__():
    'a = iand(a, b) -- Same as a &= b.'
    return None

def __iconcat__():
    'a = iconcat(a, b) -- Same as a += b, for a and b sequences.'
    pass

def __idiv__():
    'a = idiv(a, b) -- Same as a /= b when __future__.division is not in effect.'
    pass

def __ifloordiv__():
    'a = ifloordiv(a, b) -- Same as a //= b.'
    pass

def __ilshift__():
    'a = ilshift(a, b) -- Same as a <<= b.'
    pass

def __imod__():
    'a = imod(a, b) -- Same as a %= b.'
    pass

def __imul__():
    'a = imul(a, b) -- Same as a *= b.'
    return None

def __index__():
    'index(a) -- Same as a.__index__()'
    return 0

def __inv__():
    'inv(a) -- Same as ~a.'
    pass

def __invert__():
    'invert(a) -- Same as ~a.'
    return __T__()

def __ior__():
    'a = ior(a, b) -- Same as a |= b.'
    return None

def __ipow__():
    'a = ipow(a, b) -- Same as a **= b.'
    pass

def __irepeat__():
    'a = irepeat(a, b) -- Same as a *= b, where a is a sequence, and b is an integer.'
    pass

def __irshift__():
    'a = irshift(a, b) -- Same as a >>= b.'
    pass

def __isub__():
    'a = isub(a, b) -- Same as a -= b.'
    return None

def __itruediv__():
    'a = itruediv(a, b) -- Same as a /= b when __future__.division is in effect.'
    pass

def __ixor__():
    'a = ixor(a, b) -- Same as a ^= b.'
    return None

def __le__():
    'le(a, b) -- Same as a<=b.'
    return False

def __lshift__():
    'lshift(a, b) -- Same as a << b.'
    return __T__()

def __lt__():
    'lt(a, b) -- Same as a<b.'
    return False

def __mod__():
    'mod(a, b) -- Same as a % b.'
    return __T__()

def __mul__():
    'mul(a, b) -- Same as a * b.'
    return __T__()

__name__ = 'operator'
def __ne__():
    'ne(a, b) -- Same as a!=b.'
    return False

def __neg__():
    'neg(a) -- Same as -a.'
    return __T__()

def __not__():
    'not_(a) -- Same as not a.'
    pass

def __or__():
    'or_(a, b) -- Same as a | b.'
    return __T__()

__package__ = None
def __pos__():
    'pos(a) -- Same as +a.'
    return __T__()

def __pow__():
    'pow(a, b) -- Same as a ** b.'
    return __T__()

def __repeat__():
    'repeat(a, b) -- Return a * b, where a is a sequence, and b is an integer.'
    pass

def __rshift__():
    'rshift(a, b) -- Same as a >> b.'
    return __T__()

def __setitem__(self, index, value):
    'setitem(a, b, c) -- Same as a[b] = c.'
    return None

def __setslice__():
    'setslice(a, b, c, d) -- Same as a[b:c] = d.'
    pass

def __sub__():
    'sub(a, b) -- Same as a - b.'
    return __T__()

def __truediv__():
    'truediv(a, b) -- Same as a / b when __future__.division is in effect.'
    return 0.0

def __xor__():
    'xor(a, b) -- Same as a ^ b.'
    return __T__()

def _compare_digest():
    "compare_digest(a, b) -> bool\n\nReturn 'a == b'.  This function uses an approach designed to prevent\ntiming analysis, making it appropriate for cryptography.\na and b must both be of the same type: either str (ASCII only),\nor any type that supports the buffer protocol (e.g. bytes).\n\nNote: If a and b are of different lengths, or if an error occurs,\na timing attack could theoretically reveal information about the\ntypes and lengths of a and b--but not their values.\n"
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

class attrgetter(__builtin__.object):
    "attrgetter(attr, ...) --> attrgetter object\n\nReturn a callable object that fetches the given attribute(s) from its operand.\nAfter f = attrgetter('name'), the call f(r) returns r.name.\nAfter g = attrgetter('name', 'date'), the call g(r) returns (r.name, r.date).\nAfter h = attrgetter('name.first', 'name.last'), the call h(r) returns\n(r.name.first, r.name.last)."
    def __call__(self):
        'x.__call__(...) <==> x(...)'
        pass
    
    __class__ = attrgetter
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    

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

def delslice(a, b, c):
    'delslice(a, b, c) -- Same as del a[b:c].'
    pass

def div(a, b):
    'div(a, b) -- Same as a / b when __future__.division is not in effect.'
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

def getslice(a, b, c):
    'getslice(a, b, c) -- Same as a[b:c].'
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

def idiv():
    'a = idiv(a, b) -- Same as a /= b when __future__.division is not in effect.'
    pass

def ifloordiv():
    'a = ifloordiv(a, b) -- Same as a //= b.'
    pass

def ilshift():
    'a = ilshift(a, b) -- Same as a <<= b.'
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

def irepeat():
    'a = irepeat(a, b) -- Same as a *= b, where a is a sequence, and b is an integer.'
    pass

def irshift():
    'a = irshift(a, b) -- Same as a >>= b.'
    pass

def isCallable(a):
    'isCallable(a) -- Same as callable(a).'
    pass

def isMappingType(a):
    'isMappingType(a) -- Return True if a has a mapping type, False otherwise.'
    pass

def isNumberType(a):
    'isNumberType(a) -- Return True if a has a numeric type, False otherwise.'
    pass

def isSequenceType(a):
    'isSequenceType(a) -- Return True if a has a sequence type, False otherwise.'
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

class itemgetter(__builtin__.object):
    'itemgetter(item, ...) --> itemgetter object\n\nReturn a callable object that fetches the given item(s) from its operand.\nAfter f = itemgetter(2), the call f(r) returns r[2].\nAfter g = itemgetter(2, 5, 3), the call g(r) returns (r[2], r[5], r[3])'
    def __call__(self):
        'x.__call__(...) <==> x(...)'
        pass
    
    __class__ = itemgetter
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    

def itruediv():
    'a = itruediv(a, b) -- Same as a /= b when __future__.division is in effect.'
    pass

def ixor():
    'a = ixor(a, b) -- Same as a ^= b.'
    pass

def le(a, b):
    'le(a, b) -- Same as a<=b.'
    pass

def lshift(a, b):
    'lshift(a, b) -- Same as a << b.'
    pass

def lt(a, b):
    'lt(a, b) -- Same as a<b.'
    pass

class methodcaller(__builtin__.object):
    "methodcaller(name, ...) --> methodcaller object\n\nReturn a callable object that calls the given method on its operand.\nAfter f = methodcaller('name'), the call f(r) returns r.name().\nAfter g = methodcaller('name', 'date', foo=1), the call g(r) returns\nr.name('date', foo=1)."
    def __call__(self):
        'x.__call__(...) <==> x(...)'
        pass
    
    __class__ = methodcaller
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    

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

def repeat(a, b):
    'repeat(a, b) -- Return a * b, where a is a sequence, and b is an integer.'
    pass

def rshift(a, b):
    'rshift(a, b) -- Same as a >> b.'
    pass

def sequenceIncludes(a, b):
    'sequenceIncludes(a, b) -- Same as b in a (note reversed operands; deprecated).'
    pass

def setitem(a, b, c):
    'setitem(a, b, c) -- Same as a[b] = c.'
    pass

def setslice(a, b, c, d):
    'setslice(a, b, c, d) -- Same as a[b:c] = d.'
    pass

def sub(a, b):
    'sub(a, b) -- Same as a - b.'
    pass

def truediv(a, b):
    'truediv(a, b) -- Same as a / b when __future__.division is in effect.'
    pass

def truth(a):
    'truth(a) -- Return True if a is true, False otherwise.'
    pass

def xor(a, b):
    'xor(a, b) -- Same as a ^ b.'
    pass


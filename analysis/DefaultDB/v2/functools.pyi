import __builtin__

WRAPPER_ASSIGNMENTS = __builtin__.tuple()
WRAPPER_UPDATES = __builtin__.tuple()
__builtins__ = __builtin__.dict()
__doc__ = 'functools.py - Tools for working with functions and callable objects\n'
__file__ = 'C:\\PTVS\\packages\\python2.2.7.14\\tools\\lib\\functools.pyc'
__name__ = 'functools'
__package__ = None
def cmp_to_key(mycmp):
    'Convert a cmp= function into a key= function'
    pass

class partial(__builtin__.object):
    'partial(func, *args, **keywords) - new function with partial application\n    of the given arguments and keywords.\n'
    def __call__(self):
        'x.__call__(...) <==> x(...)'
        pass
    
    __class__ = partial
    def __delattr__(self):
        "x.__delattr__('name') <==> del x.name"
        return None
    
    __dict__ = __builtin__.dict()
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    def __reduce__(self):
        return ''; return ()
    
    def __setattr__(self):
        "x.__setattr__('name', value) <==> x.name = value"
        return None
    
    def __setstate__(self, state):
        return None
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def args(self):
        'tuple of arguments to future partial calls'
        pass
    
    @property
    def func(self):
        'function object to use in future partial calls'
        pass
    
    @property
    def keywords(self):
        'dictionary of keyword arguments to future partial calls'
        pass
    

def reduce(function, sequence, initial):
    'reduce(function, sequence[, initial]) -> value\n\nApply a function of two arguments cumulatively to the items of a sequence,\nfrom left to right, so as to reduce the sequence to a single value.\nFor example, reduce(lambda x, y: x+y, [1, 2, 3, 4, 5]) calculates\n((((1+2)+3)+4)+5).  If initial is present, it is placed before the items\nof the sequence in the calculation, and serves as a default when the\nsequence is empty.'
    pass

def total_ordering(cls):
    'Class decorator that fills in missing ordering methods'
    pass

def update_wrapper(wrapper, wrapped, assigned, updated):
    'Update a wrapper function to look like the wrapped function\n\n       wrapper is the function to be updated\n       wrapped is the original function\n       assigned is a tuple naming the attributes assigned directly\n       from the wrapped function to the wrapper function (defaults to\n       functools.WRAPPER_ASSIGNMENTS)\n       updated is a tuple naming the attributes of the wrapper that\n       are updated with the corresponding attribute from the wrapped\n       function (defaults to functools.WRAPPER_UPDATES)\n    '
    pass

def wraps(wrapped, assigned, updated):
    'Decorator factory to apply update_wrapper() to a wrapper function\n\n       Returns a decorator that invokes update_wrapper() with the decorated\n       function as the wrapper argument and the arguments to wraps() as the\n       remaining arguments. Default arguments are as for update_wrapper().\n       This is a convenience function to simplify applying partial() to\n       update_wrapper().\n    '
    pass


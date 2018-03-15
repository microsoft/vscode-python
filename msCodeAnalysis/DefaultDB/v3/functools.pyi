import _thread
import builtins
import weakref

CacheInfo = builtins.type
MappingProxyType = builtins.mappingproxy
RLock = _thread.RLock
WRAPPER_ASSIGNMENTS = builtins.tuple()
WRAPPER_UPDATES = builtins.tuple()
WeakKeyDictionary = weakref.WeakKeyDictionary
_CacheInfo = CacheInfo()
class _HashedSeq(builtins.list):
    ' This class guarantees that hash() will be called no more than once\n        per element.  This is important because the lru_cache() will hash\n        the key multiple times on a cache miss.\n\n    '
    __class__ = _HashedSeq
    def __hash__(self):
        pass
    
    def __init__(self, tup, hash):
        pass
    
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    __module__ = 'functools'
    __slots__ = 'hashvalue'
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def hashvalue(self):
        pass
    

__all__ = builtins.list()
__builtins__ = builtins.dict()
__cached__ = 'C:\\PTVS\\packages\\python\\tools\\lib\\__pycache__\\functools.cpython-36.pyc'
__doc__ = 'functools.py - Tools for working with functions and callable objects\n'
__file__ = 'C:\\PTVS\\packages\\python\\tools\\lib\\functools.py'
__name__ = 'functools'
__package__ = ''
def _c3_merge(sequences):
    'Merges MROs in *sequences* to a single MRO using the C3 algorithm.\n\n    Adapted from http://www.python.org/download/releases/2.3/mro/.\n\n    '
    pass

def _c3_mro(cls, abcs):
    "Computes the method resolution order using extended C3 linearization.\n\n    If no *abcs* are given, the algorithm works exactly like the built-in C3\n    linearization used for method resolution.\n\n    If given, *abcs* is a list of abstract base classes that should be inserted\n    into the resulting MRO. Unrelated ABCs are ignored and don't end up in the\n    result. The algorithm inserts ABCs where their functionality is introduced,\n    i.e. issubclass(cls, abc) returns True for the class itself but returns\n    False for all its direct base classes. Implicit ABCs for a given class\n    (either registered or inferred from the presence of a special method like\n    __len__) are inserted directly after the last ABC explicitly listed in the\n    MRO of said class. If two implicit ABCs end up next to each other in the\n    resulting MRO, their ordering depends on the order of types in *abcs*.\n\n    "
    pass

def _compose_mro(cls, types):
    'Calculates the method resolution order for a given class *cls*.\n\n    Includes relevant abstract base classes (with their respective bases) from\n    the *types* iterable. Uses a modified C3 linearization algorithm.\n\n    '
    pass

_convert = builtins.dict()
def _find_impl(cls, registry):
    'Returns the best matching implementation from *registry* for type *cls*.\n\n    Where there is no registered implementation for a specific type, its method\n    resolution order is used to find a more generic implementation.\n\n    Note: if *registry* does not contain an implementation for the base\n    *object* type, this function may return None.\n\n    '
    pass

def _ge_from_gt(self, other, NotImplemented):
    'Return a >= b.  Computed by @total_ordering from (a > b) or (a == b).'
    pass

def _ge_from_le(self, other, NotImplemented):
    'Return a >= b.  Computed by @total_ordering from (not a <= b) or (a == b).'
    pass

def _ge_from_lt(self, other, NotImplemented):
    'Return a >= b.  Computed by @total_ordering from (not a < b).'
    pass

def _gt_from_ge(self, other, NotImplemented):
    'Return a > b.  Computed by @total_ordering from (a >= b) and (a != b).'
    pass

def _gt_from_le(self, other, NotImplemented):
    'Return a > b.  Computed by @total_ordering from (not a <= b).'
    pass

def _gt_from_lt(self, other, NotImplemented):
    'Return a > b.  Computed by @total_ordering from (not a < b) and (a != b).'
    pass

def _le_from_ge(self, other, NotImplemented):
    'Return a <= b.  Computed by @total_ordering from (not a >= b) or (a == b).'
    pass

def _le_from_gt(self, other, NotImplemented):
    'Return a <= b.  Computed by @total_ordering from (not a > b).'
    pass

def _le_from_lt(self, other, NotImplemented):
    'Return a <= b.  Computed by @total_ordering from (a < b) or (a == b).'
    pass

class _lru_cache_wrapper(builtins.object):
    'Create a cached callable that wraps another function.\n\nuser_function:      the function being cached\n\nmaxsize:  0         for no caching\n          None      for unlimited cache size\n          n         for a bounded cache\n\ntyped:    False     cache f(3) and f(3.0) as identical calls\n          True      cache f(3) and f(3.0) as distinct calls\n\ncache_info_type:    namedtuple class with the fields:\n                        hits misses currsize maxsize\n'
    def __call__(self, *args, **kwargs):
        'Call self as a function.'
        pass
    
    __class__ = _lru_cache_wrapper
    def __copy__(self):
        pass
    
    def __deepcopy__(self):
        pass
    
    __dict__ = builtins.dict()
    def __get__(self, instance, owner):
        'Return an attribute of instance, which is of type owner.'
        pass
    
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    def __reduce__(self):
        return ''; return ()
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def cache_clear(self):
        pass
    
    def cache_info(self):
        pass
    

def _lt_from_ge(self, other, NotImplemented):
    'Return a < b.  Computed by @total_ordering from (not a >= b).'
    pass

def _lt_from_gt(self, other, NotImplemented):
    'Return a < b.  Computed by @total_ordering from (not a > b) and (a != b).'
    pass

def _lt_from_le(self, other, NotImplemented):
    'Return a < b.  Computed by @total_ordering from (a <= b) and (a != b).'
    pass

def _make_key(args, kwds, typed, kwd_mark, fasttypes, tuple, type, len):
    'Make a cache key from optionally typed positional and keyword arguments\n\n    The key is constructed in a way that is flat as possible rather than\n    as a nested structure that would take more memory.\n\n    If there is only a single argument and its data type is known to cache\n    its hash value, then that argument is returned without a wrapper.  This\n    saves space and improves lookup speed.\n\n    '
    pass

def cmp_to_key():
    'Convert a cmp= function into a key= function.'
    pass

def get_cache_token():
    'Returns the current ABC cache token.\n\n    The token is an opaque object (supporting equality testing) identifying the\n    current version of the ABC cache for virtual subclasses. The token changes\n    with every call to ``register()`` on any ABC.\n    '
    pass

def lru_cache(maxsize, typed):
    'Least-recently-used cache decorator.\n\n    If *maxsize* is set to None, the LRU features are disabled and the cache\n    can grow without bound.\n\n    If *typed* is True, arguments of different types will be cached separately.\n    For example, f(3.0) and f(3) will be treated as distinct calls with\n    distinct results.\n\n    Arguments to the cached function must be hashable.\n\n    View the cache statistics named tuple (hits, misses, maxsize, currsize)\n    with f.cache_info().  Clear the cache and statistics with f.cache_clear().\n    Access the underlying function with f.__wrapped__.\n\n    See:  http://en.wikipedia.org/wiki/Cache_algorithms#Least_Recently_Used\n\n    '
    pass

def namedtuple(typename, field_names):
    "Returns a new subclass of tuple with named fields.\n\n    >>> Point = namedtuple('Point', ['x', 'y'])\n    >>> Point.__doc__                   # docstring for the new class\n    'Point(x, y)'\n    >>> p = Point(11, y=22)             # instantiate with positional args or keywords\n    >>> p[0] + p[1]                     # indexable like a plain tuple\n    33\n    >>> x, y = p                        # unpack like a regular tuple\n    >>> x, y\n    (11, 22)\n    >>> p.x + p.y                       # fields also accessible by name\n    33\n    >>> d = p._asdict()                 # convert to a dictionary\n    >>> d['x']\n    11\n    >>> Point(**d)                      # convert from a dictionary\n    Point(x=11, y=22)\n    >>> p._replace(x=100)               # _replace() is like str.replace() but targets named fields\n    Point(x=100, y=22)\n\n    "
    pass

class partial(builtins.object):
    'partial(func, *args, **keywords) - new function with partial application\n    of the given arguments and keywords.\n'
    def __call__(self, *args, **kwargs):
        'Call self as a function.'
        pass
    
    __class__ = partial
    def __delattr__(self, name):
        'Implement delattr(self, name).'
        pass
    
    __dict__ = builtins.dict()
    def __getattribute__(self, name):
        'Return getattr(self, name).'
        pass
    
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    def __reduce__(self):
        return ''; return ()
    
    def __repr__(self):
        'Return repr(self).'
        pass
    
    def __setattr__(self, name, value):
        'Implement setattr(self, name, value).'
        pass
    
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
    

class partialmethod(builtins.object):
    'Method descriptor with partial application of the given arguments\n    and keywords.\n\n    Supports wrapping existing descriptors and handles non-descriptor\n    callables as instance methods.\n    '
    __class__ = partialmethod
    __dict__ = builtins.dict()
    def __get__(self, obj, cls):
        pass
    
    def __init__(self, func, *args, **keywords):
        pass
    
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    __isabstractmethod__ = builtins.property()
    __module__ = 'functools'
    def __repr__(self):
        pass
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def __weakref__(self):
        'list of weak references to the object (if defined)'
        pass
    
    def _make_unbound_method(self):
        pass
    

def recursive_repr(fillvalue):
    'Decorator to make a repr function return fillvalue for a recursive call'
    pass

def reduce(function, sequence, initial):
    'reduce(function, sequence[, initial]) -> value\n\nApply a function of two arguments cumulatively to the items of a sequence,\nfrom left to right, so as to reduce the sequence to a single value.\nFor example, reduce(lambda x, y: x+y, [1, 2, 3, 4, 5]) calculates\n((((1+2)+3)+4)+5).  If initial is present, it is placed before the items\nof the sequence in the calculation, and serves as a default when the\nsequence is empty.'
    pass

def singledispatch(func):
    'Single-dispatch generic function decorator.\n\n    Transforms a function into a generic function, which can have different\n    behaviours depending upon the type of its first argument. The decorated\n    function acts as the default implementation, and additional\n    implementations can be registered using the register() attribute of the\n    generic function.\n\n    '
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


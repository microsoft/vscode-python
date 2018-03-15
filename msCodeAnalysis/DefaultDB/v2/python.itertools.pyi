import __builtin__

__doc__ = 'Functional tools for creating and using iterators.\n\nInfinite iterators:\ncount([n]) --> n, n+1, n+2, ...\ncycle(p) --> p0, p1, ... plast, p0, p1, ...\nrepeat(elem [,n]) --> elem, elem, elem, ... endlessly or up to n times\n\nIterators terminating on the shortest input sequence:\nchain(p, q, ...) --> p0, p1, ... plast, q0, q1, ... \ncompress(data, selectors) --> (d[0] if s[0]), (d[1] if s[1]), ...\ndropwhile(pred, seq) --> seq[n], seq[n+1], starting when pred fails\ngroupby(iterable[, keyfunc]) --> sub-iterators grouped by value of keyfunc(v)\nifilter(pred, seq) --> elements of seq where pred(elem) is True\nifilterfalse(pred, seq) --> elements of seq where pred(elem) is False\nislice(seq, [start,] stop [, step]) --> elements from\n       seq[start:stop:step]\nimap(fun, p, q, ...) --> fun(p0, q0), fun(p1, q1), ...\nstarmap(fun, seq) --> fun(*seq[0]), fun(*seq[1]), ...\ntee(it, n=2) --> (it1, it2 , ... itn) splits one iterator into n\ntakewhile(pred, seq) --> seq[0], seq[1], until pred fails\nizip(p, q, ...) --> (p[0], q[0]), (p[1], q[1]), ... \nizip_longest(p, q, ...) --> (p[0], q[0]), (p[1], q[1]), ... \n\nCombinatoric generators:\nproduct(p, q, ... [repeat=1]) --> cartesian product\npermutations(p[, r])\ncombinations(p, r)\ncombinations_with_replacement(p, r)\n'
__name__ = 'itertools'
__package__ = None
class chain(__builtin__.object):
    'chain(*iterables) --> chain object\n\nReturn a chain object whose .next() method returns elements from the\nfirst iterable until it is exhausted, then elements from the next\niterable, until all of the iterables are exhausted.'
    __class__ = chain
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    def __iter__(self):
        'x.__iter__() <==> iter(x)'
        return chain()
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @classmethod
    def from_iterable(cls, self, iterable):
        'chain.from_iterable(iterable) --> chain object\n\nAlternate chain() constructor taking a single iterable argument\nthat evaluates lazily.'
        pass
    
    def next(self):
        'x.next() -> the next value, or raise StopIteration'
        pass
    

class combinations(__builtin__.object):
    'combinations(iterable, r) --> combinations object\n\nReturn successive r-length combinations of elements in the iterable.\n\ncombinations(range(4), 3) --> (0,1,2), (0,1,3), (0,2,3), (1,2,3)'
    __class__ = combinations
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    def __iter__(self):
        'x.__iter__() <==> iter(x)'
        return combinations()
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def next(self):
        'x.next() -> the next value, or raise StopIteration'
        pass
    

class combinations_with_replacement(__builtin__.object):
    "combinations_with_replacement(iterable, r) --> combinations_with_replacement object\n\nReturn successive r-length combinations of elements in the iterable\nallowing individual elements to have successive repeats.\ncombinations_with_replacement('ABC', 2) --> AA AB AC BB BC CC"
    __class__ = combinations_with_replacement
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    def __iter__(self):
        'x.__iter__() <==> iter(x)'
        return combinations_with_replacement()
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def next(self):
        'x.next() -> the next value, or raise StopIteration'
        pass
    

class compress(__builtin__.object):
    'compress(data, selectors) --> iterator over selected data\n\nReturn data elements corresponding to true selector elements.\nForms a shorter iterator from selected data elements using the\nselectors to choose the data elements.'
    __class__ = compress
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    def __iter__(self):
        'x.__iter__() <==> iter(x)'
        return compress()
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def next(self):
        'x.next() -> the next value, or raise StopIteration'
        pass
    

class count(__builtin__.object):
    'count(start=0, step=1) --> count object\n\nReturn a count object whose .next() method returns consecutive values.\nEquivalent to:\n\n    def count(firstval=0, step=1):\n        x = firstval\n        while 1:\n            yield x\n            x += step\n'
    __class__ = count
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    def __iter__(self):
        'x.__iter__() <==> iter(x)'
        return count()
    
    def __reduce__(self):
        'Return state information for pickling.'
        return ''; return ()
    
    def __repr__(self):
        'x.__repr__() <==> repr(x)'
        return ''
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def next(self):
        'x.next() -> the next value, or raise StopIteration'
        pass
    

class cycle(__builtin__.object):
    'cycle(iterable) --> cycle object\n\nReturn elements from the iterable until it is exhausted.\nThen repeat the sequence indefinitely.'
    __class__ = cycle
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    def __iter__(self):
        'x.__iter__() <==> iter(x)'
        return cycle()
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def next(self):
        'x.next() -> the next value, or raise StopIteration'
        pass
    

class dropwhile(__builtin__.object):
    'dropwhile(predicate, iterable) --> dropwhile object\n\nDrop items from the iterable while predicate(item) is true.\nAfterwards, return every element until the iterable is exhausted.'
    __class__ = dropwhile
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    def __iter__(self):
        'x.__iter__() <==> iter(x)'
        return dropwhile()
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def next(self):
        'x.next() -> the next value, or raise StopIteration'
        pass
    

class groupby(__builtin__.object):
    'groupby(iterable[, keyfunc]) -> create an iterator which returns\n(key, sub-iterator) grouped by each value of key(value).\n'
    __class__ = groupby
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    def __iter__(self):
        'x.__iter__() <==> iter(x)'
        return groupby()
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def next(self):
        'x.next() -> the next value, or raise StopIteration'
        pass
    

class ifilter(__builtin__.object):
    'ifilter(function or None, sequence) --> ifilter object\n\nReturn those items of sequence for which function(item) is true.\nIf function is None, return the items that are true.'
    __class__ = ifilter
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    def __iter__(self):
        'x.__iter__() <==> iter(x)'
        return ifilter()
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def next(self):
        'x.next() -> the next value, or raise StopIteration'
        pass
    

class ifilterfalse(__builtin__.object):
    'ifilterfalse(function or None, sequence) --> ifilterfalse object\n\nReturn those items of sequence for which function(item) is false.\nIf function is None, return the items that are false.'
    __class__ = ifilterfalse
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    def __iter__(self):
        'x.__iter__() <==> iter(x)'
        return ifilterfalse()
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def next(self):
        'x.next() -> the next value, or raise StopIteration'
        pass
    

class imap(__builtin__.object):
    'imap(func, *iterables) --> imap object\n\nMake an iterator that computes the function using arguments from\neach of the iterables.  Like map() except that it returns\nan iterator instead of a list and that it stops when the shortest\niterable is exhausted instead of filling in None for shorter\niterables.'
    __class__ = imap
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    def __iter__(self):
        'x.__iter__() <==> iter(x)'
        return imap()
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def next(self):
        'x.next() -> the next value, or raise StopIteration'
        pass
    

class islice(__builtin__.object):
    'islice(iterable, [start,] stop [, step]) --> islice object\n\nReturn an iterator whose next() method returns selected values from an\niterable.  If start is specified, will skip all preceding elements;\notherwise, start defaults to zero.  Step defaults to one.  If\nspecified as another value, step determines how many values are \nskipped between successive calls.  Works like a slice() on a list\nbut returns an iterator.'
    __class__ = islice
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    def __iter__(self):
        'x.__iter__() <==> iter(x)'
        return islice()
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def next(self):
        'x.next() -> the next value, or raise StopIteration'
        pass
    

class izip(__builtin__.object):
    'izip(iter1 [,iter2 [...]]) --> izip object\n\nReturn a izip object whose .next() method returns a tuple where\nthe i-th element comes from the i-th iterable argument.  The .next()\nmethod continues until the shortest iterable in the argument sequence\nis exhausted and then it raises StopIteration.  Works like the zip()\nfunction but consumes less memory by returning an iterator instead of\na list.'
    __class__ = izip
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    def __iter__(self):
        'x.__iter__() <==> iter(x)'
        return izip()
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def next(self):
        'x.next() -> the next value, or raise StopIteration'
        pass
    

class izip_longest(__builtin__.object):
    'izip_longest(iter1 [,iter2 [...]], [fillvalue=None]) --> izip_longest object\n\nReturn an izip_longest object whose .next() method returns a tuple where\nthe i-th element comes from the i-th iterable argument.  The .next()\nmethod continues until the longest iterable in the argument sequence\nis exhausted and then it raises StopIteration.  When the shorter iterables\nare exhausted, the fillvalue is substituted in their place.  The fillvalue\ndefaults to None or can be specified by a keyword argument.\n'
    __class__ = izip_longest
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    def __iter__(self):
        'x.__iter__() <==> iter(x)'
        return izip_longest()
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def next(self):
        'x.next() -> the next value, or raise StopIteration'
        pass
    

class permutations(__builtin__.object):
    'permutations(iterable[, r]) --> permutations object\n\nReturn successive r-length permutations of elements in the iterable.\n\npermutations(range(3), 2) --> (0,1), (0,2), (1,0), (1,2), (2,0), (2,1)'
    __class__ = permutations
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    def __iter__(self):
        'x.__iter__() <==> iter(x)'
        return permutations()
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def next(self):
        'x.next() -> the next value, or raise StopIteration'
        pass
    

class product(__builtin__.object):
    "product(*iterables) --> product object\n\nCartesian product of input iterables.  Equivalent to nested for-loops.\n\nFor example, product(A, B) returns the same as:  ((x,y) for x in A for y in B).\nThe leftmost iterators are in the outermost for-loop, so the output tuples\ncycle in a manner similar to an odometer (with the rightmost element changing\non every iteration).\n\nTo compute the product of an iterable with itself, specify the number\nof repetitions with the optional repeat keyword argument. For example,\nproduct(A, repeat=4) means the same as product(A, A, A, A).\n\nproduct('ab', range(3)) --> ('a',0) ('a',1) ('a',2) ('b',0) ('b',1) ('b',2)\nproduct((0,1), (0,1), (0,1)) --> (0,0,0) (0,0,1) (0,1,0) (0,1,1) (1,0,0) ..."
    __class__ = product
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    def __iter__(self):
        'x.__iter__() <==> iter(x)'
        return product()
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def next(self):
        'x.next() -> the next value, or raise StopIteration'
        pass
    

class repeat(__builtin__.object):
    'repeat(object [,times]) -> create an iterator which returns the object\nfor the specified number of times.  If not specified, returns the object\nendlessly.'
    __class__ = repeat
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    def __iter__(self):
        'x.__iter__() <==> iter(x)'
        return repeat()
    
    def __length_hint__(self):
        'Private method returning an estimate of len(list(it)).'
        return 0
    
    def __repr__(self):
        'x.__repr__() <==> repr(x)'
        return ''
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def next(self):
        'x.next() -> the next value, or raise StopIteration'
        pass
    

class starmap(__builtin__.object):
    'starmap(function, sequence) --> starmap object\n\nReturn an iterator whose values are returned from the function evaluated\nwith an argument tuple taken from the given sequence.'
    __class__ = starmap
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    def __iter__(self):
        'x.__iter__() <==> iter(x)'
        return starmap()
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def next(self):
        'x.next() -> the next value, or raise StopIteration'
        pass
    

class takewhile(__builtin__.object):
    'takewhile(predicate, iterable) --> takewhile object\n\nReturn successive entries from an iterable as long as the \npredicate evaluates to true for each entry.'
    __class__ = takewhile
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    def __iter__(self):
        'x.__iter__() <==> iter(x)'
        return takewhile()
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def next(self):
        'x.next() -> the next value, or raise StopIteration'
        pass
    

def tee(iterable, n=2):
    'tee(iterable, n=2) --> tuple of n independent iterators.'
    pass


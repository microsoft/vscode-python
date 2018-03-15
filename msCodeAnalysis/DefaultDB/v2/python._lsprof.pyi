import __builtin__

class Profiler(__builtin__.object):
    'Profiler(custom_timer=None, time_unit=None, subcalls=True, builtins=True)\n\n    Builds a profiler object using the specified timer function.\n    The default timer is a fast built-in one based on real time.\n    For custom timer functions returning integers, time_unit can\n    be a float specifying a scale (i.e. how long each integer unit\n    is, in seconds).\n'
    __class__ = Profiler
    def __init__(self, custom_timer=None, time_unit=None, subcalls=True, builtins=True):
        'x.__init__(...) initializes x; see help(type(x)) for signature'
        pass
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def clear(self):
        'clear()\n\nClear all profiling information collected so far.\n'
        pass
    
    def disable(self):
        'disable()\n\nStop collecting profiling information.\n'
        pass
    
    def enable(self, subcalls=True, builtins=True):
        "enable(subcalls=True, builtins=True)\n\nStart collecting profiling information.\nIf 'subcalls' is True, also records for each function\nstatistics separated according to its current caller.\nIf 'builtins' is True, records the time spent in\nbuilt-in functions separately from their caller.\n"
        pass
    
    def getstats(self):
        'getstats() -> list of profiler_entry objects\n\nReturn all information collected by the profiler.\nEach profiler_entry is a tuple-like object with the\nfollowing attributes:\n\n    code          code object\n    callcount     how many times this was called\n    reccallcount  how many times called recursively\n    totaltime     total time in this entry\n    inlinetime    inline time in this entry (not in subcalls)\n    calls         details of the calls\n\nThe calls attribute is either None or a list of\nprofiler_subentry objects:\n\n    code          called code object\n    callcount     how many times this is called\n    reccallcount  how many times this is called recursively\n    totaltime     total time spent in this call\n    inlinetime    inline time (not in further subcalls)\n'
        pass
    

__doc__ = 'Fast profiler'
__name__ = '_lsprof'
__package__ = None
class profiler_entry(__builtin__.object):
    def __add__(self, y):
        'x.__add__(y) <==> x+y'
        return profiler_entry()
    
    __class__ = profiler_entry
    def __contains__(self, value):
        'x.__contains__(y) <==> y in x'
        return False
    
    def __eq__(self, y):
        'x.__eq__(y) <==> x==y'
        return False
    
    def __ge__(self, y):
        'x.__ge__(y) <==> x>=y'
        return False
    
    def __getitem__(self, index):
        'x.__getitem__(y) <==> x[y]'
        pass
    
    def __getslice__(self, i, j):
        'x.__getslice__(i, j) <==> x[i:j]\n           \n           Use of negative indices is not supported.'
        return profiler_entry()
    
    def __gt__(self, y):
        'x.__gt__(y) <==> x>y'
        return False
    
    def __hash__(self):
        'x.__hash__() <==> hash(x)'
        return 0
    
    def __le__(self, y):
        'x.__le__(y) <==> x<=y'
        return False
    
    def __len__(self):
        'x.__len__() <==> len(x)'
        return 0
    
    def __lt__(self, y):
        'x.__lt__(y) <==> x<y'
        return False
    
    def __mul__(self, n):
        'x.__mul__(n) <==> x*n'
        return profiler_entry()
    
    def __ne__(self, y):
        'x.__ne__(y) <==> x!=y'
        return False
    
    def __reduce__(self):
        return ''; return ()
    
    def __repr__(self):
        'x.__repr__() <==> repr(x)'
        return ''
    
    def __rmul__(self, n):
        'x.__rmul__(n) <==> n*x'
        return profiler_entry()
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def callcount(self):
        'how many times this was called'
        pass
    
    @property
    def calls(self):
        'details of the calls'
        pass
    
    @property
    def code(self):
        'code object or built-in function name'
        pass
    
    @property
    def inlinetime(self):
        'inline time in this entry (not in subcalls)'
        pass
    
    n_fields = 6
    n_sequence_fields = 6
    n_unnamed_fields = 0
    @property
    def reccallcount(self):
        'how many times called recursively'
        pass
    
    @property
    def totaltime(self):
        'total time in this entry'
        pass
    

class profiler_subentry(__builtin__.object):
    def __add__(self, y):
        'x.__add__(y) <==> x+y'
        return profiler_subentry()
    
    __class__ = profiler_subentry
    def __contains__(self, value):
        'x.__contains__(y) <==> y in x'
        return False
    
    def __eq__(self, y):
        'x.__eq__(y) <==> x==y'
        return False
    
    def __ge__(self, y):
        'x.__ge__(y) <==> x>=y'
        return False
    
    def __getitem__(self, index):
        'x.__getitem__(y) <==> x[y]'
        pass
    
    def __getslice__(self, i, j):
        'x.__getslice__(i, j) <==> x[i:j]\n           \n           Use of negative indices is not supported.'
        return profiler_subentry()
    
    def __gt__(self, y):
        'x.__gt__(y) <==> x>y'
        return False
    
    def __hash__(self):
        'x.__hash__() <==> hash(x)'
        return 0
    
    def __le__(self, y):
        'x.__le__(y) <==> x<=y'
        return False
    
    def __len__(self):
        'x.__len__() <==> len(x)'
        return 0
    
    def __lt__(self, y):
        'x.__lt__(y) <==> x<y'
        return False
    
    def __mul__(self, n):
        'x.__mul__(n) <==> x*n'
        return profiler_subentry()
    
    def __ne__(self, y):
        'x.__ne__(y) <==> x!=y'
        return False
    
    def __reduce__(self):
        return ''; return ()
    
    def __repr__(self):
        'x.__repr__() <==> repr(x)'
        return ''
    
    def __rmul__(self, n):
        'x.__rmul__(n) <==> n*x'
        return profiler_subentry()
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def callcount(self):
        'how many times this is called'
        pass
    
    @property
    def code(self):
        'called code object or built-in function name'
        pass
    
    @property
    def inlinetime(self):
        'inline time (not in further subcalls)'
        pass
    
    n_fields = 5
    n_sequence_fields = 5
    n_unnamed_fields = 0
    @property
    def reccallcount(self):
        'how many times this is called recursively'
        pass
    
    @property
    def totaltime(self):
        'total time spent in this call'
        pass
    


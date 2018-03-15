import builtins

class Profiler(builtins.object):
    'Profiler(custom_timer=None, time_unit=None, subcalls=True, builtins=True)\n\n    Builds a profiler object using the specified timer function.\n    The default timer is a fast built-in one based on real time.\n    For custom timer functions returning integers, time_unit can\n    be a float specifying a scale (i.e. how long each integer unit\n    is, in seconds).\n'
    __class__ = Profiler
    def __init__(self, custom_timer=None, time_unit=None, subcalls=True, builtins=True):
        'Initialize self.  See help(type(self)) for accurate signature.'
        pass
    
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
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
__package__ = ''
class profiler_entry(builtins.tuple):
    __class__ = profiler_entry
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    def __reduce__(self):
        return ''; return ()
    
    def __repr__(self):
        'Return repr(self).'
        pass
    
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
    

class profiler_subentry(builtins.tuple):
    __class__ = profiler_subentry
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    def __reduce__(self):
        return ''; return ()
    
    def __repr__(self):
        'Return repr(self).'
        pass
    
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
    


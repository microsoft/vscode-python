import __builtin__

__doc__ = "xxsubtype is an example module showing how to subtype builtin types from C.\ntest_descr.py in the standard test suite requires it in order to complete.\nIf you don't care about the examples, and don't intend to run the Python\ntest suite, you can recompile Python without Modules/xxsubtype.c."
__name__ = 'xxsubtype'
__package__ = None
def bench():
    pass

class spamdict(__builtin__.dict):
    __class__ = spamdict
    def __init__(self):
        'x.__init__(...) initializes x; see help(type(x)) for signature'
        pass
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @classmethod
    def fromkeys(cls, self, S, v):
        'dict.fromkeys(S[,v]) -> New dict with keys from S and values equal to v.\nv defaults to None.'
        pass
    
    def getstate(self):
        'getstate() -> state'
        pass
    
    def setstate(self, state):
        'setstate(state)'
        pass
    
    @property
    def state(self):
        'an int variable for demonstration purposes'
        pass
    

class spamlist(__builtin__.list):
    __class__ = spamlist
    def __init__(self):
        'x.__init__(...) initializes x; see help(type(x)) for signature'
        pass
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @classmethod
    def classmeth(cls):
        'classmeth(*args, **kw)'
        pass
    
    def getstate(self):
        'getstate() -> state'
        pass
    
    def setstate(self, state):
        'setstate(state)'
        pass
    
    @property
    def state(self):
        'an int variable for demonstration purposes'
        pass
    
    @classmethod
    def staticmeth(cls):
        'staticmeth(*args, **kw)'
        pass
    


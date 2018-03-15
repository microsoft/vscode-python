import exceptions

__doc__ = None
__name__ = 'audioop'
__package__ = None
def add():
    pass

def adpcm2lin():
    pass

def alaw2lin():
    pass

def avg():
    pass

def avgpp():
    pass

def bias():
    pass

def cross():
    pass

class error(exceptions.Exception):
    __class__ = error
    __dict__ = __builtin__.dict()
    __module__ = 'audioop'
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def __weakref__(self):
        'list of weak references to the object (if defined)'
        pass
    

def findfactor():
    pass

def findfit():
    pass

def findmax():
    pass

def getsample():
    pass

def lin2adpcm():
    pass

def lin2alaw():
    pass

def lin2lin():
    pass

def lin2ulaw():
    pass

def max():
    pass

def maxpp():
    pass

def minmax():
    pass

def mul():
    pass

def ratecv():
    pass

def reverse():
    pass

def rms():
    pass

def tomono():
    pass

def tostereo():
    pass

def ulaw2lin():
    pass


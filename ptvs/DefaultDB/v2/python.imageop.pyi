import exceptions

__doc__ = None
__name__ = 'imageop'
__package__ = None
def crop():
    pass

def dither2grey2():
    pass

def dither2mono():
    pass

class error(exceptions.Exception):
    __class__ = error
    __dict__ = __builtin__.dict()
    __module__ = 'imageop'
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def __weakref__(self):
        'list of weak references to the object (if defined)'
        pass
    

def grey22grey():
    pass

def grey2grey2():
    pass

def grey2grey4():
    pass

def grey2mono():
    pass

def grey2rgb():
    pass

def grey42grey():
    pass

def mono2grey():
    pass

def rgb2grey():
    pass

def rgb2rgb8():
    pass

def rgb82rgb():
    pass

def scale():
    pass

def tovideo():
    pass


import builtins

st = builtins.type
class ParserError(builtins.Exception):
    __class__ = ParserError
    __dict__ = builtins.dict()
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    __module__ = 'parser'
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def __weakref__(self):
        'list of weak references to the object (if defined)'
        pass
    

STType = st()
__copyright__ = 'Copyright 1995-1996 by Virginia Polytechnic Institute & State\nUniversity, Blacksburg, Virginia, USA, and Fred L. Drake, Jr., Reston,\nVirginia, USA.  Portions copyright 1991-1995 by Stichting Mathematisch\nCentrum, Amsterdam, The Netherlands.'
__doc__ = "This is an interface to Python's internal parser."
__name__ = 'parser'
__package__ = ''
__version__ = '0.5'
def _pickler():
    'Returns the pickle magic to allow ST objects to be pickled.'
    pass

def compilest():
    'Compiles an ST object into a code object.'
    pass

def expr():
    'Creates an ST object from an expression.'
    pass

def isexpr():
    'Determines if an ST object was created from an expression.'
    pass

def issuite():
    'Determines if an ST object was created from a suite.'
    pass

def sequence2st():
    'Creates an ST object from a tree representation.'
    pass

def st2list():
    'Creates a list-tree representation of an ST.'
    pass

def st2tuple():
    'Creates a tuple-tree representation of an ST.'
    pass

def suite():
    'Creates an ST object from a suite.'
    pass

def tuple2st():
    'Creates an ST object from a tree representation.'
    pass


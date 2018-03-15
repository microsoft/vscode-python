import __builtin__
import exceptions

class BadPickleGet(UnpicklingError):
    __class__ = BadPickleGet
    __dict__ = __builtin__.dict()
    __module__ = 'cPickle'
    def __str__(self):
        return ''
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    

HIGHEST_PROTOCOL = 2
class PickleError(exceptions.Exception):
    __class__ = PickleError
    __dict__ = __builtin__.dict()
    __module__ = 'cPickle'
    def __str__(self):
        return ''
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def __weakref__(self):
        'list of weak references to the object (if defined)'
        pass
    

def Pickler(file, protocol=0):
    'Pickler(file, protocol=0) -- Create a pickler.\n\nThis takes a file-like object for writing a pickle data stream.\nThe optional proto argument tells the pickler to use the given\nprotocol; supported protocols are 0, 1, 2.  The default\nprotocol is 0, to be backwards compatible.  (Protocol 0 is the\nonly protocol that can be written to a file opened in text\nmode and read back successfully.  When using a protocol higher\nthan 0, make sure the file is opened in binary mode, both when\npickling and unpickling.)\n\nProtocol 1 is more efficient than protocol 0; protocol 2 is\nmore efficient than protocol 1.\n\nSpecifying a negative protocol version selects the highest\nprotocol version supported.  The higher the protocol used, the\nmore recent the version of Python needed to read the pickle\nproduced.\n\nThe file parameter must have a write() method that accepts a single\nstring argument.  It can thus be an open file object, a StringIO\nobject, or any other custom object that meets this interface.\n'
    pass

class PicklingError(PickleError):
    __class__ = PicklingError
    __dict__ = __builtin__.dict()
    __module__ = 'cPickle'
    def __str__(self):
        return ''
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    

class UnpickleableError(PicklingError):
    __class__ = UnpickleableError
    __dict__ = __builtin__.dict()
    __module__ = 'cPickle'
    def __str__(self):
        return ''
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    

def Unpickler(file):
    'Unpickler(file) -- Create an unpickler.'
    pass

class UnpicklingError(PickleError):
    __class__ = UnpicklingError
    __dict__ = __builtin__.dict()
    __module__ = 'cPickle'
    def __str__(self):
        return ''
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    

__builtins__ = __builtin__.dict()
__doc__ = 'C implementation and optimization of the Python pickle module.'
__name__ = 'cPickle'
__package__ = None
__version__ = '1.71'
compatible_formats = __builtin__.list()
def dump(obj, file, protocol=0):
    'dump(obj, file, protocol=0) -- Write an object in pickle format to the given file.\n\nSee the Pickler docstring for the meaning of optional argument proto.'
    pass

def dumps(obj, protocol=0):
    'dumps(obj, protocol=0) -- Return a string containing an object in pickle format.\n\nSee the Pickler docstring for the meaning of optional argument proto.'
    pass

format_version = '2.0'
def load(file):
    'load(file) -- Load a pickle from the given file'
    pass

def loads(string):
    'loads(string) -- Load a pickle from the given string'
    pass


import __builtin__

C_BUILTIN = 6
C_EXTENSION = 3
IMP_HOOK = 9
class NullImporter(__builtin__.object):
    'Null importer object'
    __class__ = NullImporter
    def __init__(self):
        'x.__init__(...) initializes x; see help(type(x)) for signature'
        pass
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def find_module(self):
        'Always return None'
        pass
    

PKG_DIRECTORY = 5
PY_CODERESOURCE = 8
PY_COMPILED = 2
PY_FROZEN = 7
PY_RESOURCE = 4
PY_SOURCE = 1
SEARCH_ERROR = 0
__doc__ = 'This module provides the components needed to build your own\n__import__ function.  Undocumented functions are obsolete.'
__name__ = 'imp'
__package__ = None
def acquire_lock():
    "acquire_lock() -> None\nAcquires the interpreter's import lock for the current thread.\nThis lock should be used by import hooks to ensure thread-safety\nwhen importing modules.\nOn platforms without threads, this function does nothing."
    pass

def find_module(name, path):
    "find_module(name, [path]) -> (file, filename, (suffix, mode, type))\nSearch for a module.  If path is omitted or None, search for a\nbuilt-in, frozen or special module and continue search in sys.path.\nThe module name cannot contain '.'; to search for a submodule of a\npackage, pass the submodule name and the package's __path__."
    pass

def get_frozen_object():
    pass

def get_magic():
    'get_magic() -> string\nReturn the magic number for .pyc or .pyo files.'
    pass

def get_suffixes():
    'get_suffixes() -> [(suffix, mode, type), ...]\nReturn a list of (suffix, mode, type) tuples describing the files\nthat find_module() looks for.'
    pass

def init_builtin():
    pass

def init_frozen():
    pass

def is_builtin():
    pass

def is_frozen():
    pass

def load_compiled():
    pass

def load_dynamic():
    pass

def load_module(name, file, filename, (suffix, mode, type)):
    'load_module(name, file, filename, (suffix, mode, type)) -> module\nLoad a module, given information returned by find_module().\nThe module name must include the full package name, if any.'
    pass

def load_package():
    pass

def load_source():
    pass

def lock_held():
    'lock_held() -> boolean\nReturn True if the import lock is currently held, else False.\nOn platforms without threads, return False.'
    pass

def new_module(name):
    'new_module(name) -> module\nCreate a new module.  Do not enter it in sys.modules.\nThe module name must include the full package name, if any.'
    pass

def release_lock():
    "release_lock() -> None\nRelease the interpreter's import lock.\nOn platforms without threads, this function does nothing."
    pass

def reload(module):
    'reload(module) -> module\n\nReload the module.  The module must have been successfully imported before.'
    pass


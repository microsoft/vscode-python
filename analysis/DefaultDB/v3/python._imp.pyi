__doc__ = '(Extremely) low-level import machinery bits as used by importlib and imp.'
__name__ = '_imp'
__package__ = ''
def _fix_co_filename(code, path):
    'Changes code.co_filename to specify the passed-in file path.\n\n  code\n    Code object to change.\n  path\n    File path to use.'
    pass

def acquire_lock():
    "Acquires the interpreter's import lock for the current thread.\n\nThis lock should be used by import hooks to ensure thread-safety when importing\nmodules. On platforms without threads, this function does nothing."
    pass

def create_builtin(spec):
    'Create an extension module.'
    pass

def create_dynamic(spec, file):
    'Create an extension module.'
    pass

def exec_builtin(mod):
    'Initialize a built-in module.'
    pass

def exec_dynamic(mod):
    'Initialize an extension module.'
    pass

def extension_suffixes():
    'Returns the list of file suffixes used to identify extension modules.'
    pass

def get_frozen_object(name):
    'Create a code object for a frozen module.'
    pass

def init_frozen(name):
    'Initializes a frozen module.'
    pass

def is_builtin(name):
    'Returns True if the module name corresponds to a built-in module.'
    pass

def is_frozen(name):
    'Returns True if the module name corresponds to a frozen module.'
    pass

def is_frozen_package(name):
    'Returns True if the module name is of a frozen package.'
    pass

def lock_held():
    'Return True if the import lock is currently held, else False.\n\nOn platforms without threads, return False.'
    pass

def release_lock():
    "Release the interpreter's import lock.\n\nOn platforms without threads, this function does nothing."
    pass


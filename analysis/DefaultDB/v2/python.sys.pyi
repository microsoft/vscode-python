import __builtin__
import exceptions

def __displayhook__():
    'displayhook(object) -> None\n\nPrint an object to sys.stdout and also save it in __builtin__._\n'
    pass

__doc__ = "This module provides access to some objects used or maintained by the\ninterpreter and to functions that interact strongly with the interpreter.\n\nDynamic objects:\n\nargv -- command line arguments; argv[0] is the script pathname if known\npath -- module search path; path[0] is the script directory, else ''\nmodules -- dictionary of loaded modules\n\ndisplayhook -- called to show results in an interactive session\nexcepthook -- called to handle any uncaught exception other than SystemExit\n  To customize printing in an interactive session or to install a custom\n  top-level exception handler, assign other functions to replace these.\n\nexitfunc -- if sys.exitfunc exists, this routine is called when Python exits\n  Assigning to sys.exitfunc is deprecated; use the atexit module instead.\n\nstdin -- standard input file object; used by raw_input() and input()\nstdout -- standard output file object; used by the print statement\nstderr -- standard error object; used for error messages\n  By assigning other file objects (or objects that behave like files)\n  to these, it is possible to redirect all of the interpreter's I/O.\n\nlast_type -- type of last uncaught exception\nlast_value -- value of last uncaught exception\nlast_traceback -- traceback of last uncaught exception\n  These three are only available in an interactive session after a\n  traceback has been printed.\n\nexc_type -- type of exception currently being handled\nexc_value -- value of exception currently being handled\nexc_traceback -- traceback of exception currently being handled\n  The function exc_info() should be used instead of these three,\n  because it is thread-safe.\n\nStatic objects:\n\nfloat_info -- a dict with information about the float inplementation.\nlong_info -- a struct sequence with information about the long implementation.\nmaxint -- the largest supported integer (the smallest is -maxint-1)\nmaxsize -- the largest supported length of containers.\nmaxunicode -- the largest supported character\nbuiltin_module_names -- tuple of module names built into this interpreter\nversion -- the version of this interpreter as a string\nversion_info -- version information as a named tuple\nhexversion -- version information encoded as a single integer\ncopyright -- copyright notice pertaining to this interpreter\nplatform -- platform identifier\nexecutable -- absolute path of the executable binary of the Python interpreter\nprefix -- prefix used to find the Python library\nexec_prefix -- prefix used to find the machine-specific Python library\nfloat_repr_style -- string indicating the style of repr() output for floats\ndllhandle -- [Windows only] integer handle of the Python DLL\nwinver -- [Windows only] version number of the Python DLL\n__stdin__ -- the original stdin; don't touch!\n__stdout__ -- the original stdout; don't touch!\n__stderr__ -- the original stderr; don't touch!\n__displayhook__ -- the original displayhook; don't touch!\n__excepthook__ -- the original excepthook; don't touch!\n\nFunctions:\n\ndisplayhook() -- print an object to the screen, and save it in __builtin__._\nexcepthook() -- print an exception and its traceback to sys.stderr\nexc_info() -- return thread-safe information about the current exception\nexc_clear() -- clear the exception state for the current thread\nexit() -- exit the interpreter by raising SystemExit\ngetdlopenflags() -- returns flags to be used for dlopen() calls\ngetprofile() -- get the global profiling function\ngetrefcount() -- return the reference count for an object (plus one :-)\ngetrecursionlimit() -- return the max recursion depth for the interpreter\ngetsizeof() -- return the size of an object in bytes\ngettrace() -- get the global debug tracing function\nsetcheckinterval() -- control how often the interpreter checks for events\nsetdlopenflags() -- set the flags to be used for dlopen() calls\nsetprofile() -- set the global profiling function\nsetrecursionlimit() -- set the max recursion depth for the interpreter\nsettrace() -- set the global debug tracing function\n"
def __excepthook__():
    'excepthook(exctype, value, traceback) -> None\n\nHandle an exception by displaying it with a traceback on sys.stderr.\n'
    pass

__name__ = 'sys'
__package__ = None
__stderr__ = __builtin__.file()
__stdin__ = __builtin__.file()
__stdout__ = __builtin__.file()
def _clear_type_cache():
    '_clear_type_cache() -> None\nClear the internal type lookup cache.'
    pass

def _current_frames():
    "_current_frames() -> dictionary\n\nReturn a dictionary mapping each current thread T's thread id to T's\ncurrent stack frame.\n\nThis function should be used for specialized purposes only."
    pass

def _getframe(depth):
    '_getframe([depth]) -> frameobject\n\nReturn a frame object from the call stack.  If optional integer depth is\ngiven, return the frame object that many calls below the top of the stack.\nIf that is deeper than the call stack, ValueError is raised.  The default\nfor depth is zero, returning the frame at the top of the call stack.\n\nThis function should be used for internal and specialized\npurposes only.'
    pass

_git = __builtin__.tuple()
api_version = 1013
argv = __builtin__.list()
builtin_module_names = __builtin__.tuple()
byteorder = 'little'
def call_tracing(func, args):
    'call_tracing(func, args) -> object\n\nCall func(*args), while tracing is enabled.  The tracing state is\nsaved, and restored afterwards.  This is intended to be called from\na debugger from a checkpoint, to recursively debug some other code.'
    pass

def callstats():
    'callstats() -> tuple of integers\n\nReturn a tuple of function call statistics, if CALL_PROFILE was defined\nwhen Python was built.  Otherwise, return None.\n\nWhen enabled, this function returns detailed, implementation-specific\ndetails about the number of function calls executed. The return value is\na 11-tuple where the entries in the tuple are counts of:\n0. all function calls\n1. calls to PyFunction_Type objects\n2. PyFunction calls that do not create an argument tuple\n3. PyFunction calls that do not create an argument tuple\n   and bypass PyEval_EvalCodeEx()\n4. PyMethod calls\n5. PyMethod calls on bound methods\n6. PyType calls\n7. PyCFunction calls\n8. generator calls\n9. All other calls\n10. Number of stack pops performed by call_function()'
    pass

copyright = 'Copyright (c) 2001-2017 Python Software Foundation.\nAll Rights Reserved.\n\nCopyright (c) 2000 BeOpen.com.\nAll Rights Reserved.\n\nCopyright (c) 1995-2001 Corporation for National Research Initiatives.\nAll Rights Reserved.\n\nCopyright (c) 1991-1995 Stichting Mathematisch Centrum, Amsterdam.\nAll Rights Reserved.'
def displayhook(object):
    'displayhook(object) -> None\n\nPrint an object to sys.stdout and also save it in __builtin__._\n'
    pass

dllhandle = 1572667392L
dont_write_bytecode = False
def exc_clear():
    'exc_clear() -> None\n\nClear global information on the current exception.  Subsequent calls to\nexc_info() will return (None,None,None) until another exception is raised\nin the current thread or the execution stack returns to a frame where\nanother exception is being handled.'
    pass

def exc_info():
    'exc_info() -> (type, value, traceback)\n\nReturn information about the most recent exception caught by an except\nclause in the current stack frame or in an older stack frame.'
    pass

exc_traceback = __builtin__.traceback()
exc_type = exceptions.KeyError
exc_value = exceptions.KeyError()
def excepthook(exctype, value, traceback):
    'excepthook(exctype, value, traceback) -> None\n\nHandle an exception by displaying it with a traceback on sys.stderr.\n'
    pass

exec_prefix = 'C:\\PTVS\\packages\\python2.2.7.14\\tools'
executable = 'C:\\PTVS\\packages\\python2.2.7.14\\tools\\python.exe'
def exit(status):
    'exit([status])\n\nExit the interpreter by raising SystemExit(status).\nIf the status is omitted or None, it defaults to zero (i.e., success).\nIf the status is an integer, it will be used as the system exit status.\nIf it is another kind of object, it will be printed and the system\nexit status will be one (i.e., failure).'
    pass

class flags:
    'sys.flags\n\nFlags provided through command line arguments or environment vars.'
    @staticmethod
    def __add__(self, y):
        'x.__add__(y) <==> x+y'
        return __T__()
    
    __class__ = flags
    @staticmethod
    def __contains__(self, value):
        'x.__contains__(y) <==> y in x'
        return False
    
    @staticmethod
    def __delattr__():
        "x.__delattr__('name') <==> del x.name"
        return None
    
    @staticmethod
    def __eq__(self, y):
        'x.__eq__(y) <==> x==y'
        return False
    
    @staticmethod
    def __format__(self, format_spec):
        'default object formatter'
        return ''
    
    @staticmethod
    def __ge__(self, y):
        'x.__ge__(y) <==> x>=y'
        return False
    
    @staticmethod
    def __getattribute__():
        "x.__getattribute__('name') <==> x.name"
        pass
    
    @staticmethod
    def __getitem__(self, index):
        'x.__getitem__(y) <==> x[y]'
        pass
    
    @staticmethod
    def __getslice__(self, i, j):
        'x.__getslice__(i, j) <==> x[i:j]\n           \n           Use of negative indices is not supported.'
        return __T__()
    
    @staticmethod
    def __gt__(self, y):
        'x.__gt__(y) <==> x>y'
        return False
    
    @staticmethod
    def __hash__(self):
        'x.__hash__() <==> hash(x)'
        return 0
    
    @staticmethod
    def __init__():
        'x.__init__(...) initializes x; see help(type(x)) for signature'
        pass
    
    @staticmethod
    def __le__(self, y):
        'x.__le__(y) <==> x<=y'
        return False
    
    @staticmethod
    def __len__(self):
        'x.__len__() <==> len(x)'
        return 0
    
    @staticmethod
    def __lt__(self, y):
        'x.__lt__(y) <==> x<y'
        return False
    
    @staticmethod
    def __mul__(self, n):
        'x.__mul__(n) <==> x*n'
        return __T__()
    
    @staticmethod
    def __ne__(self, y):
        'x.__ne__(y) <==> x!=y'
        return False
    
    @staticmethod
    def __reduce__(self):
        return ''; return ()
    
    @staticmethod
    def __reduce_ex__(self, protocol):
        'helper for pickle'
        return ''; return ()
    
    @staticmethod
    def __repr__(self):
        'x.__repr__() <==> repr(x)'
        return ''
    
    @staticmethod
    def __rmul__(self, n):
        'x.__rmul__(n) <==> n*x'
        return __T__()
    
    @staticmethod
    def __setattr__():
        "x.__setattr__('name', value) <==> x.name = value"
        return None
    
    @staticmethod
    def __sizeof__(self):
        '__sizeof__() -> int\nsize of object in memory, in bytes'
        return 0
    
    @staticmethod
    def __str__(self):
        'x.__str__() <==> str(x)'
        return ''
    
    @staticmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    bytes_warning = 0
    debug = 0
    division_new = 0
    division_warning = 0
    dont_write_bytecode = 0
    hash_randomization = 0
    ignore_environment = 0
    inspect = 0
    interactive = 0
    n_fields = 16
    n_sequence_fields = 16
    n_unnamed_fields = 0
    no_site = 0
    no_user_site = 0
    optimize = 0
    py3k_warning = 0
    tabcheck = 0
    unicode = 0
    verbose = 0

class float_info:
    "sys.float_info\n\nA structseq holding information about the float type. It contains low level\ninformation about the precision and internal representation. Please study\nyour system's :file:`float.h` for more information."
    @staticmethod
    def __add__(self, y):
        'x.__add__(y) <==> x+y'
        return __T__()
    
    __class__ = float_info
    @staticmethod
    def __contains__(self, value):
        'x.__contains__(y) <==> y in x'
        return False
    
    @staticmethod
    def __delattr__():
        "x.__delattr__('name') <==> del x.name"
        return None
    
    @staticmethod
    def __eq__(self, y):
        'x.__eq__(y) <==> x==y'
        return False
    
    @staticmethod
    def __format__(self, format_spec):
        'default object formatter'
        return ''
    
    @staticmethod
    def __ge__(self, y):
        'x.__ge__(y) <==> x>=y'
        return False
    
    @staticmethod
    def __getattribute__():
        "x.__getattribute__('name') <==> x.name"
        pass
    
    @staticmethod
    def __getitem__(self, index):
        'x.__getitem__(y) <==> x[y]'
        pass
    
    @staticmethod
    def __getslice__(self, i, j):
        'x.__getslice__(i, j) <==> x[i:j]\n           \n           Use of negative indices is not supported.'
        return __T__()
    
    @staticmethod
    def __gt__(self, y):
        'x.__gt__(y) <==> x>y'
        return False
    
    @staticmethod
    def __hash__(self):
        'x.__hash__() <==> hash(x)'
        return 0
    
    @staticmethod
    def __init__():
        'x.__init__(...) initializes x; see help(type(x)) for signature'
        pass
    
    @staticmethod
    def __le__(self, y):
        'x.__le__(y) <==> x<=y'
        return False
    
    @staticmethod
    def __len__(self):
        'x.__len__() <==> len(x)'
        return 0
    
    @staticmethod
    def __lt__(self, y):
        'x.__lt__(y) <==> x<y'
        return False
    
    @staticmethod
    def __mul__(self, n):
        'x.__mul__(n) <==> x*n'
        return __T__()
    
    @staticmethod
    def __ne__(self, y):
        'x.__ne__(y) <==> x!=y'
        return False
    
    @staticmethod
    def __reduce__(self):
        return ''; return ()
    
    @staticmethod
    def __reduce_ex__(self, protocol):
        'helper for pickle'
        return ''; return ()
    
    @staticmethod
    def __repr__(self):
        'x.__repr__() <==> repr(x)'
        return ''
    
    @staticmethod
    def __rmul__(self, n):
        'x.__rmul__(n) <==> n*x'
        return __T__()
    
    @staticmethod
    def __setattr__():
        "x.__setattr__('name', value) <==> x.name = value"
        return None
    
    @staticmethod
    def __sizeof__(self):
        '__sizeof__() -> int\nsize of object in memory, in bytes'
        return 0
    
    @staticmethod
    def __str__(self):
        'x.__str__() <==> str(x)'
        return ''
    
    @staticmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    dig = 15
    epsilon = 2.220446049250313e-16
    mant_dig = 53
    max = 1.7976931348623157e+308
    max_10_exp = 308
    max_exp = 1024
    min = 2.2250738585072014e-308
    min_10_exp = -307
    min_exp = -1021
    n_fields = 11
    n_sequence_fields = 11
    n_unnamed_fields = 0
    radix = 2
    rounds = 1

float_repr_style = 'short'
def getcheckinterval():
    'getcheckinterval() -> current check interval; see setcheckinterval().'
    pass

def getdefaultencoding():
    'getdefaultencoding() -> string\n\nReturn the current default string encoding used by the Unicode \nimplementation.'
    pass

def getfilesystemencoding():
    'getfilesystemencoding() -> string\n\nReturn the encoding used to convert Unicode filenames in\noperating system filenames.'
    pass

def getprofile():
    'getprofile()\n\nReturn the profiling function set with sys.setprofile.\nSee the profiler chapter in the library manual.'
    pass

def getrecursionlimit():
    'getrecursionlimit()\n\nReturn the current value of the recursion limit, the maximum depth\nof the Python interpreter stack.  This limit prevents infinite\nrecursion from causing an overflow of the C stack and crashing Python.'
    pass

def getrefcount(object):
    'getrefcount(object) -> integer\n\nReturn the reference count of object.  The count returned is generally\none higher than you might expect, because it includes the (temporary)\nreference as an argument to getrefcount().'
    pass

def getsizeof(object, default):
    'getsizeof(object, default) -> int\n\nReturn the size of object in bytes.'
    pass

def gettrace():
    'gettrace()\n\nReturn the global debug tracing function set with sys.settrace.\nSee the debugger chapter in the library manual.'
    pass

def getwindowsversion():
    'getwindowsversion()\n\nReturn information about the running version of Windows as a named tuple.\nThe members are named: major, minor, build, platform, service_pack,\nservice_pack_major, service_pack_minor, suite_mask, and product_type. For\nbackward compatibility, only the first 5 items are available by indexing.\nAll elements are numbers, except service_pack which is a string. Platform\nmay be 0 for win32s, 1 for Windows 9x/ME, 2 for Windows NT/2000/XP/Vista/7,\n3 for Windows CE. Product_type may be 1 for a workstation, 2 for a domain\ncontroller, 3 for a server.'
    pass

hexversion = 34017008
class long_info:
    "sys.long_info\n\nA struct sequence that holds information about Python's\ninternal representation of integers.  The attributes are read only."
    @staticmethod
    def __add__(self, y):
        'x.__add__(y) <==> x+y'
        return __T__()
    
    __class__ = long_info
    @staticmethod
    def __contains__(self, value):
        'x.__contains__(y) <==> y in x'
        return False
    
    @staticmethod
    def __delattr__():
        "x.__delattr__('name') <==> del x.name"
        return None
    
    @staticmethod
    def __eq__(self, y):
        'x.__eq__(y) <==> x==y'
        return False
    
    @staticmethod
    def __format__(self, format_spec):
        'default object formatter'
        return ''
    
    @staticmethod
    def __ge__(self, y):
        'x.__ge__(y) <==> x>=y'
        return False
    
    @staticmethod
    def __getattribute__():
        "x.__getattribute__('name') <==> x.name"
        pass
    
    @staticmethod
    def __getitem__(self, index):
        'x.__getitem__(y) <==> x[y]'
        pass
    
    @staticmethod
    def __getslice__(self, i, j):
        'x.__getslice__(i, j) <==> x[i:j]\n           \n           Use of negative indices is not supported.'
        return __T__()
    
    @staticmethod
    def __gt__(self, y):
        'x.__gt__(y) <==> x>y'
        return False
    
    @staticmethod
    def __hash__(self):
        'x.__hash__() <==> hash(x)'
        return 0
    
    @staticmethod
    def __init__():
        'x.__init__(...) initializes x; see help(type(x)) for signature'
        pass
    
    @staticmethod
    def __le__(self, y):
        'x.__le__(y) <==> x<=y'
        return False
    
    @staticmethod
    def __len__(self):
        'x.__len__() <==> len(x)'
        return 0
    
    @staticmethod
    def __lt__(self, y):
        'x.__lt__(y) <==> x<y'
        return False
    
    @staticmethod
    def __mul__(self, n):
        'x.__mul__(n) <==> x*n'
        return __T__()
    
    @staticmethod
    def __ne__(self, y):
        'x.__ne__(y) <==> x!=y'
        return False
    
    @staticmethod
    def __reduce__(self):
        return ''; return ()
    
    @staticmethod
    def __reduce_ex__(self, protocol):
        'helper for pickle'
        return ''; return ()
    
    @staticmethod
    def __repr__(self):
        'x.__repr__() <==> repr(x)'
        return ''
    
    @staticmethod
    def __rmul__(self, n):
        'x.__rmul__(n) <==> n*x'
        return __T__()
    
    @staticmethod
    def __setattr__():
        "x.__setattr__('name', value) <==> x.name = value"
        return None
    
    @staticmethod
    def __sizeof__(self):
        '__sizeof__() -> int\nsize of object in memory, in bytes'
        return 0
    
    @staticmethod
    def __str__(self):
        'x.__str__() <==> str(x)'
        return ''
    
    @staticmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    bits_per_digit = 30
    n_fields = 2
    n_sequence_fields = 2
    n_unnamed_fields = 0
    sizeof_digit = 4

maxint = 2147483647
maxsize = 9223372036854775807L
maxunicode = 65535
meta_path = __builtin__.list()
modules = __builtin__.dict()
path = __builtin__.list()
path_hooks = __builtin__.list()
path_importer_cache = __builtin__.dict()
platform = 'win32'
prefix = 'C:\\PTVS\\packages\\python2.2.7.14\\tools'
py3kwarning = False
def setcheckinterval(n):
    'setcheckinterval(n)\n\nTell the Python interpreter to check for asynchronous events every\nn instructions.  This also affects how often thread switches occur.'
    pass

def setprofile(function):
    'setprofile(function)\n\nSet the profiling function.  It will be called on each function call\nand return.  See the profiler chapter in the library manual.'
    pass

def setrecursionlimit(n):
    'setrecursionlimit(n)\n\nSet the maximum depth of the Python interpreter stack to n.  This\nlimit prevents infinite recursion from causing an overflow of the C\nstack and crashing Python.  The highest possible limit is platform-\ndependent.'
    pass

def settrace(function):
    'settrace(function)\n\nSet the global debug tracing function.  It will be called on each\nfunction call.  See the debugger chapter in the library manual.'
    pass

stderr = __builtin__.file()
stdin = __builtin__.file()
stdout = __builtin__.file()
subversion = __builtin__.tuple()
version = '2.7.14 (v2.7.14:84471935ed, Sep 16 2017, 20:25:58) [MSC v.1500 64 bit (AMD64)]'
class version_info:
    'sys.version_info\n\nVersion information as a named tuple.'
    @staticmethod
    def __add__(self, y):
        'x.__add__(y) <==> x+y'
        return __T__()
    
    __class__ = version_info
    @staticmethod
    def __contains__(self, value):
        'x.__contains__(y) <==> y in x'
        return False
    
    @staticmethod
    def __delattr__():
        "x.__delattr__('name') <==> del x.name"
        return None
    
    @staticmethod
    def __eq__(self, y):
        'x.__eq__(y) <==> x==y'
        return False
    
    @staticmethod
    def __format__(self, format_spec):
        'default object formatter'
        return ''
    
    @staticmethod
    def __ge__(self, y):
        'x.__ge__(y) <==> x>=y'
        return False
    
    @staticmethod
    def __getattribute__():
        "x.__getattribute__('name') <==> x.name"
        pass
    
    @staticmethod
    def __getitem__(self, index):
        'x.__getitem__(y) <==> x[y]'
        pass
    
    @staticmethod
    def __getslice__(self, i, j):
        'x.__getslice__(i, j) <==> x[i:j]\n           \n           Use of negative indices is not supported.'
        return __T__()
    
    @staticmethod
    def __gt__(self, y):
        'x.__gt__(y) <==> x>y'
        return False
    
    @staticmethod
    def __hash__(self):
        'x.__hash__() <==> hash(x)'
        return 0
    
    @staticmethod
    def __init__():
        'x.__init__(...) initializes x; see help(type(x)) for signature'
        pass
    
    @staticmethod
    def __le__(self, y):
        'x.__le__(y) <==> x<=y'
        return False
    
    @staticmethod
    def __len__(self):
        'x.__len__() <==> len(x)'
        return 0
    
    @staticmethod
    def __lt__(self, y):
        'x.__lt__(y) <==> x<y'
        return False
    
    @staticmethod
    def __mul__(self, n):
        'x.__mul__(n) <==> x*n'
        return __T__()
    
    @staticmethod
    def __ne__(self, y):
        'x.__ne__(y) <==> x!=y'
        return False
    
    @staticmethod
    def __reduce__(self):
        return ''; return ()
    
    @staticmethod
    def __reduce_ex__(self, protocol):
        'helper for pickle'
        return ''; return ()
    
    @staticmethod
    def __repr__(self):
        'x.__repr__() <==> repr(x)'
        return ''
    
    @staticmethod
    def __rmul__(self, n):
        'x.__rmul__(n) <==> n*x'
        return __T__()
    
    @staticmethod
    def __setattr__():
        "x.__setattr__('name', value) <==> x.name = value"
        return None
    
    @staticmethod
    def __sizeof__(self):
        '__sizeof__() -> int\nsize of object in memory, in bytes'
        return 0
    
    @staticmethod
    def __str__(self):
        'x.__str__() <==> str(x)'
        return ''
    
    @staticmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    major = 2
    micro = 14
    minor = 7
    n_fields = 5
    n_sequence_fields = 5
    n_unnamed_fields = 0
    releaselevel = 'final'
    serial = 0

warnoptions = __builtin__.list()
winver = '2.7'

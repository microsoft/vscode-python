import __builtin__
import exceptions

CLASSMETHOD_TYPES = __builtin__.tuple()
CLASS_MEMBER_SUBSTITUTE = __builtin__.dict()
EXCLUDED_MEMBERS = __builtin__.tuple()
class InspectWarning(exceptions.UserWarning):
    __class__ = InspectWarning
    __dict__ = __builtin__.dict()
    __module__ = '__main__'
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def __weakref__(self):
        'list of weak references to the object (if defined)'
        pass
    

LIES_ABOUT_MODULE = __builtin__.frozenset()
MODULE_MEMBER_SUBSTITUTE = __builtin__.dict()
class MemberInfo(__builtin__.object):
    NO_VALUE = __builtin__.object()
    __class__ = MemberInfo
    __dict__ = __builtin__.dict()
    def __init__(self, name, value, literal, scope, module, alias, module_doc, scope_alias):
        pass
    
    __module__ = '__main__'
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def __weakref__(self):
        'list of weak references to the object (if defined)'
        pass
    
    def _get_typename(self, cls, value_type, in_module):
        pass
    
    def _lines_with_members(self):
        pass
    
    def _lines_with_signature(self):
        pass
    
    def _str_from_literal(self, lit):
        pass
    
    def _str_from_typename(self, type_name):
        pass
    
    def _str_from_value(self, v):
        pass
    
    def as_str(self, indent):
        pass
    

PROPERTY_TYPES = __builtin__.tuple()
SKIP_TYPENAME_FOR_TYPES = __builtin__.tuple()
STATICMETHOD_TYPES = __builtin__.tuple()
class ScrapeState(__builtin__.object):
    __class__ = ScrapeState
    __dict__ = __builtin__.dict()
    def __init__(self, module_name, module):
        pass
    
    __module__ = '__main__'
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def __weakref__(self):
        'list of weak references to the object (if defined)'
        pass
    
    def _collect_members(self, mod, members, substitutes, outer_member):
        'Fills the members attribute with a dictionary containing\n        all members from the module.'
        pass
    
    def _mro_contains(self, mro, name, value):
        pass
    
    def _should_add_value(self, value):
        pass
    
    def _should_collect_members(self, member):
        pass
    
    def collect_second_level_members(self):
        pass
    
    def collect_top_level_members(self):
        pass
    
    def dump(self, out):
        pass
    
    def initial_import(self, search_path):
        pass
    
    def translate_members(self):
        pass
    

class Signature(__builtin__.object):
    DefaultValueWriter = DefaultValueWriter()
    KNOWN_ARGSPECS = __builtin__.dict()
    KNOWN_RESTYPES = __builtin__.dict()
    _AST_ARG_TYPES = __builtin__.tuple()
    __class__ = Signature
    __dict__ = __builtin__.dict()
    def __init__(self, name, callable, scope, defaults, scope_alias, decorators, module_doc):
        pass
    
    __module__ = '__main__'
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
    
    def _ast_arg_to_str(self, arg, default, seen_names):
        'Converts an AST argument object into a string.'
        pass
    
    def _ast_args_to_list(self, node):
        pass
    
    def _get_first_function_call(self, expr):
        'Scans the string for the first closing parenthesis,\n        handling nesting, which is the best heuristic we have for\n        an example call at the start of the docstring.'
        pass
    
    def _init_argspec_fromargspec(self, defaults):
        pass
    
    def _init_argspec_fromdocstring(self, defaults, doc):
        pass
    
    def _init_argspec_fromknown(self, defaults, scope_alias):
        pass
    
    def _init_argspec_fromsignature(self, defaults):
        pass
    
    def _init_restype_fromknown(self, scope_alias):
        pass
    
    def _init_restype_fromsignature(self):
        pass
    
    def _insert_default_arguments(self, args, defaults):
        pass
    
    def _parse_funcdef(self, expr, allow_name_mismatch):
        'Takes a call expression that was part of a docstring\n        and parses the AST as if it were a definition. If the parsed\n        AST matches the callable we are wrapping, returns the node.\n        '
        pass
    

VALUE_REPR_FIX = __builtin__.dict()
__author__ = 'Microsoft Corporation <ptvshelp@microsoft.com>'
__builtins__ = __builtin__.dict()
__doc__ = None
__file__ = 'C:\\PTVS\\Python\\Product\\Analysis\\scrape_module.py'
__name__ = '__main__'
__package__ = None
__version__ = '3.2'
__warningregistry__ = __builtin__.dict()
def _triple_quote(s):
    pass

def add_builtin_objects(state):
    pass

outfile = __builtin__.file()
print_function = __builtin__.instance()
def safe_callable(v):
    pass

state = ScrapeState()

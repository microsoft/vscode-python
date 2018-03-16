# Python Tools for Visual Studio
# Copyright(c) Microsoft Corporation
# All rights reserved.
# 
# Licensed under the Apache License, Version 2.0 (the License); you may not use
# this file except in compliance with the License. You may obtain a copy of the
# License at http://www.apache.org/licenses/LICENSE-2.0
# 
# THIS CODE IS PROVIDED ON AN  *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS
# OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY
# IMPLIED WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
# MERCHANTABLITY OR NON-INFRINGEMENT.
# 
# See the Apache Version 2.0 License for specific language governing
# permissions and limitations under the License.

__author__ = "Microsoft Corporation <ptvshelp@microsoft.com>"
__version__ = "3.0.0.0"

import re
import sys
import types
import PythonScraper
try:
    import thread
except:
    import _thread as thread

try:
    import __builtin__ as __builtins__
except ImportError:
    import builtins as __builtins__

def safe_dir(obj):
    try:
        return frozenset(obj.__dict__) | frozenset(dir(obj))
    except:
        # Some types crash when we access __dict__ and/or dir()
        pass
    try:
        return frozenset(dir(obj))
    except:
        pass
    try:
        return frozenset(obj.__dict__)
    except:
        pass
    return frozenset()

def builtins_keys():
    if isinstance(__builtins__, dict):
        return __builtins__.keys()
    return dir(__builtins__)

def get_builtin(name):
    if isinstance(__builtins__, dict):
        return __builtins__[name]

    return getattr(__builtins__, name)

safe_getattr = PythonScraper.safe_getattr

BUILTIN_TYPES = [type_name for type_name in builtins_keys() if type(get_builtin(type_name)) is type]
if sys.version_info[0] >= 3:
    BUILTIN = 'builtins'
    unicode = str
else:
    BUILTIN = '__builtin__'

TYPE_OVERRIDES = {
    'string': PythonScraper.type_to_typeref(types.CodeType),
    's': PythonScraper.type_to_typeref(str),
    'integer': PythonScraper.type_to_typeref(int),
    'boolean': PythonScraper.type_to_typeref(bool),
    'number': PythonScraper.type_to_typeref(int),
    'pid': PythonScraper.type_to_typeref(int),
    'ppid': PythonScraper.type_to_typeref(int),
    'fd': PythonScraper.type_to_typeref(int),
    'handle': PythonScraper.type_to_typeref(int),
    'Exit': PythonScraper.type_to_typeref(int),
    'fd2': PythonScraper.type_to_typeref(int),
    'Integral': PythonScraper.type_to_typeref(int),
    'exit_status':PythonScraper.type_to_typeref(int),
    'old_mask': PythonScraper.type_to_typeref(int),
    'source': PythonScraper.type_to_typeref(str),
    'newpos': PythonScraper.type_to_typeref(int),
    'key': PythonScraper.type_to_typeref(str),
    'dictionary': PythonScraper.type_to_typeref(dict),
    'None': PythonScraper.type_to_typeref(type(None)),
    'floating': PythonScraper.type_to_typeref(float),
    'filename': PythonScraper.type_to_typeref(str),
    'path': PythonScraper.type_to_typeref(str),
    'byteswritten': PythonScraper.type_to_typeref(int),
    'unicode': PythonScraper.type_to_typeref(unicode),
    'Unicode': PythonScraper.type_to_typeref(unicode),
    'True':  PythonScraper.type_to_typeref(bool),
    'False':  PythonScraper.type_to_typeref(bool),
    'lock': PythonScraper.type_to_typeref(thread.LockType),
    'code': PythonScraper.type_to_typeref(types.CodeType),
    'module': PythonScraper.type_to_typeref(types.ModuleType),
    'size': PythonScraper.type_to_typeref(int),
    'INT': PythonScraper.type_to_typeref(int),
    'STRING': PythonScraper.type_to_typeref(str),
    'TUPLE': PythonScraper.type_to_typeref(tuple),
    'OBJECT': PythonScraper.type_to_typeref(object),
    'LIST': PythonScraper.type_to_typeref(list),
    'DICT': PythonScraper.type_to_typeref(dict),
    'char *': PythonScraper.type_to_typeref(str),
    'wchar_t *': PythonScraper.type_to_typeref(unicode),
    'CHAR *': PythonScraper.type_to_typeref(str),
    'TCHAR *': PythonScraper.type_to_typeref(str),
    'WCHAR *': PythonScraper.type_to_typeref(unicode),
    'LPSTR': PythonScraper.type_to_typeref(str),
    'LPCSTR': PythonScraper.type_to_typeref(str),
    'LPTSTR': PythonScraper.type_to_typeref(str),
    'LPCTSTR': PythonScraper.type_to_typeref(str),
    'LPWSTR': PythonScraper.type_to_typeref(unicode),
    'LPCWSTR': PythonScraper.type_to_typeref(unicode),
}

try:
    TYPE_OVERRIDES['file object'] = PythonScraper.type_to_typeref(file)
except NameError:
    try:
        import _io
        TYPE_OVERRIDES['file object'] = PythonScraper.type_to_typeref(_io._IOBase)  
    except (NameError, ImportError):
        pass

RETURN_TYPE_OVERRIDES = dict(TYPE_OVERRIDES)
RETURN_TYPE_OVERRIDES.update({'string': PythonScraper.type_to_typeref(str)})

def type_name_to_typeref(name, mod, type_overrides = TYPE_OVERRIDES):
    arg_type = type_overrides.get(name, None)
    if arg_type is None:
        if name in BUILTIN_TYPES:
            arg_type = PythonScraper.type_to_typeref(get_builtin(name))
        elif mod is not None and name in mod.__dict__:
            arg_type = PythonScraper.typename_to_typeref(mod.__name__, name)
        elif name.startswith('list'):
            arg_type = PythonScraper.type_to_typeref(list)
        else:
            # see if we can find it in any module we've imported...
            for mod_name, mod in list(sys.modules.items()):
                if mod is not None and name in mod.__dict__ and isinstance(mod.__dict__[name], type):
                    arg_type = PythonScraper.typename_to_typeref(mod_name, name)
                    break
            else:
                first_space = name.find(' ')
                if first_space != -1:
                    return type_name_to_typeref(name[:first_space], mod, type_overrides)
                arg_type = PythonScraper.typename_to_typeref(name)
    return arg_type

OBJECT_TYPE = PythonScraper.type_to_typeref(object)

TOKENS_REGEX = '(' + '|'.join([
    r'(?:[a-zA-Z_][0-9a-zA-Z_-]*)',  # identifier
    r'(?:-?[0-9]+[lL]?(?!\.))',      # integer value
    r'(?:-?[0-9]*\.[0-9]+)',         # floating point value
    r'(?:-?[0-9]+\.[0-9]*)',         # floating point value
    r'(?:\s*\'.*?(?<!\\)\')',        # single-quote string
    r'(?:\s*".*?(?<!\\)")',          # double-quote string
    r'(?:\.\.\.)',                   # ellipsis
    r'(?:\.)',                       # dot
    r'(?:\()',                       # open paren
    r'(?:\))',                       # close paren
    r'(?:\:)',                       # colon
    r'(?:-->)',                      # return value
    r'(?:->)',                       # return value
    r'(?:=>)',                       # return value
    r'(?:,)',                        # comma
    r'(?:=)',                        # assignment (default value)
    r'(?:\[)',
    r'(?:\])',
    r'(?:\*\*)',
    r'(?:\*)',
]) + ')'

def get_ret_type(ret_type, obj_class, mod):
    if ret_type is not None:
        if ret_type == 'copy' and obj_class is not None:
            # returns a copy of self
            return PythonScraper.type_to_typelist(obj_class)
        else:
            return [type_name_to_typeref(ret_type, mod, RETURN_TYPE_OVERRIDES)]


RETURNS_REGEX = [r'^\s*returns?[\s\-]*[a-z_]\w*\s*:\s*([a-z_]\w*)']

def update_overload_from_doc_str(overload, doc_str, obj_class, mod):
    # see if we can get additional information from the doc string
    if 'ret_type' not in overload:
        for ret_regex in RETURNS_REGEX:
            match = re.search(ret_regex, doc_str, re.MULTILINE | re.IGNORECASE)
            if match:
                ret_type = match.groups(0)[0]
                overload['ret_type'] = get_ret_type(ret_type, obj_class, mod)
                break


def parse_doc_str(input_str, module_name, mod, func_name, extra_args = [], obj_class = None):    
    # we split, so as long as we have all tokens every other item is a token, and the
    # rest are empty space.  If we have unrecognized tokens (for example during the description
    # of the function) those will show up in the even locations.  We do join's and bring the
    # entire range together in that case.
    tokens = re.split(TOKENS_REGEX, input_str) 
    start_token = 0
    last_identifier = None
    cur_token = 1
    overloads = []
    while cur_token < len(tokens):
        token = tokens[cur_token]
        # see if we have modname.funcname(
        if (cur_token + 10 < len(tokens) and
            token == module_name and 
            tokens[cur_token + 2] == '.' and
            tokens[cur_token + 4] == func_name and
            tokens[cur_token + 6] == '('):
            sig_start = cur_token
            args, ret_type, cur_token = parse_args(tokens, cur_token + 8, mod)

            doc_str = ''.join(tokens[start_token:sig_start])
            if doc_str.find(' ') == -1:
                doc_str = ''
            if (not args or doc_str) and overloads:
                # if we already parsed an overload, and are now getting an argless
                # overload we're likely just seeing a reference to the function in
                # a doc string, let's ignore that.  This is betting on the idea that
                # people list overloads first, then doc strings, and that people tend
                # to list overloads from simplest to more complex. an example of this
                # is the future_builtins.ascii doc string
                # We also skip it if we have a doc string, this comes up in overloads
                # like isinstance which has example calls embedded in the doc string
                continue

            start_token = cur_token
            overload = {'args': tuple(extra_args + args), 'doc': doc_str}
            ret_types = get_ret_type(ret_type, obj_class, mod)
            if ret_types is not None:
                overload['ret_type'] = ret_types
            update_overload_from_doc_str(overload, doc_str, obj_class, mod)
            overloads.append(overload)
        # see if we have funcname(
        elif (cur_token + 4 < len(tokens) and
              token == func_name and
              tokens[cur_token + 2] == '('):
            sig_start = cur_token
            args, ret_type, cur_token = parse_args(tokens, cur_token + 4, mod)

            doc_str = ''.join(tokens[start_token:sig_start])
            if doc_str.find(' ') == -1:
                doc_str = ''
            if (not args or doc_str) and overloads:
                # if we already parsed an overload, and are now getting an argless
                # overload we're likely just seeing a reference to the function in
                # a doc string, let's ignore that.  This is betting on the idea that
                # people list overloads first, then doc strings, and that people tend
                # to list overloads from simplest to more complex. an example of this
                # is the future_builtins.ascii doc string
                # We also skip it if we have a doc string, this comes up in overloads
                # like isinstance which has example calls embedded in the doc string
                continue
            
            start_token = cur_token
            overload = {'args': tuple(extra_args + args), 'doc': doc_str}
            ret_types = get_ret_type(ret_type, obj_class, mod)
            if ret_types is not None:
                overload['ret_type'] = ret_types
            update_overload_from_doc_str(overload, doc_str, obj_class, mod)
            overloads.append(overload)

        else:
            # append to doc string
            cur_token += 2

    finish_doc = ''.join(tokens[start_token:cur_token])
    if finish_doc:
        if not overloads:
            # This occurs when the docstring does not include a function spec
            overloads.append({
                'args': ({'name': 'args', 'arg_format': '*'}, {'name': 'kwargs', 'arg_format': '**'}),
                'doc': ''
            })
        for overload in overloads:
            overload['doc'] += finish_doc
            update_overload_from_doc_str(overload, overload['doc'], obj_class, mod)

    return overloads


IDENTIFIER_REGEX = re.compile('^[a-zA-Z_][a-zA-Z_0-9-]*$')

def is_identifier(token):
    if IDENTIFIER_REGEX.match(token):
        return True
    return False

RETURN_TOKENS = set(['-->', '->', '=>', 'return'])

def parse_args(tokens, cur_token, module):
    args = []

    arg = []
    annotation = None
    default_value = None
    ignore = False
    arg_tokens = []
    next_is_optional = False
    is_optional = False
    paren_nesting = 0
    while cur_token < len(tokens):
        token = tokens[cur_token]
        cur_token += 1

        if token in (',', ')') and paren_nesting == 0:
            arg_tokens.append((arg, annotation, default_value, is_optional))
            is_optional = False
            arg = []
            annotation = None
            default_value = None
            if token == ')':
                cur_token += 1
                break
        elif ignore:
            continue
        elif token == '=':
            if default_value is None:
                default_value = []
            else:
                ignore = True
        elif token == ':':
            if annotation is None and default_value is None:
                annotation = []
            else:
                ignore = True
        elif default_value is not None:
            default_value.append(token)
        elif annotation is not None:
            annotation.append(token)
        elif token == '[':
            next_is_optional = True
        elif token in (']', ' ', ''):
            pass
        else:
            arg.append(token)
            if next_is_optional:
                is_optional, next_is_optional = True, False

        if token == '(':
            paren_nesting += 1
        elif token == ')':
            paren_nesting -= 1

    #from pprint import pprint; pprint(arg_tokens)

    for arg, annotation, default_value, is_optional in arg_tokens:
        if not arg or arg[0] == '/':
            continue

        arg_name = None
        star_args = None

        if arg[0] == '(':
            names = [arg.pop(0)]
            while names[-1] != ')' and arg:
                names.append(arg.pop(0))
            if names[-1] == ')':
                names.pop()
            arg_name = ', '.join(n for n in names[1:] if is_identifier(n))
        elif is_identifier(arg[-1]):
            arg_name = arg.pop()
        elif arg[-1] == '...':
            arg_name = 'args'
            star_args = '*'
        
        if not annotation and arg:
            if len(arg) > 1 and arg[-1] == '*':
                # C style prototype
                annotation = [' '.join(a for a in arg if a != 'const')]
            elif is_identifier(arg[-1]):
                annotation = arg[-1:]
            elif arg[-1] == ')':
                annotation = [arg.pop()]
                while annotation[0] != '(':
                    annotation.insert(0, arg.pop())

        if arg and arg[0] in ('*', '**'):
            star_args = arg[0]

        data = { }

        if arg_name:
            data['name'] = arg_name
        elif star_args == '*':
            data['name'] = 'args'
        elif star_args == '**':
            data['name'] = 'kwargs'
        else:
            data['name'] = 'arg'
        
        if annotation and len(annotation) == 1:
            data['type'] = [type_name_to_typeref(annotation[0], module)]
           
        if default_value:
            default_value = [d for d in default_value if d]
            
            if is_optional and default_value[-1] == ']':
                default_value.pop()

            data['default_value'] = ''.join(default_value).strip()
        elif is_optional:
            data['default_value'] = 'None'

        if star_args:
            data['arg_format'] = star_args

        args.append(data)


    # end of params, check for ret value
    ret_type = None

    if cur_token + 2 < len(tokens) and tokens[cur_token] in RETURN_TOKENS:
        ret_type_start = cur_token + 2
        # we might have a descriptive return value, 'list of fob'
        while ret_type_start < len(tokens) and is_identifier(tokens[ret_type_start]):
            if tokens[ret_type_start - 1].find('\n') != -1:
                break
            ret_type_start += 2

        if ret_type_start < len(tokens) and ',' in tokens[ret_type_start]:
            # fob(oar, baz) -> some info about the return, and more info, and more info.
            # "some info" is unlikely to be a return type
            ret_type = ''
            cur_token += 2
        else:
            ret_type = ''.join(tokens[cur_token + 2:ret_type_start]).strip()
            cur_token = ret_type_start
    elif (cur_token + 4 < len(tokens) and 
        tokens[cur_token] == ':' and tokens[cur_token + 2] in RETURN_TOKENS):
        ret_type_start = cur_token + 4
        # we might have a descriptive return value, 'list of fob'
        while ret_type_start < len(tokens) and is_identifier(tokens[ret_type_start]):
            if tokens[ret_type_start - 1].find('\n') != -1:
                break
            ret_type_start += 2

        if ret_type_start < len(tokens) and ',' in tokens[ret_type_start]:
            # fob(oar, baz) -> some info about the return, and more info, and more info.
            # "some info" is unlikely to be a return type
            ret_type = ''
            cur_token += 4
        else:
            ret_type = ''.join(tokens[cur_token + 4:ret_type_start]).strip()
            cur_token = ret_type_start

    return args, ret_type, cur_token


if sys.version > '3.':
    str_types = (str, bytes)
else:
    str_types = (str, unicode)


def get_overloads_from_doc_string(doc_str, mod, obj_class, func_name, extra_args = []):
    if isinstance(doc_str, str_types):
        decl_mod = None
        if isinstance(mod, types.ModuleType):
            decl_mod = mod
            mod = decl_mod.__name__
        elif mod is not None:
            decl_mod = sys.modules.get(mod, None)

        res = parse_doc_str(doc_str, mod, decl_mod, func_name, extra_args, obj_class)
        if res:
            for i, v in enumerate(res):
                if 'ret_type' not in v or (not v['ret_type'] or v['ret_type'] == ('', '')):
                    alt_ret_type = v['doc'].find('returned as a ')
                    if alt_ret_type != -1:
                        last_space = v['doc'].find(' ', alt_ret_type + 14)
                        last_new_line = v['doc'].find('\n', alt_ret_type + 14)
                        if last_space == -1:
                            if last_new_line == -1:
                                last_space = None
                            else:
                                last_space = last_new_line
                        elif last_new_line == -1:
                            last_space = None
                        else:
                            last_space = last_new_line
                        
                        ret_type_str = v['doc'][alt_ret_type+14:last_space]
                        if ret_type_str.endswith('.') or ret_type_str.endswith(','):
                            ret_type_str = ret_type_str[:-1]
                        new_ret_type = get_ret_type(ret_type_str, obj_class, decl_mod)
                        res[i]['ret_type'] = new_ret_type

            return res
    return None


def get_overloads(func, is_method = False):
    if is_method:
        extra_args = [{'type': PythonScraper.type_to_typelist(object), 'name': 'self'}]
    else:
        extra_args = []

    func_doc = safe_getattr(func, '__doc__', None)
    if not func_doc:
        return None
    
    return get_overloads_from_doc_string(
        func_doc, 
        safe_getattr(func, '__module__', None), 
        safe_getattr(func, '__objclass__', None),
        safe_getattr(func, '__name__', None),
        extra_args,
    )

def get_descriptor_type(descriptor):
    return object

def get_new_overloads(type_obj, obj):
    try:
        type_doc = safe_getattr(type_obj, '__doc__', None)
        type_type = type(type_obj)
    except:
        return None
    
    res = get_overloads_from_doc_string(
        type_doc, 
        safe_getattr(type_obj, '__module__', None), 
        type_type, 
        safe_getattr(type_obj, '__name__', None),
        [{'type': PythonScraper.type_to_typelist(type), 'name': 'cls'}],
    )

    if not res:
        obj_doc = safe_getattr(obj, '__doc__', None)
        if not obj_doc:
            return None
        res = get_overloads_from_doc_string(
            obj_doc, 
            safe_getattr(type_obj, '__module__', None), 
            type_type, 
            safe_getattr(type_obj, '__name__', None),
        )

    return res

def should_include_module(name):
    return True

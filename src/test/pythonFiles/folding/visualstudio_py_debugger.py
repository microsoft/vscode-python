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
# With number of modifications by Don Jayamanne

from __future__ import with_statement

__author__ = "Microsoft Corporation <ptvshelp@microsoft.com>"
__version__ = "3.0.0.0"

# This module MUST NOT import threading in global scope. This is because in a direct (non-ptvsd)
# attach scenario, it is loaded on the injected debugger attach thread, and if threading module
# hasn't been loaded already, it will assume that the thread on which it is being loaded is the
# main thread. This will cause issues when the thread goes away after attach completes.
_threading = None

import sys
import ctypes
try:
    import thread
except ImportError:
    import _thread as thread
import socket
import struct
import weakref
import traceback
import types
import bisect
from os import path
import ntpath
import runpy
import datetime
from codecs import BOM_UTF8

try:
    # In the local attach scenario, visualstudio_py_util is injected into globals()
    # by PyDebugAttach before loading this module, and cannot be imported.
    _vspu = visualstudio_py_util
except:
    try:
        import visualstudio_py_util as _vspu
    except ImportError:
        import ptvsd.visualstudio_py_util as _vspu

to_bytes = _vspu.to_bytes
exec_file = _vspu.exec_file
exec_module = _vspu.exec_module
exec_code = _vspu.exec_code
read_bytes = _vspu.read_bytes
read_int = _vspu.read_int
read_string = _vspu.read_string
write_bytes = _vspu.write_bytes
write_int = _vspu.write_int
write_string = _vspu.write_string
safe_repr = _vspu.SafeRepr()

try:
    # In the local attach scenario, visualstudio_py_repl is injected into globals()
    # by PyDebugAttach before loading this module, and cannot be imported.
    _vspr = visualstudio_py_repl
except:
    try:
        import visualstudio_py_repl as _vspr
    except ImportError:
        import ptvsd.visualstudio_py_repl as _vspr

try:
    import stackless
except ImportError:
    stackless = None

try:
    xrange
except:
    xrange = range

if sys.platform == 'cli':
    import clr
    from System.Runtime.CompilerServices import ConditionalWeakTable
    IPY_SEEN_MODULES = ConditionalWeakTable[object, object]()

# Import encodings early to avoid import on the debugger thread, which may cause deadlock
from encodings import utf_8

# WARNING: Avoid imports beyond this point, specifically on the debugger thread, as this may cause
# deadlock where the debugger thread performs an import while a user thread has the import lock

# save start_new_thread so we can call it later, we'll intercept others calls to it.

debugger_dll_handle = None
DETACHED = True
def thread_creator(func, args, kwargs = {}, *extra_args):
    if not isinstance(args, tuple):
        # args is not a tuple. This may be because we have become bound to a
        # class, which has offset our arguments by one.
        if isinstance(kwargs, tuple):
            func, args = args, kwargs
            kwargs = extra_args[0] if len(extra_args) > 0 else {}

    return _start_new_thread(new_thread_wrapper, (func, args, kwargs))

_start_new_thread = thread.start_new_thread
THREADS = {}
THREADS_LOCK = thread.allocate_lock()
MODULES = []

BREAK_ON_SYSTEMEXIT_ZERO = False
DEBUG_STDLIB = False
DJANGO_DEBUG = False

RICH_EXCEPTIONS = False
IGNORE_DJANGO_TEMPLATE_WARNINGS = False

# Py3k compat - alias unicode to str
try:
    unicode
except:
    unicode = str

# A value of a synthesized child. The string is passed through to the variable list, and type is not displayed at all.
class SynthesizedValue(object):
    def __init__(self, repr_value='', len_value=None):
        self.repr_value = repr_value
        self.len_value = len_value
    def __repr__(self):
        return self.repr_value
    def __len__(self):
        return self.len_value

# Specifies list of files not to debug. Can be extended by other modules
# (the REPL does this for $attach support and not stepping into the REPL).
DONT_DEBUG = [path.normcase(__file__), path.normcase(_vspu.__file__)]
if sys.version_info >= (3, 3):
    DONT_DEBUG.append(path.normcase('<frozen importlib._bootstrap>'))
if sys.version_info >= (3, 5):
    DONT_DEBUG.append(path.normcase('<frozen importlib._bootstrap_external>'))

# Contains information about all breakpoints in the process. Keys are line numbers on which
# there are breakpoints in any file, and values are dicts. For every line number, the
# corresponding dict contains all the breakpoints that fall on that line. The keys in that
# dict are tuples of the form (filename, breakpoint_id), each entry representing a single
# breakpoint, and values are BreakpointInfo objects.
#
# For example, given the following breakpoints:
#
#   1. In 'main.py' at line 10.
#   2. In 'main.py' at line 20.
#   3. In 'module.py' at line 10.
#
# the contents of BREAKPOINTS would be:
# {10: {('main.py', 1): ..., ('module.py', 3): ...}, 20: {('main.py', 2): ... }}
BREAKPOINTS = {}

# Contains information about all pending (i.e. not yet bound) breakpoints in the process.
# Elements are BreakpointInfo objects.
PENDING_BREAKPOINTS = set()

# Must be in sync with enum PythonBreakpointConditionKind in PythonBreakpoint.cs
BREAKPOINT_CONDITION_ALWAYS = 0
BREAKPOINT_CONDITION_WHEN_TRUE = 1
BREAKPOINT_CONDITION_WHEN_CHANGED = 2

# Must be in sync with enum PythonBreakpointPassCountKind in PythonBreakpoint.cs
BREAKPOINT_PASS_COUNT_ALWAYS = 0
BREAKPOINT_PASS_COUNT_EVERY = 1
BREAKPOINT_PASS_COUNT_WHEN_EQUAL = 2
BREAKPOINT_PASS_COUNT_WHEN_EQUAL_OR_GREATER = 3

## Begin modification by Don Jayamanne
DJANGO_VERSIONS_IDENTIFIED = False
IS_DJANGO18 = False
IS_DJANGO19 = False
IS_DJANGO19_OR_HIGHER = False

try:
    dict_contains = dict.has_key
except:
    try:
        #Py3k does not have has_key anymore, and older versions don't have __contains__
        dict_contains = dict.__contains__
    except:
        try:
            dict_contains = dict.has_key
        except NameError:
            def dict_contains(d, key):
                return d.has_key(key)
## End modification by Don Jayamanne

class BreakpointInfo(object):
    __slots__ = [
        'breakpoint_id', 'filename', 'lineno', 'condition_kind', 'condition',
        'pass_count_kind', 'pass_count', 'is_bound', 'last_condition_value',
        'hit_count'
    ]

    # For "when changed" breakpoints, this is used as the initial value of last_condition_value,
    # such that it is guaranteed to not compare equal to any other value that it will get later.
    _DUMMY_LAST_VALUE = object()

    def __init__(self, breakpoint_id, filename, lineno, condition_kind, condition, pass_count_kind, pass_count):
        self.breakpoint_id = breakpoint_id
        self.filename = filename
        self.lineno = lineno
        self.condition_kind = condition_kind
        self.condition = condition
        self.pass_count_kind = pass_count_kind
        self.pass_count = pass_count
        self.is_bound = False
        self.last_condition_value = BreakpointInfo._DUMMY_LAST_VALUE
        self.hit_count = 0

    @staticmethod
    def find_by_id(breakpoint_id):
        for line, bp_dict in BREAKPOINTS.items():
            for (filename, bp_id), bp in bp_dict.items():
                if bp_id == breakpoint_id:
                    return bp
        return None

# lock for calling .send on the socket
send_lock = thread.allocate_lock()

class _SendLockContextManager(object):
    """context manager for send lock.  Handles both acquiring/releasing the
       send lock as well as detaching the debugger if the remote process
       is disconnected"""

    def __enter__(self):
        # mark that we're about to do socket I/O so we won't deliver
        # debug events when we're debugging the standard library
        cur_thread = get_thread_from_id(thread.get_ident())
        if cur_thread is not None:
            cur_thread.is_sending = True

        send_lock.acquire()

    def __exit__(self, exc_type, exc_value, tb):
        send_lock.release()

        # start sending debug events again
        cur_thread = get_thread_from_id(thread.get_ident())
        if cur_thread is not None:
            cur_thread.is_sending = False

        if exc_type is not None:
            detach_threads()
            detach_process()
            # swallow the exception, we're no longer debugging
            return True

_SendLockCtx = _SendLockContextManager()

SEND_BREAK_COMPLETE = False

STEPPING_OUT = -1  # first value, we decrement below this
STEPPING_NONE = 0
STEPPING_BREAK = 1
STEPPING_LAUNCH_BREAK = 2
STEPPING_ATTACH_BREAK = 3
STEPPING_INTO = 4
STEPPING_OVER = 5     # last value, we increment past this.

USER_STEPPING = (STEPPING_OUT, STEPPING_INTO, STEPPING_OVER)

FRAME_KIND_NONE = 0
FRAME_KIND_PYTHON = 1
FRAME_KIND_DJANGO = 2

DJANGO_BUILTINS = {'True': True, 'False': False, 'None': None}

PYTHON_EVALUATION_RESULT_REPR_KIND_NORMAL = 0    # regular repr and hex repr (if applicable) for the evaluation result; length is len(result)
PYTHON_EVALUATION_RESULT_REPR_KIND_RAW = 1       # repr is raw representation of the value - see TYPES_WITH_RAW_REPR; length is len(repr)
PYTHON_EVALUATION_RESULT_REPR_KIND_RAWLEN = 2    # same as above, but only the length is reported, not the actual value

PYTHON_EVALUATION_RESULT_EXPANDABLE = 1
PYTHON_EVALUATION_RESULT_METHOD_CALL = 2
PYTHON_EVALUATION_RESULT_SIDE_EFFECTS = 4
PYTHON_EVALUATION_RESULT_RAW = 8
PYTHON_EVALUATION_RESULT_HAS_RAW_REPR = 16

# Don't show attributes of these types if they come from the class (assume they are methods).
METHOD_TYPES = (
    types.FunctionType,
    types.MethodType,
    types.BuiltinFunctionType,
    type("".__repr__), # method-wrapper
)

# repr() for these types can be used as input for eval() to get the original value.
# float is intentionally not included because it is not always round-trippable (e.g inf, nan).
TYPES_WITH_ROUND_TRIPPING_REPR = set((type(None), int, bool, str, unicode))
if sys.version[0] == '3':
    TYPES_WITH_ROUND_TRIPPING_REPR.add(bytes)
else:
    TYPES_WITH_ROUND_TRIPPING_REPR.add(long)

# repr() for these types can be used as input for eval() to get the original value, provided that the same is true for all their elements.
COLLECTION_TYPES_WITH_ROUND_TRIPPING_REPR = set((tuple, list, set, frozenset))

# eval(repr(x)), but optimized for common types for which it is known that result == x.
def eval_repr(x):
    def is_repr_round_tripping(x):
        # Do exact type checks here - subclasses can override __repr__.
        if type(x) in TYPES_WITH_ROUND_TRIPPING_REPR:
            return True
        elif type(x) in COLLECTION_TYPES_WITH_ROUND_TRIPPING_REPR:
            # All standard sequence types are round-trippable if their elements are.
            return all((is_repr_round_tripping(item) for item in x))
        else:
            return False
    if is_repr_round_tripping(x):
        return x
    else:
        return eval(repr(x), {})

# key is type, value is function producing the raw repr
TYPES_WITH_RAW_REPR = {
    unicode: (lambda s: s)
}

# bytearray is 2.6+
try:
    # getfilesystemencoding is used here because it effectively corresponds to the notion of "locale encoding":
    # current ANSI codepage on Windows, LC_CTYPE on Linux, UTF-8 on OS X - which is exactly what we want.
    TYPES_WITH_RAW_REPR[bytearray] = lambda b: b.decode(sys.getfilesystemencoding(), 'ignore')
except:
    pass

if sys.version[0] == '3':
    TYPES_WITH_RAW_REPR[bytes] = TYPES_WITH_RAW_REPR[bytearray]
else:
    TYPES_WITH_RAW_REPR[str] = TYPES_WITH_RAW_REPR[unicode]

if sys.version[0] == '3':
  # work around a crashing bug on CPython 3.x where they take a hard stack overflow
  # we'll never see this exception but it'll allow us to keep our try/except handler
  # the same across all versions of Python
    class StackOverflowException(Exception): pass
else:
    StackOverflowException = RuntimeError

ASBR = to_bytes('ASBR')
SETL = to_bytes('SETL')
THRF = to_bytes('THRF')
DETC = to_bytes('DETC')
NEWT = to_bytes('NEWT')
EXTT = to_bytes('EXTT')
EXIT = to_bytes('EXIT')
EXCP = to_bytes('EXCP')
EXC2 = to_bytes('EXC2')
MODL = to_bytes('MODL')
STPD = to_bytes('STPD')
BRKS = to_bytes('BRKS')
BRKF = to_bytes('BRKF')
BRKH = to_bytes('BRKH')
BRKC = to_bytes('BRKC')
BKHC = to_bytes('BKHC')
LOAD = to_bytes('LOAD')
EXCE = to_bytes('EXCE')
EXCR = to_bytes('EXCR')
CHLD = to_bytes('CHLD')
OUTP = to_bytes('OUTP')
REQH = to_bytes('REQH')
LAST = to_bytes('LAST')

def get_thread_from_id(id):
    THREADS_LOCK.acquire()
    try:
        return THREADS.get(id)
    finally:
        THREADS_LOCK.release()

def should_send_frame(frame):
    return (frame is not None and
            frame.f_code not in DEBUG_ENTRYPOINTS and
            path.normcase(frame.f_code.co_filename) not in DONT_DEBUG)

KNOWN_DIRECTORIES = set((None, ''))
KNOWN_ZIPS = set()

def is_file_in_zip(filename):
    parent, name = path.split(path.abspath(filename))
    if parent in KNOWN_DIRECTORIES:
        return False
    elif parent in KNOWN_ZIPS:
        return True
    elif path.isdir(parent):
        KNOWN_DIRECTORIES.add(parent)
        return False
    else:
        KNOWN_ZIPS.add(parent)
        return True

def lookup_builtin(name, frame):
    try:
        return frame.f_builtins.get(bits)
    except:
        # http://ironpython.codeplex.com/workitem/30908
        builtins = frame.f_globals['__builtins__']
        if not isinstance(builtins, dict):
            builtins = builtins.__dict__
        return builtins.get(name)

def lookup_local(frame, name):
    bits = name.split('.')
    obj = frame.f_locals.get(bits[0]) or frame.f_globals.get(bits[0]) or lookup_builtin(bits[0], frame)
    bits.pop(0)
    while bits and obj is not None and type(obj) is types.ModuleType:
        obj = getattr(obj, bits.pop(0), None)
    return obj

if sys.version_info[0] >= 3:
    _EXCEPTIONS_MODULE = 'builtins'
else:
    _EXCEPTIONS_MODULE = 'exceptions'

def get_exception_name(exc_type):
    if exc_type.__module__ == _EXCEPTIONS_MODULE:
        return exc_type.__name__
    else:
        return exc_type.__module__ + '.' + exc_type.__name__

# These constants come from Visual Studio - enum_EXCEPTION_STATE
BREAK_MODE_NEVER = 0
BREAK_MODE_ALWAYS = 1
BREAK_MODE_UNHANDLED = 32

BREAK_TYPE_NONE = 0
BREAK_TYPE_UNHANDLED = 1
BREAK_TYPE_HANDLED = 2

class ExceptionBreakInfo(object):
    BUILT_IN_HANDLERS = {
        path.normcase('<frozen importlib._bootstrap>'): ((None, None, '*'),),
        path.normcase('build\\bdist.win32\\egg\\pkg_resources.py'): ((None, None, '*'),),
        path.normcase('build\\bdist.win-amd64\\egg\\pkg_resources.py'): ((None, None, '*'),),
    }

    def __init__(self):
        self.default_mode = BREAK_MODE_UNHANDLED
        self.break_on = { }
        self.handler_cache = dict(self.BUILT_IN_HANDLERS)
        self.handler_lock = thread.allocate_lock()
        self.add_exception('exceptions.IndexError', BREAK_MODE_NEVER)
        self.add_exception('builtins.IndexError', BREAK_MODE_NEVER)
        self.add_exception('exceptions.KeyError', BREAK_MODE_NEVER)
        self.add_exception('builtins.KeyError', BREAK_MODE_NEVER)
        self.add_exception('exceptions.AttributeError', BREAK_MODE_NEVER)
        self.add_exception('builtins.AttributeError', BREAK_MODE_NEVER)
        self.add_exception('exceptions.StopIteration', BREAK_MODE_NEVER)
        self.add_exception('builtins.StopIteration', BREAK_MODE_NEVER)
        self.add_exception('exceptions.GeneratorExit', BREAK_MODE_NEVER)
        self.add_exception('builtins.GeneratorExit', BREAK_MODE_NEVER)

    def clear(self):
        self.default_mode = BREAK_MODE_UNHANDLED
        self.break_on.clear()
        self.handler_cache = dict(self.BUILT_IN_HANDLERS)

    def should_break(self, thread, ex_type, ex_value, trace):
        probe_stack()
        name = get_exception_name(ex_type)
        mode = self.break_on.get(name, self.default_mode)
        break_type = BREAK_TYPE_NONE
        if mode & BREAK_MODE_ALWAYS:
            if self.is_handled(thread, ex_type, ex_value, trace):
                break_type = BREAK_TYPE_HANDLED
            else:
                break_type = BREAK_TYPE_UNHANDLED
        elif (mode & BREAK_MODE_UNHANDLED) and not self.is_handled(thread, ex_type, ex_value, trace):
            break_type = BREAK_TYPE_UNHANDLED

        if break_type:
            if issubclass(ex_type, SystemExit):
                if not BREAK_ON_SYSTEMEXIT_ZERO:
                    if not ex_value or (isinstance(ex_value, SystemExit) and not ex_value.code):
                        break_type = BREAK_TYPE_NONE

        return break_type

    def is_handled(self, thread, ex_type, ex_value, trace):
        if trace is None:
            # get out if we didn't get a traceback
            return False

        if trace.tb_next is not None:
            if should_send_frame(trace.tb_next.tb_frame) and should_debug_code(trace.tb_next.tb_frame.f_code):
                # don't break if this is not the top of the traceback,
                # unless the previous frame was not debuggable
                return True

        cur_frame = trace.tb_frame

        while should_send_frame(cur_frame) and cur_frame.f_code is not None and cur_frame.f_code.co_filename is not None:
            filename = path.normcase(cur_frame.f_code.co_filename)
            if is_file_in_zip(filename):
                # File is in a zip, so assume it handles exceptions
                return True

            if not is_same_py_file(filename, __file__):
                handlers = self.handler_cache.get(filename)

                if handlers is None:
                    # req handlers for this file from the debug engine
                    self.handler_lock.acquire()

                    with _SendLockCtx:
                        write_bytes(conn, REQH)
                        write_string(conn, filename)

                    # wait for the handler data to be received
                    self.handler_lock.acquire()
                    self.handler_lock.release()

                    handlers = self.handler_cache.get(filename)

                if handlers is None:
                    # no code available, so assume unhandled
                    return False

                line = cur_frame.f_lineno
                for line_start, line_end, expressions in handlers:
                    if line_start is None or line_start <= line < line_end:
                        if '*' in expressions:
                            return True

                        for text in expressions:
                            try:
                                res = lookup_local(cur_frame, text)
                                if res is not None and issubclass(ex_type, res):
                                    return True
                            except:
                                pass

            cur_frame = cur_frame.f_back

        return False

    def add_exception(self, name, mode=BREAK_MODE_UNHANDLED):
        if name.startswith(_EXCEPTIONS_MODULE + '.'):
            name = name[len(_EXCEPTIONS_MODULE) + 1:]
        self.break_on[name] = mode

BREAK_ON = ExceptionBreakInfo()

def probe_stack(depth = 10):
  """helper to make sure we have enough stack space to proceed w/o corrupting
     debugger state."""
  if depth == 0:
      return
  probe_stack(depth - 1)

PREFIXES = [path.normcase(sys.prefix)]
# If we're running in a virtual env, DEBUG_STDLIB should respect this too.
if hasattr(sys, 'base_prefix'):
    PREFIXES.append(path.normcase(sys.base_prefix))
if hasattr(sys, 'real_prefix'):
    PREFIXES.append(path.normcase(sys.real_prefix))

def should_debug_code(code):
    if not code or not code.co_filename:
        return False

    filename = path.normcase(code.co_filename)
    if not DEBUG_STDLIB:
        for prefix in PREFIXES:
            if prefix != '' and filename.startswith(prefix):
                return False

    for dont_debug_file in DONT_DEBUG:
        if is_same_py_file(filename, dont_debug_file):
            return False

    if is_file_in_zip(filename):
        # file in inside an egg or zip, so we can't debug it
        return False

    return True

attach_lock = thread.allocate()
attach_sent_break = False

local_path_to_vs_path = {}

def breakpoint_path_match(vs_path, local_path):
    vs_path_norm = path.normcase(vs_path)
    local_path_norm = path.normcase(local_path)
    if local_path_to_vs_path.get(local_path_norm) == vs_path_norm:
        return True

    # Walk the local filesystem from local_path up, matching agains win_path component by component,
    # and stop when we no longer see an __init__.py. This should give a reasonably close approximation
    # of matching the package name.
    while True:
        local_path, local_name = path.split(local_path)
        vs_path, vs_name = ntpath.split(vs_path)
        # Match the last component in the path. If one or both components are unavailable, then
        # we have reached the root on the corresponding path without successfully matching.
        if not local_name or not vs_name or path.normcase(local_name) != path.normcase(vs_name):
            return False
        # If we have an __init__.py, this module was inside the package, and we still need to match
        # thatpackage, so walk up one level and keep matching. Otherwise, we've walked as far as we
        # needed to, and matched all names on our way, so this is a match.
        if not path.exists(path.join(local_path, '__init__.py')):
            break

    local_path_to_vs_path[local_path_norm] = vs_path_norm
    return True

def update_all_thread_stacks(blocking_thread = None, check_is_blocked = True):
    THREADS_LOCK.acquire()
    all_threads = list(THREADS.values())
    THREADS_LOCK.release()

    for cur_thread in all_threads:
        if cur_thread is blocking_thread:
            continue

        cur_thread._block_starting_lock.acquire()
        if not check_is_blocked or not cur_thread._is_blocked:
            # release the lock, we're going to run user code to evaluate the frames
            cur_thread._block_starting_lock.release()

            frames = cur_thread.get_frame_list()

            # re-acquire the lock and make sure we're still not blocked.  If so send
            # the frame list.
            cur_thread._block_starting_lock.acquire()
            if not check_is_blocked or not cur_thread._is_blocked:
                cur_thread.send_frame_list(frames)

        cur_thread._block_starting_lock.release()

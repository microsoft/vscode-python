# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See LICENSE in the project root
# for license information.

from __future__ import print_function, absolute_import

import contextlib
import errno
import io
import os
import platform
import pydevd_file_utils
import re
import socket
import sys
import threading
import traceback
try:
    import urllib
    urllib.unquote
except Exception:
    import urllib.parse as urllib
import warnings
from xml.sax import SAXParseException

import _pydevd_bundle.pydevd_constants as pydevd_constants
# Disable this, since we aren't packaging the Cython modules at the moment.
pydevd_constants.CYTHON_SUPPORTED = False
# We limit representation size in our representation provider when needed.
pydevd_constants.MAXIMUM_VARIABLE_REPRESENTATION_SIZE = 2**32

import _pydevd_bundle.pydevd_comm as pydevd_comm  # noqa
import _pydevd_bundle.pydevd_extension_api as pydevd_extapi  # noqa
import _pydevd_bundle.pydevd_extension_utils as pydevd_extutil  # noqa
#from _pydevd_bundle.pydevd_comm import pydevd_log

import ptvsd.ipcjson as ipcjson  # noqa
import ptvsd.futures as futures  # noqa
import ptvsd.untangle as untangle  # noqa
from ptvsd.pathutils import PathUnNormcase  # noqa
from ptvsd.safe_repr import SafeRepr  # noqa


__author__ = "Microsoft Corporation <ptvshelp@microsoft.com>"
__version__ = "4.0.0a5"


#def ipcjson_trace(s):
#    print(s)
#ipcjson._TRACE = ipcjson_trace

WAIT_FOR_DISCONNECT_REQUEST_TIMEOUT = 2
WAIT_FOR_THREAD_FINISH_TIMEOUT = 1


class SafeReprPresentationProvider(pydevd_extapi.StrPresentationProvider):
    """
    Computes string representation of Python values by delegating them
    to SafeRepr.
    """

    _lock = threading.Lock()

    def __init__(self):
        self.set_format({})

    def can_provide(self, type_object, type_name):
        """Implements StrPresentationProvider."""
        return True

    def get_str(self, val):
        """Implements StrPresentationProvider."""
        return self._repr(val)

    def set_format(self, fmt):
        """
        Use fmt for all future formatting operations done by this provider.
        """
        safe_repr = SafeRepr()
        safe_repr.convert_to_hex = fmt.get('hex', False)
        safe_repr.raw_value = fmt.get('rawString', False)
        self._repr = safe_repr

    @contextlib.contextmanager
    def using_format(self, fmt):
        """
        Returns a context manager that invokes set_format(fmt) on enter,
        and restores the old format on exit.
        """
        old_repr = self._repr
        self.set_format(fmt)
        yield
        self._repr = old_repr


# Do not access directly - use safe_repr_provider() instead!
SafeReprPresentationProvider._instance = SafeReprPresentationProvider()

# Register our presentation provider as the first item on the list,
# so that we're in full control of presentation.
str_handlers = pydevd_extutil.EXTENSION_MANAGER_INSTANCE.type_to_instance.setdefault(pydevd_extapi.StrPresentationProvider, [])  # noqa
str_handlers.insert(0, SafeReprPresentationProvider._instance)


class UnsupportedPyDevdCommandError(Exception):

    def __init__(self, cmdid):
        msg = 'unsupported pydevd command ' + str(cmdid)
        super(UnsupportedPyDevdCommandError, self).__init__(msg)
        self.cmdid = cmdid


def unquote(s):
    if s is None:
        return None
    return urllib.unquote(s)


class IDMap(object):
    """Maps VSCode entities to corresponding pydevd entities by ID.

    VSCode entity IDs are generated here when necessary.

    For VSCode, entity IDs are always integers, and uniquely identify
    the entity among all other entities of the same type - e.g. all
    frames across all threads have unique IDs.

    For pydevd, IDs can be integer or strings, and are usually specific
    to some scope - for example, a frame ID is only unique within a
    given thread. To produce a truly unique ID, the IDs of all the outer
    scopes have to be combined into a tuple. Thus, for example, a pydevd
    frame ID is (thread_id, frame_id).

    Variables (evaluation results) technically don't have IDs in pydevd,
    as it doesn't have evaluation persistence. However, for a given
    frame, any child can be identified by the path one needs to walk
    from the root of the frame to get to that child - and that path,
    represented as a sequence of its constituent components, is used by
    pydevd commands to identify the variable. So we use the tuple
    representation of the same as its pydevd ID.  For example, for
    something like foo[1].bar, its ID is:
      (thread_id, frame_id, 'FRAME', 'foo', 1, 'bar')

    For pydevd breakpoints, the ID has to be specified by the caller
    when creating, so we can just reuse the ID that was generated for
    VSC. However, when referencing the pydevd breakpoint later (e.g. to
    remove it), its ID must be specified together with path to file in
    which that breakpoint is set - i.e. pydevd treats those IDs as
    scoped to a file.  So, even though breakpoint IDs are unique across
    files, use (path, bp_id) as pydevd ID.
    """

    def __init__(self):
        self._vscode_to_pydevd = {}
        self._pydevd_to_vscode = {}
        self._next_id = 1
        self._lock = threading.Lock()

    def pairs(self):
        # TODO: docstring
        with self._lock:
            return list(self._pydevd_to_vscode.items())

    def add(self, pydevd_id):
        # TODO: docstring
        with self._lock:
            vscode_id = self._next_id
            if callable(pydevd_id):
                pydevd_id = pydevd_id(vscode_id)
            self._next_id += 1
            self._vscode_to_pydevd[vscode_id] = pydevd_id
            self._pydevd_to_vscode[pydevd_id] = vscode_id
        return vscode_id

    def remove(self, pydevd_id=None, vscode_id=None):
        # TODO: docstring
        with self._lock:
            if pydevd_id is None:
                pydevd_id = self._vscode_to_pydevd[vscode_id]
            elif vscode_id is None:
                vscode_id = self._pydevd_to_vscode[pydevd_id]
            del self._vscode_to_pydevd[vscode_id]
            del self._pydevd_to_vscode[pydevd_id]

    def to_pydevd(self, vscode_id):
        # TODO: docstring
        return self._vscode_to_pydevd[vscode_id]

    def to_vscode(self, pydevd_id, autogen):
        # TODO: docstring
        try:
            return self._pydevd_to_vscode[pydevd_id]
        except KeyError:
            if autogen:
                return self.add(pydevd_id)
            else:
                raise

    def pydevd_ids(self):
        # TODO: docstring
        with self._lock:
            ids = list(self._pydevd_to_vscode.keys())
        return ids

    def vscode_ids(self):
        # TODO: docstring
        with self._lock:
            ids = list(self._vscode_to_pydevd.keys())
        return ids


class ExceptionInfo(object):
    # TODO: docstring

    def __init__(self, name, description, stack, source):
        self.name = name
        self.description = description
        self.stack = stack
        self.source = source


class PydevdSocket(object):
    """A dummy socket-like object for communicating with pydevd.

    It parses pydevd messages and redirects them to the provided handler
    callback.  It also provides an interface to send notifications and
    requests to pydevd; for requests, the reply can be asynchronously
    awaited.
    """

    def __init__(self, handle_msg, handle_close, getpeername, getsockname):
        #self.log = open('pydevd.log', 'w')
        self._handle_msg = handle_msg
        self._handle_close = handle_close
        self._getpeername = getpeername
        self._getsockname = getsockname

        self.lock = threading.Lock()
        self.seq = 1000000000
        self.pipe_r, self.pipe_w = os.pipe()
        self.requests = {}

        self._closed = False
        self._closing = False

    def close(self):
        """Mark the socket as closed and release any resources."""
        if self._closing:
            return

        with self.lock:
            if self._closed:
                return
            self._closing = True

            if self.pipe_w is not None:
                pipe_w = self.pipe_w
                self.pipe_w = None
                try:
                    os.close(pipe_w)
                except OSError as exc:
                    if exc.errno != errno.EBADF:
                        raise
            if self.pipe_r is not None:
                pipe_r = self.pipe_r
                self.pipe_r = None
                try:
                    os.close(pipe_r)
                except OSError as exc:
                    if exc.errno != errno.EBADF:
                        raise
            self._handle_close()
            self._closed = True
            self._closing = False

    def shutdown(self, mode):
        """Called when pydevd has stopped."""
        # noop

    def getpeername(self):
        """Return the remote address to which the socket is connected."""
        return self._getpeername()

    def getsockname(self):
        """Return the socket's own address."""
        return self._getsockname()

    def recv(self, count):
        """Return the requested number of bytes.

        This is where the "socket" sends requests to pydevd.  The data
        must follow the pydevd line protocol.
        """
        pipe_r = self.pipe_r
        if pipe_r is None:
            return b''
        data = os.read(pipe_r, count)
        #self.log.write('>>>[' + data.decode('utf8') + ']\n\n')
        #self.log.flush()
        return data

    def recv_into(self, buf):
        pipe_r = self.pipe_r
        if pipe_r is None:
            return 0
        return os.readv(pipe_r, [buf])

    # In Python 2, we must unquote before we decode, because UTF-8 codepoints
    # are encoded first and then quoted as individual bytes. In Python 3,
    # however, we just get a properly UTF-8-encoded string.
    if sys.version_info < (3,):
        @staticmethod
        def _decode_and_unquote(data):
            return unquote(data).decode('utf8')
    else:
        @staticmethod
        def _decode_and_unquote(data):
            return unquote(data.decode('utf8'))

    def send(self, data):
        """Handle the given bytes.

        This is where pydevd sends responses and events.  The data will
        follow the pydevd line protocol.
        """
        result = len(data)
        data = self._decode_and_unquote(data)
        #self.log.write('<<<[' + data + ']\n\n')
        #self.log.flush()
        cmd_id, seq, args = data.split('\t', 2)
        cmd_id = int(cmd_id)
        seq = int(seq)
        with self.lock:
            loop, fut = self.requests.pop(seq, (None, None))
        if fut is None:
            self._handle_msg(cmd_id, seq, args)
        else:
            loop.call_soon_threadsafe(fut.set_result, (cmd_id, seq, args))
        return result

    def makefile(self, *args, **kwargs):
        """Return a file-like wrapper around the socket."""
        return os.fdopen(self.pipe_r)

    def make_packet(self, cmd_id, args):
        # TODO: docstring
        with self.lock:
            seq = self.seq
            self.seq += 1
        s = '{}\t{}\t{}\n'.format(cmd_id, seq, args)
        return seq, s

    def pydevd_notify(self, cmd_id, args):
        # TODO: docstring
        _, s = self.make_packet(cmd_id, args)
        os.write(self.pipe_w, s.encode('utf8'))

    def pydevd_request(self, loop, cmd_id, args):
        # TODO: docstring
        seq, s = self.make_packet(cmd_id, args)
        fut = loop.create_future()
        with self.lock:
            self.requests[seq] = loop, fut
            os.write(self.pipe_w, s.encode('utf8'))
        return fut


class ExceptionsManager(object):
    def __init__(self, proc):
        self.proc = proc
        self.exceptions = {}
        self.lock = threading.Lock()

    def remove_all_exception_breaks(self):
        with self.lock:
            for exception in self.exceptions.keys():
                self.proc.pydevd_notify(pydevd_comm.CMD_REMOVE_EXCEPTION_BREAK,
                                        'python-{}'.format(exception))
            self.exceptions = {}

    def _find_exception(self, name):
        if name in self.exceptions:
            return name

        for ex_name in self.exceptions.keys():
            # ExceptionInfo.name can be in repr form
            # here we attempt to find the exception as it
            # is saved in the dictionary
            if ex_name in name:
                return ex_name

        return 'BaseException'

    def get_break_mode(self, name):
        with self.lock:
            try:
                return self.exceptions[self._find_exception(name)]
            except KeyError:
                pass
        return 'unhandled'

    def add_exception_break(self, exception, break_raised, break_uncaught):

        # notify_always options:
        #   1 is deprecated, you will see a warning message
        #   2 notify on first raise only
        #   3 or greater, notify always
        notify_always = 3 if break_raised else 0

        # notify_on_terminate options:
        #   1 notify on terminate
        #   Any other value do NOT notify on terminate
        notify_on_terminate = 1 if break_uncaught else 0

        # ignore_libraries options:
        #   Less than or equal to 0 DO NOT ignore libraries (required
        #   for notify_always)
        #   Greater than 0 ignore libraries
        ignore_libraries = 0
        cmdargs = (
            exception,
            notify_always,
            notify_on_terminate,
            ignore_libraries,
        )
        break_mode = 'never'
        if break_raised:
            break_mode = 'always'
        elif break_uncaught:
            break_mode = 'unhandled'

        msg = 'python-{}\t{}\t{}\t{}'.format(*cmdargs)
        with self.lock:
            self.proc.pydevd_notify(
                pydevd_comm.CMD_ADD_EXCEPTION_BREAK, msg)
            self.exceptions[exception] = break_mode

    def apply_exception_options(self, exception_options):
        """
        Applies exception options after removing any existing exception
        breaks.
        """
        self.remove_all_exception_breaks()
        pyex_options = (opt
                        for opt in exception_options
                        if self._is_python_exception_category(opt))
        for option in pyex_options:
            exception_paths = option['path']
            if not exception_paths:
                continue

            mode = option['breakMode']
            break_raised = (mode == 'always')
            break_uncaught = (mode in ['unhandled', 'userUnhandled'])

            # Special case for the entire python exceptions category
            is_category = False
            if len(exception_paths) == 1:
                # TODO: isn't the first one always the category?
                if exception_paths[0]['names'][0] == 'Python Exceptions':
                    is_category = True
            if is_category:
                self.add_exception_break(
                    'BaseException', break_raised, break_uncaught)
            else:
                path_iterator = iter(exception_paths)
                # Skip the first one. It will always be the category
                # "Python Exceptions"
                next(path_iterator)
                exception_names = []
                for path in path_iterator:
                    for ex_name in path['names']:
                        exception_names.append(ex_name)
                for exception_name in exception_names:
                    self.add_exception_break(
                        exception_name, break_raised, break_uncaught)

    def _is_python_exception_category(self, option):
        """
        Check if the option has entires and that the first entry
        is 'Python Exceptions'.
        """
        exception_paths = option['path']
        if not exception_paths:
            return False

        category = exception_paths[0]['names']
        if category is None or len(category) != 1:
            return False

        return category[0] == 'Python Exceptions'


class VariablesSorter(object):
    def __init__(self):
        self.variables = []  # variables that do not begin with underscores
        self.single_underscore = []  # variables beginning with underscores
        self.double_underscore = []  # variables beginning with two underscores
        self.dunder = []  # variables that begin & end with double underscores

    def append(self, var):
        var_name = var['name']
        if var_name.startswith('__'):
            if var_name.endswith('__'):
                self.dunder.append(var)
                #print('Apended dunder: %s' % var_name)
            else:
                self.double_underscore.append(var)
                #print('Apended double under: %s' % var_name)
        elif var_name.startswith('_'):
            self.single_underscore.append(var)
            #print('Apended single under: %s' % var_name)
        else:
            self.variables.append(var)
            #print('Apended variable: %s' % var_name)

    def get_sorted_variables(self):
        def get_sort_key(o):
            return o['name']
        self.variables.sort(key=get_sort_key)
        self.single_underscore.sort(key=get_sort_key)
        self.double_underscore.sort(key=get_sort_key)
        self.dunder.sort(key=get_sort_key)
        #print('sorted')
        return self.variables + self.single_underscore + self.double_underscore + self.dunder  # noqa


class ModulesManager(object):
    def __init__(self, proc):
        self.module_id_to_details = {}
        self.path_to_module_id = {}
        self._lock = threading.Lock()
        self.proc = proc
        self._next_id = 1

    def add_or_get_from_path(self, module_path):
        with self._lock:
            try:
                module_id = self.path_to_module_id[module_path]
                return self.module_id_to_details[module_id]
            except KeyError:
                pass

            search_path = self._get_platform_file_path(module_path)
            for _, value in list(sys.modules.items()):
                try:
                    path = self._get_platform_file_path(value.__file__)
                except AttributeError:
                    path = None

                if path and search_path == path:
                    module_id = self._next_id
                    self._next_id += 1

                    module = {
                        'id': module_id,
                        'package': value.__package__,
                        'path': module_path,
                    }

                    try:
                        module['name'] = value.__qualname__
                    except AttributeError:
                        module['name'] = value.__name__

                    try:
                        module['version'] = value.__version__
                    except AttributeError:
                        pass

                    self.path_to_module_id[module_path] = module_id
                    self.module_id_to_details[module_id] = module

                    self.proc.send_event('module', reason='new', module=module)
                    return module

        return None

    def _get_platform_file_path(self, path):
        if platform.system() == 'Windows':
            return path.lower()
        return path

    def get_all(self):
        with self._lock:
            return list(self.module_id_to_details.values())

    def check_unloaded_modules(self, module_event):
        pass


class VSCodeMessageProcessor(ipcjson.SocketIO, ipcjson.IpcChannel):
    """IPC JSON message processor for VSC debugger protocol.

    This translates between the VSC debugger protocol and the pydevd
    protocol.
    """

    def __init__(self, socket, pydevd_notify, pydevd_request,
                 notify_disconnecting, notify_closing,
                 logfile=None,
                 ):
        super(VSCodeMessageProcessor, self).__init__(socket=socket,
                                                     own_socket=False,
                                                     logfile=logfile)
        self.socket = socket
        self._pydevd_notify = pydevd_notify
        self._pydevd_request = pydevd_request
        self._notify_disconnecting = notify_disconnecting
        self._notify_closing = notify_closing

        self.loop = None
        self.event_loop_thread = None
        self.server_thread = None
        self._closed = False

        # debugger state
        self.is_process_created = False
        self.is_process_created_lock = threading.Lock()
        self.stack_traces = {}
        self.stack_traces_lock = threading.Lock()
        self.active_exceptions = {}
        self.active_exceptions_lock = threading.Lock()
        self.thread_map = IDMap()
        self.frame_map = IDMap()
        self.var_map = IDMap()
        self.bp_map = IDMap()
        self.next_var_ref = 0
        self.exceptions_mgr = ExceptionsManager(self)
        self.modules_mgr = ModulesManager(self)

        # adapter state
        self.disconnect_request = None
        self.debug_options = {}
        self.disconnect_request_event = threading.Event()
        self._exited = False
        self.path_casing = PathUnNormcase()

    def start(self, threadname):
        # event loop
        self.loop = futures.EventLoop()
        self.event_loop_thread = threading.Thread(
            target=self.loop.run_forever,
            name='ptvsd.EventLoop',
        )
        self.event_loop_thread.daemon = True
        self.event_loop_thread.start()

        # VSC msg processing loop
        self.server_thread = threading.Thread(
            target=self.process_messages,
            name=threadname,
        )
        self.server_thread.daemon = True
        self.server_thread.start()

        # special initialization
        self.send_event(
            'output',
            category='telemetry',
            output='ptvsd',
            data={'version': __version__},
        )

    # closing the adapter

    def close(self):
        """Stop the message processor and release its resources."""
        if self._closed:
            return
        self._closed = True

        self._notify_closing()
        # Close the editor-side socket.
        self._stop_vsc_message_loop()

    def _stop_vsc_message_loop(self):
        self.set_exit()
        self.loop.stop()
        self.event_loop_thread.join(WAIT_FOR_THREAD_FINISH_TIMEOUT)
        if self.socket:
            try:
                self.socket.shutdown(socket.SHUT_RDWR)
                self.socket.close()
            except Exception:
                # TODO: log the error
                pass

    def _wait_options(self):
        normal = self.debug_options.get('WAIT_ON_NORMAL_EXIT', False)
        abnormal = self.debug_options.get('WAIT_ON_ABNORMAL_EXIT', False)
        return normal, abnormal

    def handle_pydevd_stopped(self, exitcode):
        """Finalize the protocol connection."""
        if self._exited:
            return
        self._exited = True

        # Notify the editor that the "debuggee" (e.g. script, app) exited.
        self.send_event('exited', exitCode=exitcode)
        # Notify the editor that the debugger has stopped.
        self.send_event('terminated')

        # The editor will send a "disconnect" request at this point.
        self._wait_for_disconnect()

    def _wait_for_disconnect(self, timeout=None):
        if timeout is None:
            timeout = WAIT_FOR_DISCONNECT_REQUEST_TIMEOUT

        if not self.disconnect_request_event.wait(timeout):
            warnings.warn('timed out waiting for disconnect request')
        if self.disconnect_request is not None:
            self.send_response(self.disconnect_request)
            self.disconnect_request = None

    def _handle_disconnect(self, request):
        self.disconnect_request = request
        self.disconnect_request_event.set()
        self._notify_disconnecting(not self._closed)
        if not self._closed:
            self.close()

    def _wait_for_server_thread(self):
        if self.server_thread is None:
            return
        if not self.server_thread.is_alive():
            return
        self.server_thread.join(WAIT_FOR_THREAD_FINISH_TIMEOUT)

    # async helpers

    def async_method(m):
        """Converts a generator method into an async one."""
        m = futures.wrap_async(m)

        def f(self, *args, **kwargs):
            return m(self, self.loop, *args, **kwargs)

        return f

    def async_handler(m):
        """Converts a generator method into a fire-and-forget async one."""
        m = futures.wrap_async(m)

        def f(self, *args, **kwargs):
            fut = m(self, self.loop, *args, **kwargs)

            def done(fut):
                try:
                    fut.result()
                except BaseException:
                    traceback.print_exc(file=sys.__stderr__)

            fut.add_done_callback(done)

        return f

    def sleep(self):
        fut = futures.Future(self.loop)
        self.loop.call_soon(lambda: fut.set_result(None))
        return fut

    # PyDevd "socket" entry points (and related helpers)

    def pydevd_notify(self, cmd_id, args):
        # TODO: docstring
        try:
            return self._pydevd_notify(cmd_id, args)
        except BaseException:
            traceback.print_exc(file=sys.__stderr__)
            raise

    def pydevd_request(self, cmd_id, args):
        # TODO: docstring
        return self._pydevd_request(self.loop, cmd_id, args)

    # Instances of this class provide decorators to mark methods as
    # handlers for various # pydevd messages - a decorated method is
    # added to the map with the corresponding message ID, and is
    # looked up there by pydevd event handler below.
    class EventHandlers(dict):
        def handler(self, cmd_id):
            def decorate(f):
                self[cmd_id] = f
                return f
            return decorate

    pydevd_events = EventHandlers()

    def on_pydevd_event(self, cmd_id, seq, args):
        # TODO: docstring
        try:
            f = self.pydevd_events[cmd_id]
        except KeyError:
            raise UnsupportedPyDevdCommandError(cmd_id)
        return f(self, seq, args)

    @staticmethod
    def parse_xml_response(args):
        return untangle.parse(io.BytesIO(args.encode('utf8'))).xml

    @async_method
    def using_format(self, fmt):
        while not SafeReprPresentationProvider._lock.acquire(False):
            yield self.sleep()
        provider = SafeReprPresentationProvider._instance

        @contextlib.contextmanager
        def context():
            with provider.using_format(fmt):
                yield
            provider._lock.release()
        yield futures.Result(context())

    # VSC protocol handlers

    @async_handler
    def on_initialize(self, request, args):
        # TODO: docstring
        cmd = pydevd_comm.CMD_VERSION
        os_id = 'WINDOWS' if platform.system() == 'Windows' else 'UNIX'
        msg = '1.1\t{}\tID'.format(os_id)
        yield self.pydevd_request(cmd, msg)
        self.send_response(
            request,
            supportsExceptionInfoRequest=True,
            supportsConfigurationDoneRequest=True,
            supportsConditionalBreakpoints=True,
            supportsSetVariable=True,
            supportsExceptionOptions=True,
            supportsEvaluateForHovers=True,
            supportsValueFormattingOptions=True,
            supportsSetExpression=True,
            supportsModulesRequest=True,
            exceptionBreakpointFilters=[
                {
                    'filter': 'raised',
                    'label': 'Raised Exceptions',
                    'default': False
                },
                {
                    'filter': 'uncaught',
                    'label': 'Uncaught Exceptions',
                    'default': True
                },
            ],
        )
        self.send_event('initialized')

    @async_handler
    def on_configurationDone(self, request, args):
        # TODO: docstring
        self.send_response(request)
        self.process_debug_options()
        self.pydevd_request(pydevd_comm.CMD_RUN, '')

    def process_debug_options(self):
        """
        Process the launch arguments to configure the debugger.
        """  # noqa
        if self.debug_options.get('FIX_FILE_PATH_CASE', False):
            self.path_casing.enable()

        if self.debug_options.get('REDIRECT_OUTPUT', False):
            redirect_output = 'STDOUT\tSTDERR'
        else:
            redirect_output = ''
        self.pydevd_request(pydevd_comm.CMD_REDIRECT_OUTPUT, redirect_output)

    def build_debug_options(self, debug_options):
        """
        Build string representation of debug options from launch config (as provided by VSC)
        Further information can be found here https://code.visualstudio.com/docs/editor/debugging#_launchjson-attributes
        {
            type:'python',
            request:'launch'|'attach',
            name:'friendly name for debug config',
            debugOptions:[
                'RedirectOutput', 'Django'
            ]
        }
        """  # noqa
        debug_option_mapping = {
            'RedirectOutput': 'REDIRECT_OUTPUT=True',
            'WaitOnNormalExit': 'WAIT_ON_NORMAL_EXIT=True',
            'WaitOnAbnormalExit': 'WAIT_ON_ABNORMAL_EXIT=True',
            'Django': 'DJANGO_DEBUG=True',
            'Flask': 'FLASK_DEBUG=True',
            'Jinja': 'FLASK_DEBUG=True',
            'FixFilePathCase': 'FIX_FILE_PATH_CASE=True',
            'DebugStdLib': 'DEBUG_STD_LIB=True'
        }
        return ';'.join(debug_option_mapping[option]
                        for option in debug_options
                        if option in debug_option_mapping)

    def _parse_debug_options(self, debug_options):
        """Debug options are semicolon separated key=value pairs
            WAIT_ON_ABNORMAL_EXIT=True|False
            WAIT_ON_NORMAL_EXIT=True|False
            REDIRECT_OUTPUT=True|False
            VERSION=string
            INTERPRETER_OPTIONS=string
            WEB_BROWSER_URL=string url
            DJANGO_DEBUG=True|False
        """
        DEBUG_OPTIONS_PARSER = {
            'WAIT_ON_ABNORMAL_EXIT': bool,
            'WAIT_ON_NORMAL_EXIT': bool,
            'REDIRECT_OUTPUT': bool,
            'VERSION': unquote,
            'INTERPRETER_OPTIONS': unquote,
            'WEB_BROWSER_URL': unquote,
            'DJANGO_DEBUG': bool,
            'FLASK_DEBUG': bool,
            'FIX_FILE_PATH_CASE': bool
        }

        options = {}
        for opt in debug_options.split(';'):
            try:
                key, value = opt.split('=')
            except ValueError:
                continue
            options[key] = DEBUG_OPTIONS_PARSER[key](value)
        return options

    def _initialize_path_maps(self, args):
        pathMaps = []
        for pathMapping in args.get('pathMappings', []):
            localRoot = pathMapping.get('localRoot', '')
            remoteRoot = pathMapping.get('remoteRoot', '')
            if (len(localRoot) > 0 and len(remoteRoot) > 0):
                pathMaps.append((localRoot, remoteRoot))

        if len(pathMaps) > 0:
            pydevd_file_utils.setup_client_server_paths(pathMaps)

    @async_handler
    def on_attach(self, request, args):
        # TODO: docstring
        self.start_reason = 'attach'
        self._initialize_path_maps(args)
        options = self.build_debug_options(args.get('debugOptions', []))
        self.debug_options = self._parse_debug_options(
            args.get('options', options))
        self.send_response(request)

    @async_handler
    def on_launch(self, request, args):
        # TODO: docstring
        self.start_reason = 'launch'
        options = self.build_debug_options(args.get('debugOptions', []))
        self.debug_options = self._parse_debug_options(
            args.get('options', options))
        self.send_response(request)

    def on_disconnect(self, request, args):
        # TODO: docstring
        if self.start_reason == 'launch':
            self._handle_disconnect(request)
        else:
            self.send_response(request)

    def send_process_event(self, start_method):
        # TODO: docstring
        evt = {
            'name': sys.argv[0],
            'systemProcessId': os.getpid(),
            'isLocalProcess': True,
            'startMethod': start_method,
        }
        self.send_event('process', **evt)

    def send_error_response(self, request, message=None):
        self.send_response(
            request,
            success=False,
            message=message
        )

    def is_debugger_internal_thread(self, thread_name):
        if thread_name:
            if thread_name.startswith('pydevd.'):
                return True
            elif thread_name.startswith('ptvsd.'):
                return True
        return False

    @async_handler
    def on_threads(self, request, args):
        # TODO: docstring
        cmd = pydevd_comm.CMD_LIST_THREADS
        _, _, resp_args = yield self.pydevd_request(cmd, '')

        try:
            xml = self.parse_xml_response(resp_args)
        except SAXParseException as ex:
            self.send_error_response(request)
            return

        try:
            xthreads = xml.thread
        except AttributeError:
            xthreads = []

        threads = []
        for xthread in xthreads:
            try:
                name = unquote(xthread['name'])
            except KeyError:
                name = None

            if not self.is_debugger_internal_thread(name):
                pyd_tid = xthread['id']
                try:
                    vsc_tid = self.thread_map.to_vscode(pyd_tid, autogen=False)
                except KeyError:
                    # This is a previously unseen thread
                    vsc_tid = self.thread_map.to_vscode(pyd_tid, autogen=True)
                    self.send_event('thread', reason='started',
                                    threadId=vsc_tid)

                threads.append({'id': vsc_tid, 'name': name})

        self.send_response(request, threads=threads)

    @async_handler
    def on_stackTrace(self, request, args):
        # TODO: docstring
        vsc_tid = int(args['threadId'])
        startFrame = int(args.get('startFrame', 0))
        levels = int(args.get('levels', 0))
        fmt = args.get('format', {})

        pyd_tid = self.thread_map.to_pydevd(vsc_tid)
        with self.stack_traces_lock:
            try:
                xframes = self.stack_traces[pyd_tid]
            except KeyError:
                # This means the stack was requested before the
                # thread was suspended
                xframes = []
        totalFrames = len(xframes)

        if levels == 0:
            levels = totalFrames

        stackFrames = []
        for xframe in xframes:
            if startFrame > 0:
                startFrame -= 1
                continue

            if levels <= 0:
                break
            levels -= 1

            key = (pyd_tid, int(xframe['id']))
            fid = self.frame_map.to_vscode(key, autogen=True)
            name = unquote(xframe['name'])
            norm_path = self.path_casing.un_normcase(unquote(xframe['file']))
            module = self.modules_mgr.add_or_get_from_path(norm_path)
            line = int(xframe['line'])
            frame_name = self._format_frame_name(
                fmt,
                name,
                module,
                line,
                norm_path)

            stackFrames.append({
                'id': fid,
                'name': frame_name,
                'source': {'path': norm_path},
                'line': line, 'column': 1,
            })

        self.send_response(request,
                           stackFrames=stackFrames,
                           totalFrames=totalFrames)

    def _format_frame_name(self, fmt, name, module, line, path):
        frame_name = name
        if fmt.get('module', False):
            if module:
                if name == '<module>':
                    frame_name = module['name']
                else:
                    frame_name = '%s.%s' % (module['name'], name)
            else:
                _, tail = os.path.split(path)
                tail = tail[0:-3] if tail.lower().endswith('.py') else tail
                if name == '<module>':
                    frame_name = '%s in %s' % (name, tail)
                else:
                    frame_name = '%s.%s' % (tail, name)

        if fmt.get('line', False):
            frame_name = '%s : %d' % (frame_name, line)

        return frame_name

    @async_handler
    def on_scopes(self, request, args):
        # TODO: docstring
        vsc_fid = int(args['frameId'])
        pyd_tid, pyd_fid = self.frame_map.to_pydevd(vsc_fid)
        pyd_var = (pyd_tid, pyd_fid, 'FRAME')
        vsc_var = self.var_map.to_vscode(pyd_var, autogen=True)
        scope = {
            'name': 'Locals',
            'expensive': False,
            'variablesReference': vsc_var,
        }
        self.send_response(request, scopes=[scope])

    @async_handler
    def on_variables(self, request, args):
        """Handles DAP VariablesRequest."""

        vsc_var = int(args['variablesReference'])
        fmt = args.get('format', {})

        pyd_var = self.var_map.to_pydevd(vsc_var)

        if len(pyd_var) == 3:
            cmd = pydevd_comm.CMD_GET_FRAME
        else:
            cmd = pydevd_comm.CMD_GET_VARIABLE
        cmdargs = (str(s) for s in pyd_var)
        msg = '\t'.join(cmdargs)
        with (yield self.using_format(fmt)):
            _, _, resp_args = yield self.pydevd_request(cmd, msg)

        try:
            xml = self.parse_xml_response(resp_args)
        except SAXParseException as ex:
            self.send_error_response(request)
            return

        try:
            xvars = xml.var
        except AttributeError:
            xvars = []

        variables = VariablesSorter()
        for xvar in xvars:
            var_name = unquote(xvar['name'])
            var_type = unquote(xvar['type'])
            var_value = unquote(xvar['value'])
            var = {
                'name': var_name,
                'type': var_type,
                'value': var_value,
            }

            if var_type in ('str', 'unicode', 'bytes', 'bytearray'):
                var['presentationHint'] = {'attributes': ['rawString']}

            if bool(xvar['isContainer']):
                pyd_child = pyd_var + (var_name,)
                var['variablesReference'] = self.var_map.to_vscode(
                    pyd_child, autogen=True)

            eval_name = self._get_variable_evaluate_name(pyd_var, var_name)
            if eval_name:
                var['evaluateName'] = eval_name

            variables.append(var)

        self.send_response(request, variables=variables.get_sorted_variables())

    def _get_variable_evaluate_name(self, pyd_var_parent, var_name):
        # TODO: docstring
        eval_name = None
        if len(pyd_var_parent) > 3:
            # This means the current variable has a parent i.e, it is not a
            # FRAME variable. These require evaluateName to work in VS
            # watch window
            var = pyd_var_parent + (var_name,)
            eval_name = var[3]
            for s in var[4:]:
                try:
                    # Check and get the dictionary key or list index.
                    # Note: this is best effort, keys that are object
                    # references will not work
                    i = self._get_index_or_key(s)
                    eval_name += '[{}]'.format(i)
                except Exception:
                    eval_name += '.' + s

        return eval_name

    def _get_index_or_key(self, text):
        # Dictionary resolver in pydevd provides key
        # in '<repr> (<hash>)' format
        result = re.match(r"(.*)\ \(([0-9]*)\)", text,
                          re.IGNORECASE | re.UNICODE)
        if result and len(result.groups()) == 2:
            try:
                # check if group 2 is a hash
                int(result.group(2))
                return result.group(1)
            except Exception:
                pass
        # In the result XML from pydevd list indexes appear
        # as names. If the name is a number then it is a index.
        return int(text)

    @async_handler
    def on_setVariable(self, request, args):
        """Handles DAP SetVariableRequest."""

        vsc_var = int(args['variablesReference'])
        pyd_var = self.var_map.to_pydevd(vsc_var)

        var_name = args['name']
        var_value = args['value']
        fmt = args.get('format', {})

        lhs_expr = self._get_variable_evaluate_name(pyd_var, var_name)
        if not lhs_expr:
            lhs_expr = var_name
        expr = '%s = %s' % (lhs_expr, var_value)
        # pydevd message format doesn't permit tabs in expressions
        expr = expr.replace('\t', ' ')

        pyd_tid = str(pyd_var[0])
        pyd_fid = str(pyd_var[1])

        # VSC gives us variablesReference to the parent of the variable
        # being set, and variable name; but pydevd wants the ID
        # (or rather path) of the variable itself.
        pyd_var += (var_name,)
        vsc_var = self.var_map.to_vscode(pyd_var, autogen=True)

        cmd_args = [pyd_tid, pyd_fid, 'LOCAL', expr, '1']
        with (yield self.using_format(fmt)):
            yield self.pydevd_request(
                pydevd_comm.CMD_EXEC_EXPRESSION,
                '\t'.join(cmd_args),
            )

        cmd_args = [pyd_tid, pyd_fid, 'LOCAL', lhs_expr, '1']
        with (yield self.using_format(fmt)):
            _, _, resp_args = yield self.pydevd_request(
                pydevd_comm.CMD_EVALUATE_EXPRESSION,
                '\t'.join(cmd_args),
            )

        try:
            xml = self.parse_xml_response(resp_args)
        except SAXParseException as ex:
            self.send_error_response(request)
            return

        try:
            xvar = xml.var
        except AttributeError:
            self.send_response(request, success=False)
            return

        response = {
            'type': unquote(xvar['type']),
            'value': unquote(xvar['value']),
        }
        if bool(xvar['isContainer']):
            response['variablesReference'] = vsc_var

        self.send_response(request, **response)

    @async_handler
    def on_evaluate(self, request, args):
        """Handles DAP EvaluateRequest."""

        # pydevd message format doesn't permit tabs in expressions
        expr = args['expression'].replace('\t', ' ')
        fmt = args.get('format', {})

        vsc_fid = int(args['frameId'])
        pyd_tid, pyd_fid = self.frame_map.to_pydevd(vsc_fid)

        cmd_args = (pyd_tid, pyd_fid, 'LOCAL', expr, '1')
        msg = '\t'.join(str(s) for s in cmd_args)
        with (yield self.using_format(fmt)):
            _, _, resp_args = yield self.pydevd_request(
                pydevd_comm.CMD_EVALUATE_EXPRESSION,
                msg)

        try:
            xml = self.parse_xml_response(resp_args)
        except SAXParseException as ex:
            self.send_error_response(request)
            return

        try:
            xvar = xml.var
        except AttributeError:
            self.send_response(request, success=False)
            return

        context = args.get('context', '')
        is_eval_error = xvar['isErrorOnEval']
        if context == 'hover' and is_eval_error == 'True':
            self.send_response(
                request,
                result=None,
                variablesReference=0)
            return

        if context == 'repl' and is_eval_error == 'True':
            # try exec for repl requests
            with (yield self.using_format(fmt)):
                _, _, resp_args = yield self.pydevd_request(
                    pydevd_comm.CMD_EXEC_EXPRESSION,
                    msg)
            try:
                xml2 = self.parse_xml_response(resp_args)
                xvar2 = xml2.var
                result_type = unquote(xvar2['type'])
                result = unquote(xvar2['value'])
            except Exception:
                # if resp_args is not xml then it contains the error traceback
                result_type = unquote(xvar['type'])
                result = unquote(xvar['value'])
            self.send_response(
                request,
                result=(None
                        if result == 'None' and result_type == 'NoneType'
                        else result),
                type=result_type,
                variablesReference=0,
            )
            return

        pyd_var = (pyd_tid, pyd_fid, 'EXPRESSION', expr)
        vsc_var = self.var_map.to_vscode(pyd_var, autogen=True)
        response = {
            'type': unquote(xvar['type']),
            'result': unquote(xvar['value']),
        }
        if bool(xvar['isContainer']):
            response['variablesReference'] = vsc_var

        self.send_response(request, **response)

    @async_handler
    def on_setExpression(self, request, args):
        # TODO: docstring

        vsc_fid = int(args['frameId'])
        pyd_tid, pyd_fid = self.frame_map.to_pydevd(vsc_fid)
        fmt = args.get('format', {})

        lhs_expr = args.get('expression')
        rhs_expr = args.get('value')
        expr = '%s = (%s)' % (lhs_expr, rhs_expr)

        # pydevd message format doesn't permit tabs in expressions
        expr = expr.replace('\t', ' ')

        cmd_args = (pyd_tid, pyd_fid, 'LOCAL', expr, '1')
        msg = '\t'.join(str(s) for s in cmd_args)
        with (yield self.using_format(fmt)):
            yield self.pydevd_request(
                pydevd_comm.CMD_EXEC_EXPRESSION,
                msg)

        # Return 'None' here, VS will call getVariables to retrieve
        # updated values anyway. Doing eval on the left-hand-side
        # expression may have side-effects
        self.send_response(request, value=None)

    @async_handler
    def on_modules(self, request, args):
        modules = list(self.modules_mgr.get_all())
        self.send_response(request, modules=modules, totalModules=len(modules))

    @async_handler
    def on_pause(self, request, args):
        # TODO: docstring

        # Pause requests cannot be serviced until pydevd is fully initialized.
        with self.is_process_created_lock:
            if not self.is_process_created:
                self.send_response(
                    request,
                    success=False,
                    message='Cannot pause while debugger is initializing',
                )
                return

        vsc_tid = int(args['threadId'])
        if vsc_tid == 0:  # VS does this to mean "stop all threads":
            for pyd_tid in self.thread_map.pydevd_ids():
                self.pydevd_notify(pydevd_comm.CMD_THREAD_SUSPEND, pyd_tid)
        else:
            pyd_tid = self.thread_map.to_pydevd(vsc_tid)
            self.pydevd_notify(pydevd_comm.CMD_THREAD_SUSPEND, pyd_tid)
        self.send_response(request)

    @async_handler
    def on_continue(self, request, args):
        # TODO: docstring
        tid = self.thread_map.to_pydevd(int(args['threadId']))
        self.pydevd_notify(pydevd_comm.CMD_THREAD_RUN, tid)
        self.send_response(request)

    @async_handler
    def on_next(self, request, args):
        # TODO: docstring
        tid = self.thread_map.to_pydevd(int(args['threadId']))
        self.pydevd_notify(pydevd_comm.CMD_STEP_OVER, tid)
        self.send_response(request)

    @async_handler
    def on_stepIn(self, request, args):
        # TODO: docstring
        tid = self.thread_map.to_pydevd(int(args['threadId']))
        self.pydevd_notify(pydevd_comm.CMD_STEP_INTO, tid)
        self.send_response(request)

    @async_handler
    def on_stepOut(self, request, args):
        # TODO: docstring
        tid = self.thread_map.to_pydevd(int(args['threadId']))
        self.pydevd_notify(pydevd_comm.CMD_STEP_RETURN, tid)
        self.send_response(request)

    @async_handler
    def on_setBreakpoints(self, request, args):
        # TODO: docstring
        bps = []
        path = args['source']['path']
        self.path_casing.track_file_path_case(path)
        src_bps = args.get('breakpoints', [])

        bp_type = 'python-line'
        if not path.lower().endswith('.py'):
            if self.debug_options.get('DJANGO_DEBUG', False):
                bp_type = 'django-line'
            elif self.debug_options.get('FLASK_DEBUG', False):
                bp_type = 'jinja2-line'

        # First, we must delete all existing breakpoints in that source.
        cmd = pydevd_comm.CMD_REMOVE_BREAK
        for pyd_bpid, vsc_bpid in self.bp_map.pairs():
            if pyd_bpid[0] == path:
                msg = '{}\t{}\t{}'.format(bp_type, path, vsc_bpid)
                self.pydevd_notify(cmd, msg)
                self.bp_map.remove(pyd_bpid, vsc_bpid)

        cmd = pydevd_comm.CMD_SET_BREAK
        msgfmt = '{}\t{}\t{}\t{}\tNone\t{}\tNone'
        for src_bp in src_bps:
            line = src_bp['line']
            vsc_bpid = self.bp_map.add(
                    lambda vsc_bpid: (path, vsc_bpid))
            self.path_casing.track_file_path_case(path)
            msg = msgfmt.format(vsc_bpid, bp_type, path, line,
                                src_bp.get('condition', None))
            self.pydevd_notify(cmd, msg)
            bps.append({
                'id': vsc_bpid,
                'verified': True,
                'line': line,
            })
        self.send_response(request, breakpoints=bps)

    @async_handler
    def on_setExceptionBreakpoints(self, request, args):
        # TODO: docstring
        filters = args['filters']
        exception_options = args.get('exceptionOptions', [])

        if exception_options:
            self.exceptions_mgr.apply_exception_options(exception_options)
        else:
            self.exceptions_mgr.remove_all_exception_breaks()
            break_raised = 'raised' in filters
            break_uncaught = 'uncaught' in filters
            if break_raised or break_uncaught:
                self.exceptions_mgr.add_exception_break(
                    'BaseException', break_raised, break_uncaught)
        self.send_response(request)

    @async_handler
    def on_exceptionInfo(self, request, args):
        # TODO: docstring
        pyd_tid = self.thread_map.to_pydevd(args['threadId'])
        with self.active_exceptions_lock:
            try:
                exc = self.active_exceptions[pyd_tid]
            except KeyError:
                exc = ExceptionInfo('BaseException',
                                    'exception: no description',
                                    None, None)
        self.send_response(
            request,
            exceptionId=exc.name,
            description=exc.description,
            breakMode=self.exceptions_mgr.get_break_mode(exc.name),
            details={'typeName': exc.name,
                     'message': exc.description,
                     'stackTrace': exc.stack,
                     'source': exc.source},
        )

    # Custom ptvsd message
    def on_ptvsd_systemInfo(self, request, args):
        try:
            pid = os.getpid()
        except AttributeError:
            pid = None

        try:
            impl_desc = platform.python_implementation()
        except AttributeError:
            try:
                impl_desc = sys.implementation.name
            except AttributeError:
                impl_desc = None

        def version_str(v):
            return '{}.{}.{}{}{}'.format(
                v.major,
                v.minor,
                v.micro,
                v.releaselevel,
                v.serial)

        try:
            impl_name = sys.implementation.name
        except AttributeError:
            impl_name = None

        try:
            impl_version = version_str(sys.implementation.version)
        except AttributeError:
            impl_version = None

        sys_info = {
            'ptvsd': {
                'version': __version__,
            },
            'python': {
                'version': version_str(sys.version_info),
                'implementation': {
                    'name': impl_name,
                    'version': impl_version,
                    'description': impl_desc,
                },
            },
            'platform': {
                'name': sys.platform,
            },
            'process': {
                'pid': pid,
                'executable': sys.executable,
                'bitness': 64 if sys.maxsize > 2**32 else 32,
            },
        }
        self.send_response(request, **sys_info)

    # PyDevd protocol event handlers

    @pydevd_events.handler(pydevd_comm.CMD_THREAD_CREATE)
    def on_pydevd_thread_create(self, seq, args):
        # If this is the first thread reported, report process creation
        # as well.
        with self.is_process_created_lock:
            if not self.is_process_created:
                self.is_process_created = True
                self.send_process_event(self.start_reason)

        xml = self.parse_xml_response(args)
        try:
            name = unquote(xml.thread['name'])
        except KeyError:
            name = None
        if not self.is_debugger_internal_thread(name):
            # Any internal pydevd or ptvsd threads will be ignored everywhere
            tid = self.thread_map.to_vscode(xml.thread['id'], autogen=True)
            self.send_event('thread', reason='started', threadId=tid)

    @pydevd_events.handler(pydevd_comm.CMD_THREAD_KILL)
    def on_pydevd_thread_kill(self, seq, args):
        # TODO: docstring
        pyd_tid = args.strip()
        try:
            vsc_tid = self.thread_map.to_vscode(pyd_tid, autogen=False)
        except KeyError:
            pass
        else:
            self.thread_map.remove(pyd_tid, vsc_tid)
            self.send_event('thread', reason='exited', threadId=vsc_tid)

    @pydevd_events.handler(pydevd_comm.CMD_THREAD_SUSPEND)
    @async_handler
    def on_pydevd_thread_suspend(self, seq, args):
        # TODO: docstring
        xml = self.parse_xml_response(args)
        pyd_tid = xml.thread['id']
        reason = int(xml.thread['stop_reason'])
        STEP_REASONS = {
                pydevd_comm.CMD_STEP_INTO,
                pydevd_comm.CMD_STEP_OVER,
                pydevd_comm.CMD_STEP_RETURN,
        }
        EXCEPTION_REASONS = {
            pydevd_comm.CMD_STEP_CAUGHT_EXCEPTION,
            pydevd_comm.CMD_ADD_EXCEPTION_BREAK
        }

        try:
            vsc_tid = self.thread_map.to_vscode(pyd_tid, autogen=False)
        except KeyError:
            return

        with self.stack_traces_lock:
            self.stack_traces[pyd_tid] = xml.thread.frame

        description = None
        text = None
        if reason in STEP_REASONS:
            reason = 'step'
        elif reason in EXCEPTION_REASONS:
            reason = 'exception'
        elif reason == pydevd_comm.CMD_SET_BREAK:
            reason = 'breakpoint'
        else:
            reason = 'pause'

        # For exception cases both raise and uncaught, pydevd adds a
        # __exception__ object to the top most frame. Extracting the
        # exception name and description from that frame gives accurate
        # exception information.
        if reason == 'exception':
            # Get exception info from frame
            try:
                xframes = list(xml.thread.frame)
                xframe = xframes[0]
                pyd_fid = xframe['id']
                cmdargs = '{}\t{}\tFRAME\t__exception__'.format(pyd_tid,
                                                                pyd_fid)
                cmdid = pydevd_comm.CMD_GET_VARIABLE
                _, _, resp_args = yield self.pydevd_request(cmdid, cmdargs)
                xml = self.parse_xml_response(resp_args)
                text = unquote(xml.var[1]['type'])
                description = unquote(xml.var[1]['value'])
                frame_data = ((
                               unquote(f['file']),
                               int(f['line']),
                               unquote(f['name']),
                               None
                               ) for f in xframes)
                stack = ''.join(traceback.format_list(frame_data))
                source = unquote(xframe['file'])
            except Exception:
                text = 'BaseException'
                description = 'exception: no description'
                stack = None
                source = None

            with self.active_exceptions_lock:
                self.active_exceptions[pyd_tid] = ExceptionInfo(text,
                                                                description,
                                                                stack,
                                                                source)

        self.send_event(
            'stopped',
            reason=reason,
            threadId=vsc_tid,
            text=text,
            description=description)

    @pydevd_events.handler(pydevd_comm.CMD_THREAD_RUN)
    def on_pydevd_thread_run(self, seq, args):
        # TODO: docstring
        pyd_tid, _ = args.split('\t')
        pyd_tid = pyd_tid.strip()

        # Stack trace, active exception, all frames, and variables for
        # this thread are now invalid; clear their IDs.
        with self.stack_traces_lock:
            try:
                del self.stack_traces[pyd_tid]
            except KeyError:
                pass

        with self.active_exceptions_lock:
            try:
                del self.active_exceptions[pyd_tid]
            except KeyError:
                pass

        for pyd_fid, vsc_fid in self.frame_map.pairs():
            if pyd_fid[0] == pyd_tid:
                self.frame_map.remove(pyd_fid, vsc_fid)

        for pyd_var, vsc_var in self.var_map.pairs():
            if pyd_var[0] == pyd_tid:
                self.var_map.remove(pyd_var, vsc_var)

        try:
            vsc_tid = self.thread_map.to_vscode(pyd_tid, autogen=False)
        except KeyError:
            pass
        else:
            self.send_event('continued', threadId=vsc_tid)

    @pydevd_events.handler(pydevd_comm.CMD_SEND_CURR_EXCEPTION_TRACE)
    def on_pydevd_send_curr_exception_trace(self, seq, args):
        # TODO: docstring
        pass

    @pydevd_events.handler(pydevd_comm.CMD_SEND_CURR_EXCEPTION_TRACE_PROCEEDED)
    def on_pydevd_send_curr_exception_trace_proceeded(self, seq, args):
        # TODO: docstring
        pyd_tid = args.strip()
        with self.active_exceptions_lock:
            try:
                del self.active_exceptions[pyd_tid]
            except KeyError:
                pass

    @pydevd_events.handler(pydevd_comm.CMD_WRITE_TO_CONSOLE)
    def on_pydevd_cmd_write_to_console2(self, seq, args):
        """Handle console output"""
        xml = self.parse_xml_response(args)
        ctx = xml.io['ctx']
        category = 'stdout' if ctx == '1' else 'stderr'
        content = unquote(xml.io['s'])
        self.send_event('output', category=category, output=content)

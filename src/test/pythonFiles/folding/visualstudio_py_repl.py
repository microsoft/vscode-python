# Python Tools for Visual Studio

# Copyright(c) Microsoft Corporation

# All rights reserved.

from __future__ import with_statement

__author__ = "Microsoft Corporation <ptvshelp@microsoft.com>"
__version__ = "3.0.0.0"

# This module MUST NOT import threading in global scope. This is because in a direct (non-ptvsd)

# attach scenario, it is loaded on the injected debugger attach thread, and if threading module

# hasn't been loaded already, it will assume that the thread on which it is being loaded is the

# main thread. This will cause issues when the thread goes away after attach completes.

try:
    import thread
except ImportError:
    # Renamed in Python3k
    import _thread as thread
try:
    from ssl import SSLError
except:
    SSLError = None

import sys
import socket
import select
import time
import struct
import imp
import traceback
import random
import os
import inspect
import types
from collections import deque

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
read_bytes = _vspu.read_bytes
read_int = _vspu.read_int
read_string = _vspu.read_string
write_bytes = _vspu.write_bytes
write_int = _vspu.write_int
write_string = _vspu.write_string

try:
    unicode
except NameError:
    unicode = str

try:
    BaseException
except NameError:
    # BaseException not defined until Python 2.5
    BaseException = Exception

DEBUG = os.environ.get('DEBUG_REPL') is not None

PY_ROOT = os.path.normcase(__file__)
while os.path.basename(PY_ROOT) != 'pythonFiles':
    PY_ROOT = os.path.dirname(PY_ROOT)

__all__ = ['ReplBackend', 'BasicReplBackend', 'BACKEND']

def _debug_write(out):
    if DEBUG:
        sys.__stdout__.write(out)
        sys.__stdout__.flush()


class SafeSendLock(object):
    """a lock which ensures we're released if we take a KeyboardInterrupt exception acquiring it"""
    def __init__(self):
        self.lock = thread.allocate_lock()

    def __enter__(self):
        self.acquire()

    def __exit__(self, exc_type, exc_value, tb):
        self.release()

    def acquire(self):
        try:
            self.lock.acquire()
        except KeyboardInterrupt:
            try:
                self.lock.release()
            except:
                pass
            raise

    def release(self):
        self.lock.release()

def _command_line_to_args_list(cmdline):
    """splits a string into a list using Windows command line syntax."""
    args_list = []

    if cmdline and cmdline.strip():
        from ctypes import c_int, c_voidp, c_wchar_p
        from ctypes import byref, POINTER, WinDLL

        clta = WinDLL('shell32').CommandLineToArgvW
        clta.argtypes = [c_wchar_p, POINTER(c_int)]
        clta.restype = POINTER(c_wchar_p)

        lf = WinDLL('kernel32').LocalFree
        lf.argtypes = [c_voidp]

        pNumArgs = c_int()
        r = clta(cmdline, byref(pNumArgs))
        if r:
            for index in range(0, pNumArgs.value):
                if sys.hexversion >= 0x030000F0:
                    argval = r[index]
                else:
                    argval = r[index].encode('ascii', 'replace')
                args_list.append(argval)
            lf(r)
        else:
            sys.stderr.write('Error parsing script arguments:\n')
            sys.stderr.write(cmdline + '\n')

    return args_list


class UnsupportedReplException(Exception):
    def __init__(self, reason):
        self.reason = reason

# save the start_new_thread so we won't debug/break into the REPL comm thread.
start_new_thread = thread.start_new_thread
class ReplBackend(object):
    """back end for executing REPL code.  This base class handles all of the communication with the remote process while derived classes implement the actual inspection and introspection."""
    _MRES = to_bytes('MRES')
    _SRES = to_bytes('SRES')
    _MODS = to_bytes('MODS')
    _IMGD = to_bytes('IMGD')
    _PRPC = to_bytes('PRPC')
    _RDLN = to_bytes('RDLN')
    _STDO = to_bytes('STDO')
    _STDE = to_bytes('STDE')
    _DBGA = to_bytes('DBGA')
    _DETC = to_bytes('DETC')
    _DPNG = to_bytes('DPNG')
    _DXAM = to_bytes('DXAM')
    _CHWD = to_bytes('CHWD')

    _MERR = to_bytes('MERR')
    _SERR = to_bytes('SERR')
    _ERRE = to_bytes('ERRE')
    _EXIT = to_bytes('EXIT')
    _DONE = to_bytes('DONE')
    _MODC = to_bytes('MODC')

    def __init__(self, *args, **kwargs):
        import threading
        self.conn = None
        self.send_lock = SafeSendLock()
        self.input_event = threading.Lock()
        self.input_event.acquire()  # lock starts acquired (we use it like a manual reset event)
        self.input_string = None
        self.exit_requested = False

    def connect(self, port):
        self.conn = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.conn.connect(('127.0.0.1', port))

        # start a new thread for communicating w/ the remote process
        start_new_thread(self._repl_loop, ())

    def connect_using_socket(self, socket):
        self.conn = socket
        start_new_thread(self._repl_loop, ())

    def _repl_loop(self):
        """loop on created thread which processes communicates with the REPL window"""
        try:
            while True:
                if self.check_for_exit_repl_loop():
                    break

                # we receive a series of 4 byte commands.  Each command then

                # has it's own format which we must parse before continuing to

                # the next command.
                self.flush()
                self.conn.settimeout(10)

                # 2.x raises SSLError in case of timeout (http://bugs.python.org/issue10272)
                if SSLError:
                    timeout_exc_types = (socket.timeout, SSLError)
                else:
                    timeout_exc_types = socket.timeout
                try:
                    inp = read_bytes(self.conn, 4)
                except timeout_exc_types:
                    r, w, x = select.select([], [], [self.conn], 0)
                    if x:
                        # an exception event has occured on the socket...
                        raise
                    continue

                self.conn.settimeout(None)
                if inp == '':
                    break
                self.flush()

                cmd = ReplBackend._COMMANDS.get(inp)
                if cmd is not None:
                    cmd(self)
        except:
            _debug_write('error in repl loop')
            _debug_write(traceback.format_exc())
            self.exit_process()

            time.sleep(2) # try and exit gracefully, then interrupt main if necessary

            if sys.platform == 'cli':
                # just kill us as fast as possible
                import System
                System.Environment.Exit(1)

            self.interrupt_main()

    def check_for_exit_repl_loop(self):
        return False

    def _cmd_run(self):
        """runs the received snippet of code"""
        self.run_command(read_string(self.conn))

    def _cmd_abrt(self):
        """aborts the current running command"""
        # abort command, interrupts execution of the main thread.
        self.interrupt_main()

    def _cmd_exit(self):
        """exits the interactive process"""
        self.exit_requested = True
        self.exit_process()

    def _cmd_mems(self):
        """gets the list of members available for the given expression"""
        expression = read_string(self.conn)
        try:
            name, inst_members, type_members = self.get_members(expression)
        except:
            with self.send_lock:
                write_bytes(self.conn, ReplBackend._MERR)
            _debug_write('error in eval')
            _debug_write(traceback.format_exc())
        else:
            with self.send_lock:
                write_bytes(self.conn, ReplBackend._MRES)
                write_string(self.conn, name)
                self._write_member_dict(inst_members)
                self._write_member_dict(type_members)

    def _cmd_sigs(self):
        """gets the signatures for the given expression"""
        expression = read_string(self.conn)
        try:
            sigs = self.get_signatures(expression)
        except:
            with self.send_lock:
                write_bytes(self.conn, ReplBackend._SERR)
            _debug_write('error in eval')
            _debug_write(traceback.format_exc())
        else:
            with self.send_lock:
                write_bytes(self.conn, ReplBackend._SRES)
                # single overload
                write_int(self.conn, len(sigs))
                for doc, args, vargs, varkw, defaults in sigs:
                    # write overload
                    write_string(self.conn, (doc or '')[:4096])
                    arg_count = len(args) + (vargs is not None) + (varkw is not None)
                    write_int(self.conn, arg_count)

                    def_values = [''] * (len(args) - len(defaults)) + ['=' + d for d in defaults]
                    for arg, def_value in zip(args, def_values):
                        write_string(self.conn, (arg or '') + def_value)
                    if vargs is not None:
                        write_string(self.conn, '*' + vargs)
                    if varkw is not None:
                        write_string(self.conn, '**' + varkw)

    def _cmd_setm(self):
        global exec_mod
        """sets the current module which code will execute against"""
        mod_name = read_string(self.conn)
        self.set_current_module(mod_name)

    def _cmd_sett(self):
        """sets the current thread and frame which code will execute against"""
        thread_id = read_int(self.conn)
        frame_id = read_int(self.conn)
        frame_kind = read_int(self.conn)
        self.set_current_thread_and_frame(thread_id, frame_id, frame_kind)

    def _cmd_mods(self):
        """gets the list of available modules"""
        try:
            res = self.get_module_names()
            res.sort()
        except:
            res = []

        with self.send_lock:
            write_bytes(self.conn, ReplBackend._MODS)
            write_int(self.conn, len(res))
            for name, filename in res:
                write_string(self.conn, name)
                write_string(self.conn, filename)

    def _cmd_inpl(self):
        """handles the input command which returns a string of input"""
        self.input_string = read_string(self.conn)
        self.input_event.release()

    def _cmd_excf(self):
        """handles executing a single file"""
        filename = read_string(self.conn)
        args = read_string(self.conn)
        self.execute_file(filename, args)

    def _cmd_excx(self):
        """handles executing a single file, module or process"""
        filetype = read_string(self.conn)
        filename = read_string(self.conn)
        args = read_string(self.conn)
        self.execute_file_ex(filetype, filename, args)

    def _cmd_debug_attach(self):
        import visualstudio_py_debugger
        port = read_int(self.conn)
        id = read_string(self.conn)
        debug_options = visualstudio_py_debugger.parse_debug_options(read_string(self.conn))
        debug_options.setdefault('rules', []).append({
            'path': PY_ROOT,
            'include': False,
            })
        self.attach_process(port, id, debug_options)

    _COMMANDS = {
        to_bytes('run '): _cmd_run,
        to_bytes('abrt'): _cmd_abrt,
        to_bytes('exit'): _cmd_exit,
        to_bytes('mems'): _cmd_mems,
        to_bytes('sigs'): _cmd_sigs,
        to_bytes('mods'): _cmd_mods,
        to_bytes('setm'): _cmd_setm,
        to_bytes('sett'): _cmd_sett,
        to_bytes('inpl'): _cmd_inpl,
        to_bytes('excf'): _cmd_excf,
        to_bytes('excx'): _cmd_excx,
        to_bytes('dbga'): _cmd_debug_attach,
    }

    def _write_member_dict(self, mem_dict):
        write_int(self.conn, len(mem_dict))
        for name, type_name in mem_dict.items():
            write_string(self.conn, name)
            write_string(self.conn, type_name)

    def on_debugger_detach(self):
        with self.send_lock:
            write_bytes(self.conn, ReplBackend._DETC)

    def init_debugger(self):
        from os import path
        sys.path.append(path.dirname(__file__))
        import visualstudio_py_debugger
        new_thread = visualstudio_py_debugger.new_thread()
        sys.settrace(new_thread.trace_func)
        visualstudio_py_debugger.intercept_threads(True)

    def send_image(self, filename):
        with self.send_lock:
            write_bytes(self.conn, ReplBackend._IMGD)
            write_string(self.conn, filename)

    def write_png(self, image_bytes):
        with self.send_lock:
            write_bytes(self.conn, ReplBackend._DPNG)
            write_int(self.conn, len(image_bytes))
            write_bytes(self.conn, image_bytes)

    def write_xaml(self, xaml_bytes):
        with self.send_lock:
            write_bytes(self.conn, ReplBackend._DXAM)
            write_int(self.conn, len(xaml_bytes))
            write_bytes(self.conn, xaml_bytes)

    def send_prompt(self, ps1, ps2, allow_multiple_statements):
        """sends the current prompt to the interactive window"""
        with self.send_lock:
            write_bytes(self.conn, ReplBackend._PRPC)
            write_string(self.conn, ps1)
            write_string(self.conn, ps2)
            write_int(self.conn, 1 if allow_multiple_statements else 0)

    def send_cwd(self):
        """sends the current working directory"""
        with self.send_lock:
            write_bytes(self.conn, ReplBackend._CHWD)
            write_string(self.conn, os.getcwd())

    def send_error(self):
        """reports that an error occured to the interactive window"""
        with self.send_lock:
            write_bytes(self.conn, ReplBackend._ERRE)

    def send_exit(self):
        """reports the that the REPL process has exited to the interactive window"""
        with self.send_lock:
            write_bytes(self.conn, ReplBackend._EXIT)

    def send_command_executed(self):
        with self.send_lock:
            write_bytes(self.conn, ReplBackend._DONE)

    def send_modules_changed(self):
        with self.send_lock:
            write_bytes(self.conn, ReplBackend._MODC)

    def read_line(self):
        """reads a line of input from standard input"""
        with self.send_lock:
            write_bytes(self.conn, ReplBackend._RDLN)
        self.input_event.acquire()
        return self.input_string

    def write_stdout(self, value):
        """writes a string to standard output in the remote console"""
        with self.send_lock:
            write_bytes(self.conn, ReplBackend._STDO)
            write_string(self.conn, value)

    def write_stderr(self, value):
        """writes a string to standard input in the remote console"""
        with self.send_lock:
            write_bytes(self.conn, ReplBackend._STDE)
            write_string(self.conn, value)

    ################################################################

    # Implementation of execution, etc...

    def execution_loop(self):
        """starts processing execution requests"""
        raise NotImplementedError

    def run_command(self, command):
        """runs the specified command which is a string containing code"""
        raise NotImplementedError

    def execute_file(self, filename, args):
        """executes the given filename as the main module"""
        return self.execute_file_ex('script', filename, args)

    def execute_file_ex(self, filetype, filename, args):
        """executes the given filename as a 'script', 'module' or 'process'."""
        raise NotImplementedError

    def interrupt_main(self):
        """aborts the current running command"""
        raise NotImplementedError

    def exit_process(self):
        """exits the REPL process"""
        raise NotImplementedError

    def get_members(self, expression):
        """returns a tuple of the type name, instance members, and type members"""
        raise NotImplementedError

    def get_signatures(self, expression):
        """returns doc, args, vargs, varkw, defaults."""
        raise NotImplementedError

    def set_current_module(self, module):
        """sets the module which code executes against"""
        raise NotImplementedError

    def set_current_thread_and_frame(self, thread_id, frame_id, frame_kind):
        """sets the current thread and frame which code will execute against"""
        raise NotImplementedError

    def get_module_names(self):
        """returns a list of module names"""
        raise NotImplementedError

    def flush(self):
        """flushes the stdout/stderr buffers"""
        raise NotImplementedError

    def attach_process(self, port, debugger_id, debug_options):
        """starts processing execution requests"""
        raise NotImplementedError

def exit_work_item():
    sys.exit(0)

# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import logging
import io
import sys
import traceback
import runpy
import importlib
from datascience.daemon.daemon_output import (
    CustomWriter,
    IORedirector,
    get_io_buffers,
    redirect_output,
    disable_redirection,
)
from contextlib import redirect_stdout, redirect_stderr
from pyls_jsonrpc.dispatchers import MethodDispatcher
from pyls_jsonrpc.endpoint import Endpoint
from pyls_jsonrpc.streams import JsonRpcStreamReader, JsonRpcStreamWriter

log = logging.getLogger(__name__)

MAX_WORKERS = 64


def error_decorator(func):
    """Decorator to trap rcp exceptions and send a formatted error to client."""

    def _decorator(self, *args, **kwargs):
        try:
            return func(self, *args, **kwargs)
        except:
            log.info(
                "Failed executing an rpc method. Error: %s", traceback.format_exc()
            )
            return {"error": traceback.format_exc()}

    return _decorator


class PythonDaemon(MethodDispatcher):
    """ Base Python Daemon with simple methods to check if a module exists, get version info and the like.    """

    def __init__(self, rx, tx):
        self._jsonrpc_stream_reader = JsonRpcStreamReader(rx)
        self._jsonrpc_stream_writer = JsonRpcStreamWriter(tx)
        self._endpoint = Endpoint(
            self, self._jsonrpc_stream_writer.write, max_workers=MAX_WORKERS
        )
        self._shutdown = False

    def __getitem__(self, item):
        """Override getitem to fallback through multiple dispatchers."""
        if self._shutdown and item != "exit":
            # exit is the only allowed method during shutdown
            log.debug("Ignoring non-exit method during shutdown: %s", item)
            raise KeyError

        log.info("Execute rpc method %s", item)
        return super().__getitem__(item)

    def start(self):
        """Entry point for the server."""
        self._shutdown = False
        self._jsonrpc_stream_reader.listen(self._endpoint.consume)

    def m_ping(self, data):
        """ping & pong (check if daemon is alive)."""
        log.info("pinged with %s", data)
        return {"pong": data}

    def m_initialized(self):
        self._endpoint.notify("output", {"category": "stdout", "output": "Initialized"})
        return {"capabilities": {"textDocumentSync": {"openClose": True,}}}

    def _execute_and_capture_output(self, func):
        fout = io.StringIO()
        ferr = io.StringIO()

        with redirect_stdout(fout):
            with redirect_stderr(ferr):
                func()

        output = {}
        if fout.tell():
            output["stdout"] = fout.getvalue()
        if ferr.tell():
            output["stderr"] = ferr.getvalue()
        return output

    def close(self):
        log.info("Closing rpc channel")
        self._shutdown = True
        disable_redirection()
        self._endpoint.shutdown()
        self._jsonrpc_stream_reader.close()
        # Do not close the `writer` stream, as this results in closing the underlying stdout stream.
        # self._jsonrpc_stream_writer.close()

    def m_exit(self, **_kwargs):
        self.close()

    def m_initialize(self, rootUri=None, **kwargs):
        log.info("Got initialize params: %s", kwargs)
        return {"capabilities": {"textDocumentSync": {"openClose": True,}}}

    @error_decorator
    def m_exec_file(self, file_name, args=[], cwd=None, env=None):
        args = [] if args is None else args
        old_argv, sys.argv = sys.argv, [""] + args
        log.info("Exec file %s with args %s", file_name, args)

        def exec_file():
            log.info("execute file %s", file_name)
            runpy.run_path(file_name, globals())

        try:
            return self._execute_and_capture_output(exec_file)
        finally:
            sys.argv = old_argv

    @error_decorator
    def m_exec_code(self, code):
        log.info("Exec code %s", code)

        def exec_code():
            eval(code, globals())

        return self._execute_and_capture_output(exec_code)

    def m_exec_file_observable(self, file_name, args=[], cwd=None, env=None, disconnect_rpc=False):
        """ Sometimes calling modules could result in Python running a process from within.
        E.g. when running something like `jupyter notebook` we're unable to hijack the stdout.
        At this point we're unable to take over stdout/stderr. Hence python program writes directly to stdout.
        Meaning JSON rpc is busted.
        After all, we cannot have two seprate requests that run something in an observable manner. We can only have one piece of code.
        In such cases, please set dtisconnect_rpc=True
        """
        args = [] if args is None else args
        old_argv, sys.argv = sys.argv, [""] + args
        log.info("Exec file (observale) %s with args %s", file_name, args)

        try:
            log.info("execute file %s", file_name)
            if disconnect_rpc:
                # rpc is no-longer usable (see comments).
                self.close()
            runpy.run_path(file_name, globals())
        except Exception:
            if disconnect_rpc:
                # Its possible the code fell over and we returned an error.
                sys.stderr.write(traceback.format_exc())
                sys.stderr.flush()
            else:
                return {"error": traceback.format_exc()}
        finally:
            sys.argv = old_argv

    @error_decorator
    def m_exec_module(self, module_name, args=[], cwd=None, env=None):
        args = [] if args is None else args
        log.info("Exec module %s with args %s", module_name, args)
        if args[-1] == "--version":
            return self._get_module_version(module_name, args)

        old_argv, sys.argv = sys.argv, [""] + args

        def exec_module():

            log.info("execute module %s", module_name)
            runpy.run_module(module_name, globals(), run_name="__main__")

        try:
            return self._execute_and_capture_output(exec_module)
        finally:
            sys.argv = old_argv

    def m_exec_module_observable(self, module_name, args=None, cwd=None, env=None, disconnect_rpc=False):
        """ Sometimes calling modules could result in Python running a process from within.
        E.g. when running something like `jupyter notebook` we're unable to hijack the stdout.
        At this point we're unable to take over stdout/stderr. Hence python program writes directly to stdout.
        Meaning JSON rpc is busted.
        After all, we cannot have two seprate requests that run something in an observable manner. We can only have one piece of code.
        In such cases, please set dtisconnect_rpc=True
        """
        args = [] if args is None else args
        log.info("Exec module (observable) %s with args %s", module_name, args)
        old_argv, sys.argv = sys.argv, [""] + args

        try:
            log.info("execute module %s", module_name)
            if disconnect_rpc:
                # rpc is no-longer usable (see comments).
                self.close()
            runpy.run_module(module_name, globals(), run_name="__main__")
        except Exception:
            if disconnect_rpc:
                # Its possible the code fell over and we returned an error.
                sys.stderr.write(traceback.format_exc())
                sys.stderr.flush()
            else:
                return {"error": traceback.format_exc()}
        finally:
            sys.argv = old_argv

    def _get_module_version(self, module_name, args):
        """We handle `-m pip --version` as a special case. As this causes the current process to die.
        These CLI commands are meant for CLI (i.e. kill process once done).
        """
        args = [] if args is None else args
        if module_name == "jupyter" and args[0] != "--version":
            # This means we're trying to get a version of a sub command.
            # E.g. python -m jupyter notebook --version.
            # In such cases, use the subcommand. We can ignore jupyter.
            module_name = args[0]

        try:
            log.info("getting module_version %s", module_name)
            m = importlib.import_module(module_name)
            return {"stdout": m.__version__}
        except Exception:
            return {"error": traceback.format_exc()}

    def m_get_executable(self):
        return {"path": sys.executable}

    def m_get_interpreter_information(self):
        return {
            "versionInfo": sys.version_info[:4],
            "sysPrefix": sys.prefix,
            "version": sys.version,
            "is64Bit": sys.maxsize > 2 ** 32,
        }

    def m_is_module_installed(self, module_name=None):
        try:
            importlib.import_module(module_name)
            return {"exists": True}
        except Exception:
            return {"exists": False}

    @classmethod
    def start_daemon(cls):
        """ Starts the daemon. """
        if not issubclass(cls, PythonDaemon):
            raise ValueError("Handler class must be an instance of PythonDaemon")
        log.info("Starting %s IO language server", cls.__name__)

        def on_write_stdout(output):
            server._endpoint.notify("output", {"source": "stdout", "out": output})

        def on_write_stderr(output):
            server._endpoint.notify("output", {"source": "stderr", "out": output})

        stdin, stdout = get_io_buffers()
        server = cls(stdin, stdout)
        redirect_output(on_write_stdout, on_write_stdout)
        server.start()

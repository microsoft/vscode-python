# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import logging
import io
import os
import sys
import traceback
import runpy
import importlib
from vscode_datascience_helpers.daemon.daemon_output import (
    CustomWriter,
    IORedirector,
    get_io_buffers,
    redirect_output,
)
from contextlib import redirect_stdout, redirect_stderr, contextmanager
from pyls_jsonrpc.dispatchers import MethodDispatcher
from pyls_jsonrpc.endpoint import Endpoint
from pyls_jsonrpc.streams import JsonRpcStreamReader, JsonRpcStreamWriter

log = logging.getLogger(__name__)

MAX_WORKERS = 64


@contextmanager
def change_exec_context(args=[], cwd=None, env=None):
    # Code for setting and restoring env variables borrowed from stackoverflow
    # https://stackoverflow.com/questions/2059482/python-temporarily-modify-the-current-processs-environment
    if env is not None:
        old_environ = dict(os.environ)
        os.environ.update(env)
    old_argv, sys.argv = sys.argv, [""] + args
    old_cwd = os.getcwd()
    try:
        if cwd is not None:
            os.chdir(cwd)
        yield
    finally:
        sys.argv = old_argv
        if cwd is not None:
            os.chdir(old_cwd)
        if env is not None:
            os.environ.clear()
            os.environ.update(old_environ)


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
    """Base Python Daemon with simple methods to check if a module exists, get version info and the like.
    To add additional methods, please create a separate class based off this and pass in the arg `--daemon-module` to `vscode_datascience_helpers.daemon`.
    """

    def __init__(self, rx, tx):
        self.log = logging.getLogger(
            "{0}.{1}".format(self.__class__.__module__, self.__class__.__name__)
        )
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
            self.log.debug("Ignoring non-exit method during shutdown: %s", item)
            raise KeyError

        self.log.info("Execute rpc method %s from %s", item, sys.executable)
        return super().__getitem__(item)

    def start(self):
        """Entry point for the server."""
        self._shutdown = False
        self._jsonrpc_stream_reader.listen(self._endpoint.consume)

    def m_ping(self, data):
        """ping & pong (check if daemon is alive)."""
        self.log.info("pinged with %s", data)
        return {"pong": data}

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
        self.log.info("Closing rpc channel")
        self._shutdown = True
        self._endpoint.shutdown()
        self._jsonrpc_stream_reader.close()
        self._jsonrpc_stream_writer.close()

    def m_exit(self, **_kwargs):
        self.close()

    @error_decorator
    def m_exec_file(self, file_name, args=[], cwd=None, env=None):
        args = [] if args is None else args
        self.log.info("Exec file %s with args %s", file_name, args)

        def exec_file():
            self.log.info("execute file %s", file_name)
            runpy.run_path(file_name, globals())

        with change_exec_context(args, cwd, env):
            return self._execute_and_capture_output(exec_file)

    @error_decorator
    def m_exec_file_observable(self, file_name, args=[], cwd=None, env=None):
        args = [] if args is None else args
        old_argv, sys.argv = sys.argv, [""] + args
        self.log.info("Exec file (observale) %s with args %s", file_name, args)

        with change_exec_context(args, cwd, env):
            runpy.run_path(file_name, globals())

    @error_decorator
    def m_exec_module(self, module_name, args=[], cwd=None, env=None):
        args = [] if args is None else args
        self.log.info("Exec module %s with args %s", module_name, args)
        if args[-1] == "--version":
            return self._get_module_version(module_name, args)

        def exec_module():

            self.log.info("execute module %s", module_name)
            runpy.run_module(module_name, globals(), run_name="__main__")

        with change_exec_context(args, cwd, env):
            return self._execute_and_capture_output(exec_module)

    @error_decorator
    def m_exec_module_observable(self, module_name, args=None, cwd=None, env=None):
        args = [] if args is None else args
        self.log.info("Exec module (observable) %s with args %s", module_name, args)

        with change_exec_context(args, cwd, env):
            runpy.run_module(module_name, globals(), run_name="__main__")

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
            self.log.info("getting module_version %s", module_name)
            m = importlib.import_module(module_name)
            return {"stdout": m.__version__}
        except Exception:
            return {"error": traceback.format_exc()}

    def m_get_executable(self):
        return {"path": sys.executable}

    def m_get_interpreter_information(self):
        return {
            "versionInfo": tuple(sys.version_info),
            "sysPrefix": sys.prefix,
            "version": sys.version,
            "is64Bit": sys.maxsize > 2 ** 32,
        }

    def m_is_module_installed(self, module_name=None):
        return {"exists": self._is_module_installed(module_name)}

    def _is_module_installed(self, module_name=None):
        try:
            importlib.import_module(module_name)
            return True
        except Exception:
            return False

    @classmethod
    def start_daemon(cls, logging_queue_handler=None):
        """ Starts the daemon. """
        if not issubclass(cls, PythonDaemon):
            raise ValueError("Handler class must be an instance of PythonDaemon")
        log.info("Starting %s Daemon", cls.__name__)

        def on_write_stdout(output):
            server._endpoint.notify("output", {"source": "stdout", "out": output})

        def on_write_stderr(output):
            server._endpoint.notify("output", {"source": "stderr", "out": output})

        stdin, stdout = get_io_buffers()
        server = cls(stdin, stdout)
        redirect_output(on_write_stdout, on_write_stderr)
        # Set up the queue handler that'll send log messages over to the client.
        if logging_queue_handler is not None:
            logging_queue_handler.set_server(server)
        server.start()

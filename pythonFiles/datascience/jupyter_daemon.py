# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import sys
import logging
import os
from datascience.daemon.daemon_python import (
    error_decorator,
    PythonDaemon as BasePythonDaemon,
    change_exec_context,
)

log = logging.getLogger(__name__)


class PythonDaemon(BasePythonDaemon):
    def __init__(self, rx, tx):
        log.info("DataScience Daemon init")
        super().__init__(rx, tx)

    def __getitem__(self, item):
        """Override getitem to ensure we use these methods."""
        log.info("Execute rpc method %s in Jupyter class", item)
        return super().__getitem__(item)

    @error_decorator
    def m_exec_module(self, module_name, args=[], cwd=None, env=None):
        log.info("Exec in DS Daemon %s with args %s", module_name, args)
        args = [] if args is None else args

        if module_name == "jupyter" and args == ["kernelspec", "list"]:
            return self._execute_and_capture_output(self._print_kernel_list)
        elif module_name == "jupyter" and args == ["kernelspec", "--version"]:
            return self._execute_and_capture_output(self._print_kernelspec_version)
        else:
            log.info("check base class stuff")
            return super().m_exec_module(module_name, args, cwd, env)

    @error_decorator
    def m_exec_module_observable(self, module_name, args=None, cwd=None, env=None):
        log.info("Exec in DS Daemon (observable) %s with args %s", module_name, args)
        args = [] if args is None else args

        # Assumption is that `python -m jupyter notebook` or `python -m notebook` with observable output
        # will only ever be used to start a notebook and nothing else.
        # E.g. `python -m jupyter notebook --version` wouldn't require the use of exec_module_observable,
        # In such cases, we can get the output immediately.
        if (module_name == "jupyter" and args[0] == "notebook") or (
            module_name == "notebook"
        ):
            # Args must not have ['notebook'] in the begining. Drop the `notebook` subcommand when using `jupyter`
            args = args[1:] if args[0] == "notebook" else args
            log.info("Starting notebook with args %s", args)

            # When launching notebook always ensure the first argument is `notebook`.
            with change_exec_context(args, cwd, env):
                self._start_notebook(args)
        else:
            return super().m_exec_module_observable(module_name, args, cwd, env)

    def _print_kernelspec_version(self):
        import jupyter_client

        # Check whether kernelspec module exists.
        import jupyter_client.kernelspec

        sys.stdout.write(jupyter_client.__version__)
        sys.stdout.flush()

    def _print_kernelspec_version(self):
        import jupyter_client

        # Check whether kernelspec module exists.
        import jupyter_client.kernelspec

        sys.stdout.write(jupyter_client.__version__)
        sys.stdout.flush()

    def _print_kernel_list(self):
        log.info("check kernels")
        # Get kernel specs.
        import jupyter_client.kernelspec

        specs = jupyter_client.kernelspec.find_kernel_specs()
        sys.stdout.write(
            os.linesep.join(list("{0} {1}".format(k, v) for k, v in specs.items()))
        )
        sys.stdout.flush()

    def _start_notebook(self, args):
        from notebook import notebookapp as app

        sys.argv = [""] + args
        app.launch_new_instance()

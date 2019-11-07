# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import sys
import logging
import os
from datascience.daemon.daemon_python import (
    error_decorator,
    PythonDaemon as BasePythonDaemon,
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
        log.info("Exec in child class %s with args %s", module_name, args)
        args = [] if args is None else args

        if module_name == "jupyter" and args == ["kernelspec", "list"]:
            return self._execute_and_capture_output(self._print_kernel_list)
        elif module_name == "jupyter" and args == ["kernelspec", "--version"]:
            return self._execute_and_capture_output(self._print_kernelspec_version)
        else:
            log.info("check base class stuff")
            return super().m_exec_module(module_name, args, cwd, env)

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

    def m_hello(self, rootUri=None, **kwargs):
        from notebook.notebookapp import main

        sys.argv = ["notebook", "--no-browser"]
        main()
        return {}

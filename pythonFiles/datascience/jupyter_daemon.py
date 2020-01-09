# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import json
import logging
import os
import subprocess
import sys
from datascience.daemon.daemon_python import (
    error_decorator,
    PythonDaemon as BasePythonDaemon,
    change_exec_context,
)

class PythonDaemon(BasePythonDaemon):
    def __init__(self, rx, tx):
        super().__init__(rx, tx)
        self.log.info("DataScience Daemon init")

    def __getitem__(self, item):
        """Override getitem to ensure we use these methods."""
        self.log.info("Execute rpc method %s in DS Daemon", item)
        return super().__getitem__(item)

    @error_decorator
    def m_exec_module(self, module_name, args=[], cwd=None, env=None):
        self.log.info("Exec in DS Daemon %s with args %s", module_name, args)
        args = [] if args is None else args

        if module_name == "jupyter":
            if args[0] == "kernelspec" and self._is_module_installed("jupyter_client.kernelspec"):
                if args == ["kernelspec", "list", "--json"]:
                    return self._execute_and_capture_output(self._print_kernel_list_json)
                elif args == ["kernelspec", "list"]:
                    return self._execute_and_capture_output(self._print_kernel_list)
                elif args == ["kernelspec", "--version"]:
                    return self._execute_and_capture_output(self._print_kernelspec_version)
            if args[0] == "nbconvert" and self._is_module_installed("nbconvert") and args[-1] != "--version":
                return self._execute_and_capture_output(lambda : self._convert(args))
            if args[0] == "notebook" and args[1] == "--version":
                try:
                    from notebook import notebookapp as app
                    return {"stdout": '.'.join(list(str(v) for v in app.version_info))}
                except Exception:
                    pass
            # kernelspec, nbconvert are subcommands of jupyter.
            # python -m jupyter kernelspec, python -m jupyter nbconvert,
            # In such cases, even if the modules kernelspec or nbconvert are not installed in the current
            # environment, jupyter will find them in current path.
            # So if we cannot find the corresponding subcommands, lets revert to subprocess.
            self.log.info("Exec in DS Daemon with as subprocess, %s with args %s", module_name, args)
            return self._exec_with_subprocess(module_name, args, cwd, env)
        else:
            self.log.info("check base class stuff")
            return super().m_exec_module(module_name, args, cwd, env)

    def _exec_with_subprocess(self, module_name, args=[], cwd=None, env=None):
        # # result = subprocess.run([sys.executable, "-m"] + args, stdout=sys.stdout, stderr=sys.stderr)
        # return self._execute_and_capture_output(lambda: subprocess.run([sys.executable, "-m", module_name] + args, stdout=sys.stdout, stderr=sys.stderr))
        result = subprocess.run([sys.executable, "-m", module_name] + args, capture_output=True)
        encoding = os.getenv('PYTHONIOENCODING', 'utf-8')
        stdout = result.stdout.decode(encoding)
        stderr = result.stderr.decode(encoding)
        self.log.info("subprocess output for, %s with args %s, \nstdout is %s, \nstderr is %s",
                        module_name, args, stdout, stderr)
        return {
            "stdout": stdout,
            "stderr": stderr
        }

    @error_decorator
    def m_exec_module_observable(self, module_name, args=None, cwd=None, env=None):
        self.log.info("Exec in DS Daemon (observable) %s with args %s", module_name, args)
        args = [] if args is None else args

        # Assumption is that `python -m jupyter notebook` or `python -m notebook` with observable output
        # will only ever be used to start a notebook and nothing else.
        # E.g. `python -m jupyter notebook --version` wouldn't require the use of exec_module_observable,
        # In such cases, we can get the output immediately.
        if (module_name == "jupyter" and args[0] == "notebook") or (
            module_name == "notebook"
        ):
            self._start_notebook(args, cwd, env)
        else:
            return super().m_exec_module_observable(module_name, args, cwd, env)

    def _print_kernelspec_version(self):
        import jupyter_client

        # Check whether kernelspec module exists.
        import jupyter_client.kernelspec

        sys.stdout.write(jupyter_client.__version__)
        sys.stdout.flush()

    def _print_kernel_list(self):
        self.log.info("listing kernels")
        # Get kernel specs.
        import jupyter_client.kernelspec

        specs = jupyter_client.kernelspec.find_kernel_specs()
        sys.stdout.write(
            os.linesep.join(list("{0} {1}".format(k, v) for k, v in specs.items()))
        )
        sys.stdout.flush()

    def _print_kernel_list_json(self):
        self.log.info("listing kernels as json")
        # Get kernel specs.
        import jupyter_client.kernelspec
        specs = jupyter_client.kernelspec.KernelSpecManager().get_all_specs()
        all_specs = {
            "kernelspecs": specs
        }
        sys.stdout.write(json.dumps(all_specs))
        sys.stdout.flush()

    def _convert(self, args):
        self.log.info("nbconvert")
        from nbconvert import nbconvertapp as app

        sys.argv = [""] + args
        app.main()

    def _start_notebook(self, args, cwd, env):
        from notebook import notebookapp as app

        # Args must not have ['notebook'] in the begining. Drop the `notebook` subcommand when using `jupyter`
        args = args[1:] if args[0] == "notebook" else args
        self.log.info("Starting notebook with args %s", args)

        # When launching notebook always ensure the first argument is `notebook`.
        with change_exec_context(args, cwd, env):
            app.launch_new_instance()

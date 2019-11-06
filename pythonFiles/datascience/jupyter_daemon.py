import sys
import datascience.daemon.daemon_python as BasePythonDaemon
import logging
import os
from datascience.daemon.daemon_python import error_decorator

log = logging.getLogger(__name__)


class PythonDaemon(BasePythonDaemon.PythonDaemon):
    """ Implementation of the Microsoft VSCode Language Server Protocol
    https://github.com/Microsoft/language-server-protocol/blob/master/versions/protocol-1-x.md
    """

    def __init__(self, rx, tx):
        log.info("Child class init")
        super(PythonDaemon, self).__init__(rx, tx)

    def __getitem__(self, item):
        """Override getitem to ensure we use these methods."""
        log.info("Execute rpc method %s in Jupyter class", item)
        return super(PythonDaemon, self).__getitem__(item)

    @error_decorator
    def m_exec_module(self, module_name, args=[], cwd=None, env=None):
        log.info("Exec in child class %s with args %s", module_name, args)
        args = [] if args is None else args

        if module_name == "jupyter" and args == ["kernelspec", "list"]:
            return self._execute_and_capture_output(self._print_kernel_list)
        else:
            log.info("check base class stuff")
            return super(PythonDaemon, self).m_exec_module(module_name, args, cwd, env)

    def _print_kernel_list(self):
        log.info("check kernels")
        # Get kernel specs.
        import jupyter_client.kernelspec

        specs = jupyter_client.kernelspec.find_kernel_specs()
        print(os.linesep.join(list("{0} {1}".format(k, v) for k, v in specs.items())))

    def m_hello(self, rootUri=None, **kwargs):
        # print("Hello World")
        # log.info("Got initialize params: %s", kwargs)
        # return {"hello": {"wow": 1}}
        import jupyter_core
        import jupyter_core.command

        sys.argv = ["", "notebook", "--no-browser"]
        self.close()
        # jupyter_core.command.main()
        return {"started": {"wow": 1}}

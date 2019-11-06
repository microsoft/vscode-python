
import sys
import datascience.daemon.daemon_python as BasePythonDaemon


class PythonDaemon(BasePythonDaemon.PythonDaemon):
    """ Implementation of the Microsoft VSCode Language Server Protocol
    https://github.com/Microsoft/language-server-protocol/blob/master/versions/protocol-1-x.md
    """

    def __init__(self, rx, tx):
        BasePythonDaemon.PythonDaemon.__init__(self, rx, tx)

    def m_hello(self, rootUri=None, **kwargs):
        # print("Hello World")
        # log.info("Got initialize params: %s", kwargs)
        # return {"hello": {"wow": 1}}
        import jupyter_core
        import jupyter_core.command
        sys.argv = ['', 'notebook', '--no-browser']
        self.close()
        # jupyter_core.command.main()
        return {"started": {"wow": 1}}

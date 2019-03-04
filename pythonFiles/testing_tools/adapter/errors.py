
class UnsupportedToolError(ValueError):
    def __init__(self, tool):
        super().__init__('unsupported tool {!r}'.format(tool))
        self.tool = tool


class UnsupportedCommandError(ValueError):
    def __init__(self, cmd):
        super().__init__('unsupported cmd {!r}'.format(cmd))
        self.cmd = cmd

# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


class UnsupportedToolError(ValueError):
    def __init__(self, tool):
        msg = f"unsupported tool {tool!r}"
        super().__init__(msg)
        self.tool = tool


class UnsupportedCommandError(ValueError):
    def __init__(self, cmd):
        msg = f"unsupported cmd {cmd!r}"
        super().__init__(msg)
        self.cmd = cmd

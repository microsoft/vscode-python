# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


from .base import Component
from .base import Terminal as BaseTerminal


class Terminal(BaseTerminal, Component):
    def wait_for_terminal_text(self, value: str, **kwargs):
        pass

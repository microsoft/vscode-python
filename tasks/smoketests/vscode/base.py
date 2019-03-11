# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

from abc import ABC, abstractmethod
from .core import Core


class Documents(object):
    @abstractmethod
    def open_file(self, filename: str, **kwargs):
        pass

    @abstractmethod
    def is_file_open(self, filename: str, **kwargs):
        pass

    @abstractmethod
    def create_new_untitled_file(self, language='Python', **kwargs):
        pass


class QuickOpen(object):
    @abstractmethod
    def open(self, value: str, is_command=False, **kwargs):
        pass

    @abstractmethod
    def select_command(self, command: str, **kwargs):
        pass

    @abstractmethod
    def wait_until_selected(self, value: str, **kwargs):
        pass

class BaseApplication(object):
    def __init__(self, core: Core, **kwargs):
        self.core = core
        self.quick_open = kwargs.get('quick_open', None)
        self.documents = kwargs.get('documents', None)

    @property
    def quick_open(self)-> QuickOpen:
        pass

    @property
    def documents(self)-> Documents:
        pass

class Component(ABC):
    def __init__(self, app: BaseApplication):
        self.app = app

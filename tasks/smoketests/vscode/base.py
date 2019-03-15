# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


from abc import ABC, abstractmethod

from .core import Core


class Documents:
    @abstractmethod
    def open_file(self, filename: str, **kwargs):
        pass

    @abstractmethod
    def is_file_open(self, filename: str, **kwargs):
        pass

    @abstractmethod
    def create_new_untitled_file(self, language="Python", **kwargs):
        pass

    @abstractmethod
    def scroll_to_top(self, **kwargs):
        pass


class QuickOpen:
    @abstractmethod
    def select_command(self, command: str, **kwargs):
        pass


class StatusBar:
    def wait_for_item_with_tooltip(self, value: str, **kwargs):
        pass


class QuickInput:
    @abstractmethod
    def select_value(self, value: str, **kwargs):
        pass


class Terminal:
    @abstractmethod
    def wait_for_terminal_text(self, value: str, **kwargs):
        pass


class Notifications:
    @abstractmethod
    def clear(self, **kwargs):
        pass

    @abstractmethod
    def wait_for_message(self, value: str, **kwargs):
        pass

    @abstractmethod
    def wait_for_message_containing(self, value: str, **kwargs):
        pass


class BaseApplication:
    def __init__(self, core: Core, **kwargs):
        self.core = core
        self.quick_open = kwargs.get("quick_open", None)
        self.quick_input = kwargs.get("quick_input", None)
        self.status_bar = kwargs.get("status_bar", None)
        self.documents = kwargs.get("documents", None)
        self.notifications = kwargs.get("notifications", None)

    @property
    def quick_open(self) -> QuickOpen:
        pass

    @property
    def quick_input(self) -> QuickInput:
        pass

    @property
    def documents(self) -> Documents:
        pass

    @property
    def status_bar(self) -> StatusBar:
        pass

    @property
    def notifications(self) -> Notifications:
        pass

    @property
    def terminal(self) -> Terminal:
        pass

    def reload(self):
        pass

    def capture_screen(self):
        pass


class Component(ABC):
    def __init__(self, app: BaseApplication):
        self.app = app


class Context:
    @property
    def app(self) -> BaseApplication:
        pass

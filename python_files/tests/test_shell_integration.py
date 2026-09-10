import importlib
import platform
import sys
from typing import Protocol, cast
from unittest.mock import Mock

import pythonrc

is_wsl = "microsoft-standard-WSL" in platform.release()


class _Hooks(Protocol):
    failure_flag: bool


class _PS1(Protocol):
    hooks: _Hooks


def test_decoration_success():
    importlib.reload(pythonrc)
    if sys.platform != "win32" and (not is_wsl):
        ps1 = cast(_PS1, sys.ps1)
        ps1.hooks.failure_flag = False
        result = str(ps1)
        assert (
            result
            == "\x01\x1b]633;C\x07\x1b]633;E;None\x07\x1b]633;D;0\x07\x1b]633;A\x07\x02>>> \x01\x1b]633;B\x07\x02"
        )


def test_decoration_failure():
    importlib.reload(pythonrc)
    if sys.platform != "win32" and (not is_wsl):
        ps1 = cast(_PS1, sys.ps1)
        ps1.hooks.failure_flag = True
        result = str(ps1)
        assert (
            result
            == "\x01\x1b]633;C\x07\x1b]633;E;None\x07\x1b]633;D;1\x07\x1b]633;A\x07\x02>>> \x01\x1b]633;B\x07\x02"
        )


def test_displayhook_call():
    importlib.reload(pythonrc)
    mock_displayhook = Mock()

    hooks = sys.displayhook.__self__
    hooks.original_displayhook = mock_displayhook

    hooks.vscode_displayhook("mock_value")

    mock_displayhook.assert_called_once_with("mock_value")


def test_excepthook_call():
    importlib.reload(pythonrc)
    mock_excepthook = Mock()

    hooks = sys.excepthook.__self__
    hooks.original_excepthook = mock_excepthook

    hooks.vscode_excepthook("mock_type", "mock_value", "mock_traceback")
    mock_excepthook.assert_called_once_with("mock_type", "mock_value", "mock_traceback")


def test_does_not_pollute_namespace():
    importlib.reload(pythonrc)

    assert not [name for name in vars(pythonrc) if not name.startswith("__")]


if sys.platform == "darwin":

    def test_print_statement_darwin(monkeypatch):
        importlib.reload(pythonrc)
        with monkeypatch.context() as m:
            m.setattr("builtins.print", Mock())
            importlib.reload(sys.modules["pythonrc"])
            print.assert_any_call(
                "Cmd click to launch VS Code Native REPL (https://aka.ms/python-native-repl)"
            )


if sys.platform == "win32":

    def test_print_statement_non_darwin(monkeypatch):
        importlib.reload(pythonrc)
        with monkeypatch.context() as m:
            m.setattr("builtins.print", Mock())
            importlib.reload(sys.modules["pythonrc"])
            print.assert_any_call(
                "Ctrl click to launch VS Code Native REPL (https://aka.ms/python-native-repl)"
            )

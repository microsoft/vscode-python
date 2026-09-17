import importlib
import platform
import sys
from pathlib import Path
from typing import Any, Protocol, cast
from unittest.mock import Mock

import pythonrc

is_wsl = "microsoft-standard-WSL" in platform.release()

PYTHONRC_PATH = Path(pythonrc.__file__)


class _Hooks(Protocol):
    failure_flag: bool


class _PS1(Protocol):
    hooks: _Hooks


def test_decoration_success():
    importlib.reload(pythonrc)
    if sys.platform != "win32" and (not is_wsl):
        ps1 = cast("_PS1", sys.ps1)
        ps1.hooks.failure_flag = False
        result = str(ps1)
        assert (
            result
            == "\x01\x1b]633;C\x07\x1b]633;E;None\x07\x1b]633;D;0\x07\x1b]633;A\x07\x02>>> \x01\x1b]633;B\x07\x02"
        )


def test_decoration_failure():
    importlib.reload(pythonrc)
    if sys.platform != "win32" and (not is_wsl):
        ps1 = cast("_PS1", sys.ps1)
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


def test_prompt_survives_shadowed_builtins_under_pythonstartup():
    # PYTHONSTARTUP executes pythonrc's source directly inside the real
    # REPL's __main__ namespace, not as an imported module. The tests
    # above import pythonrc normally, which gives PS1 its own module
    # namespace instead of __main__ and would never catch this. Simulate
    # the real PYTHONSTARTUP path by exec-ing the source into a synthetic
    # __main__-like namespace, then shadow the names PS1 relies on at
    # prompt-render time and confirm rendering the prompt still works.
    if sys.platform == "win32" or is_wsl:
        return

    source = PYTHONRC_PATH.read_text(encoding="utf-8")
    namespace: dict[str, Any] = {"__name__": "__main__"}
    exec(compile(source, str(PYTHONRC_PATH), "exec"), namespace)

    namespace.update(
        {
            "int": 20,
            "bool": 20,
            "str": 20,
            "sys": 1,
            "original_ps1": "shadowed",
            "get_last_command": "shadowed",
        }
    )

    ps1 = cast("_PS1", sys.ps1)
    result = str(ps1)
    assert (
        result
        == "\x01\x1b]633;C\x07\x1b]633;E;None\x07\x1b]633;D;0\x07\x1b]633;A\x07\x02>>> \x01\x1b]633;B\x07\x02"
    )


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

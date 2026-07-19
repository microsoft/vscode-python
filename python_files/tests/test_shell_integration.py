import importlib
import platform
import sys
from pathlib import Path
from typing import Any
from unittest.mock import Mock

import pythonrc

is_wsl = "microsoft-standard-WSL" in platform.release()

PYTHONRC_PATH = Path(pythonrc.__file__)


def test_decoration_success():
    importlib.reload(pythonrc)
    ps1 = pythonrc.PS1()

    ps1.hooks.failure_flag = False
    result = str(ps1)
    if sys.platform != "win32" and (not is_wsl):
        assert (
            result
            == "\x01\x1b]633;C\x07\x1b]633;E;None\x07\x1b]633;D;0\x07\x1b]633;A\x07\x02>>> \x01\x1b]633;B\x07\x02"
        )
    else:
        pass


def test_decoration_failure():
    importlib.reload(pythonrc)
    ps1 = pythonrc.PS1()

    ps1.hooks.failure_flag = True
    result = str(ps1)
    if sys.platform != "win32" and (not is_wsl):
        assert (
            result
            == "\x01\x1b]633;C\x07\x1b]633;E;None\x07\x1b]633;D;1\x07\x1b]633;A\x07\x02>>> \x01\x1b]633;B\x07\x02"
        )
    else:
        pass


def test_displayhook_call():
    importlib.reload(pythonrc)
    pythonrc.PS1()
    mock_displayhook = Mock()

    hooks = pythonrc.REPLHooks()
    hooks.original_displayhook = mock_displayhook

    hooks.my_displayhook("mock_value")

    mock_displayhook.assert_called_once_with("mock_value")


def test_excepthook_call():
    importlib.reload(pythonrc)
    pythonrc.PS1()
    mock_excepthook = Mock()

    hooks = pythonrc.REPLHooks()
    hooks.original_excepthook = mock_excepthook

    hooks.my_excepthook("mock_type", "mock_value", "mock_traceback")
    mock_excepthook.assert_called_once_with("mock_type", "mock_value", "mock_traceback")


if sys.platform == "darwin":

    def test_print_statement_darwin(monkeypatch):
        importlib.reload(pythonrc)
        with monkeypatch.context() as m:
            m.setattr("builtins.print", Mock())
            importlib.reload(sys.modules["pythonrc"])
            print.assert_any_call("Cmd click to launch VS Code Native REPL")


if sys.platform == "win32":

    def test_print_statement_non_darwin(monkeypatch):
        importlib.reload(pythonrc)
        with monkeypatch.context() as m:
            m.setattr("builtins.print", Mock())
            importlib.reload(sys.modules["pythonrc"])
            print.assert_any_call("Ctrl click to launch VS Code Native REPL")


def test_prompt_survives_shadowed_builtins_under_pythonstartup():
    """Regression test for #26039.

    PYTHONSTARTUP executes pythonrc.py's code directly inside __main__, not
    as a normal module import, so PS1.__str__.__globals__ ends up being the
    user's own namespace. `import pythonrc` (used by every other test in
    this file) does not reproduce that, since it gives PS1 its own module
    namespace instead. Simulate the real PYTHONSTARTUP path here: exec the
    source into a stand-in __main__ dict, then shadow the names the prompt
    depends on exactly as a user would (`int = 20`, `sys = 1`, etc.) and
    confirm str(sys.ps1) still renders instead of raising.
    """
    if sys.platform == "win32" or is_wsl:
        return

    main_ns: dict[str, Any] = {"__name__": "__main__"}
    source = PYTHONRC_PATH.read_text()
    exec(compile(source, str(PYTHONRC_PATH), "exec"), main_ns)

    ps1 = main_ns["sys"].ps1
    assert str(ps1)  # sanity: works before any shadowing

    for name, value in {
        "int": 20,
        "sys": 1,
        "str": "nope",
        "bool": "nope",
        "original_ps1": "hijacked",
        "get_last_command": "hijacked",
    }.items():
        main_ns[name] = value
        assert str(ps1), f"prompt failed to render after shadowing {name!r}"
        
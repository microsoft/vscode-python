import importlib

import pythonrc


def test_decoration_success():
    importlib.reload(pythonrc)
    ps1 = pythonrc.PS1()

    ps1.hooks.failure_flag = False
    result = str(ps1)
    assert result == "\x1b]633;D;00\x07\x1b]633;A\x07>>>\x1b]633;B\x07\x1b]633;C\x07"


def test_decoration_failure():
    importlib.reload(pythonrc)
    ps1 = pythonrc.PS1()

    ps1.hooks.failure_flag = True
    result = str(ps1)

    assert result == "\x1b]633;D;10\x07\x1b]633;A\x07>>>\x1b]633;B\x07\x1b]633;C\x07"

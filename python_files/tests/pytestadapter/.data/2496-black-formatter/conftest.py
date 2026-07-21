# -*- coding: utf-8 -*-
# Local replacement for the pytest-black plugin that supports pytest 8.4+.
# pytest-black 0.6.0 uses the deprecated `path` argument in pytest_collect_file,
# which was removed in pytest 8.1. This conftest provides a compatible implementation.

import re
import subprocess
import sys

import pytest

try:
    import tomli
except ImportError:
    tomli = None  # type: ignore[assignment]

HISTKEY = "black/mtimes"


def pytest_addoption(parser):
    group = parser.getgroup("general")
    group.addoption(
        "--black", action="store_true", help="enable format checking with black"
    )


def pytest_configure(config):
    # load cached mtimes at session startup
    if config.option.black and hasattr(config, "cache"):
        config._blackmtimes = config.cache.get(HISTKEY, {})
    config.addinivalue_line("markers", "black: enable format checking with black")


def pytest_unconfigure(config):
    # save cached mtimes at end of session
    if hasattr(config, "_blackmtimes"):
        config.cache.set(HISTKEY, config._blackmtimes)


def pytest_collect_file(file_path, parent):
    config = parent.config
    if (
        config.option.black
        and file_path.suffix in (".py", ".pyi")
        and file_path.name != "conftest.py"
    ):
        return BlackFile.from_parent(parent, path=file_path)


class BlackFile(pytest.File):
    def collect(self):
        """Return a list of children (items and collectors) for this collection node."""
        yield BlackItem.from_parent(self, name="black")


class BlackItem(pytest.Item):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.add_marker("black")
        try:
            if tomli is not None:
                with open("pyproject.toml", "rb") as toml_file:
                    settings = tomli.load(toml_file)["tool"]["black"]
                if "include" in settings:
                    settings["include"] = self._re_fix_verbose(settings["include"])
                if "exclude" in settings:
                    settings["exclude"] = self._re_fix_verbose(settings["exclude"])
                self.pyproject = settings
            else:
                self.pyproject = {}
        except Exception:
            self.pyproject = {}

    def setup(self):
        pytest.importorskip("black")
        mtimes = getattr(self.config, "_blackmtimes", {})
        self._blackmtime = self.path.stat().st_mtime
        old = mtimes.get(str(self.path), 0)
        if self._blackmtime == old:
            pytest.skip("file(s) previously passed black format checks")

        if self._skip_test():
            pytest.skip("file(s) excluded by pyproject.toml")

    def runtest(self):
        cmd = [
            sys.executable,
            "-m",
            "black",
            "--check",
            "--diff",
            "--quiet",
            str(self.path),
        ]
        try:
            subprocess.run(cmd, check=True, stdout=subprocess.PIPE, text=True)
        except subprocess.CalledProcessError as e:
            raise BlackError(e)

        mtimes = getattr(self.config, "_blackmtimes", {})
        mtimes[str(self.path)] = self._blackmtime

    def repr_failure(self, excinfo):
        if excinfo.errisinstance(BlackError):
            return excinfo.value.args[0].stdout
        return super().repr_failure(excinfo)

    def reportinfo(self):
        return (self.path, -1, "Black format check")

    def _skip_test(self):
        return self._excluded() or (not self._included())

    def _included(self):
        if "include" not in self.pyproject:
            return True
        return re.search(self.pyproject["include"], str(self.path))

    def _excluded(self):
        if "exclude" not in self.pyproject:
            return False
        return re.search(self.pyproject["exclude"], str(self.path))

    def _re_fix_verbose(self, regex):
        if "\n" in regex:
            regex = "(?x)" + regex
        return re.compile(regex)


class BlackError(Exception):
    pass

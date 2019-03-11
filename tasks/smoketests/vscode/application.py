# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os
import shutil
import time
from typing import List
from dataclasses import dataclass
from enum import Enum
from selenium import webdriver
from .utils import get_binary_location, get_cli_location
from ..bootstrap.main import get_extension_path as get_bootstrap_ext_path
from ..utils.tools import run_command, ensure_directory
from selenium.common.exceptions import NoSuchElementException
from .quick_open import QuickOpen
import selenium
import selenium.common
import selenium.webdriver
from .core import Core
from .documents import Documents

@dataclass
class Options:
    executable_dir: str
    user_dir: str
    extensions_dir: str
    extension_path: str
    workspace_folder: str


def get_options(vscode_directory: str, vsix_file: str):
    vscode_directory = os.path.abspath(vscode_directory)
    options = Options(
        os.path.join(vscode_directory, "vscode"),
        os.path.join(vscode_directory, "user"),
        os.path.join(vscode_directory, "extensions"),
        vsix_file,
        os.path.join(vscode_directory, "workspace folder"),
    )
    ensure_directory(options.extensions_dir)
    ensure_directory(options.user_dir)
    ensure_directory(options.workspace_folder)
    return options


def _setup_environment(dirs: Options):
    os.environ["PATH"] += os.pathsep + dirs.executable_dir
    try:
        shutil.rmtree(dirs.extensions_dir)
    except Exception:
        pass


def uninstall_extension(options: Options):
    command = [
        get_binary_location(options.executable_dir),
        get_cli_location(options.executable_dir),
        "--uninstall-extension=ms-python.python",
    ]
    run_command(command, progress_message="Uninstall Python Extension")


def install_extension(options: Options):
    env = {"ELECTRON_RUN_AS_NODE": "1"}
    command = [
        get_binary_location(options.executable_dir),
        get_cli_location(options.executable_dir),
        f"--install-extension={options.extension_path}",
    ]
    run_command(command, progress_message="Installing Python Extension", env=env)

    bootstrap_extension = get_bootstrap_ext_path()
    command = [
        get_binary_location(options.executable_dir),
        get_cli_location(options.executable_dir),
        f"--install-extension={bootstrap_extension}",
    ]
    run_command(command, progress_message="Installing Smoke Test Extension", env=env)


def launch_extension(options: Options):
    chrome_options = webdriver.ChromeOptions()
    for arg in [
        f"folder-uri=file:{options.workspace_folder}",
        "skip-getting-started",
        "skip-release-notes",
        "sticky-quickopen",
        "disable-telemetry",
        "disable-updates",
        "disable-crash-reporter",
    ]:
        chrome_options.add_argument(arg)

    chrome_options.binary_location = get_binary_location(options.executable_dir)
    driver = webdriver.Chrome(options=chrome_options)
    return driver


class Application(object):
    def __init__(self, core: Core):
        self.core = core
        self.quick_open = QuickOpen(self)
        self.documents = Documents(self)

    @classmethod
    def start(cls, options: Options):
        _setup_environment(options)
        driver = launch_extension(options)
        core = Core(driver)
        app = cls(core)
        return app

    def exit(self):
        pass

    def reload(self):
        pass

    def capture_screen(self):
        pass

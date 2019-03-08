# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os
import shutil
from typing import List
from dataclasses import dataclass
from enum import Enum
from selenium import webdriver
from .utils import get_binary_location, get_cli_location
from ..utils.tools import run_command, ensure_directory
from ..bootstrap.main import get_extension_path as get_bootstrap_ext_path


class LaunchPurpose(Enum):
    InstallExtension = 1
    Launch = 2


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


def _get_launch_args(options: Options):
    args: List[str] = []
    args.append(options.workspace_folder)

    return args


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
    with open(os.path.join(options.executable_dir, "smokin.cfg"), "w") as fs:
        fs.write(options.workspace_folder)
    chrome_options = webdriver.ChromeOptions()
    chrome_options.binary_location = get_binary_location(options.executable_dir)
    driver = webdriver.Chrome(options=chrome_options)
    import time
    time.sleep(10)
    return driver


class VSCode(object):
    def __init__(self, driver: webdriver.Chrome):
        self.driver = driver

    @classmethod
    def start(cls, options: Options):
        _setup_environment(options)
        print(options.executable_dir)
        install_extension(options)
        driver = launch_extension(options)
        return cls(driver)

    def exit(self):
        pass

    def reload(self):
        pass

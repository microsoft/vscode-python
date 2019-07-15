# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import contextlib
import glob
import html
import io
import json
import logging
import os
import os.path
import shutil
import stat
import sys
import tempfile
import time
import traceback
from dataclasses import dataclass

import psutil
from selenium import webdriver

import uitests.bootstrap
import uitests.report
import uitests.tools

from . import application, quick_open

CONTEXT = {"driver": None, "options": None}


@dataclass
class Options:
    """Options used to configure tests.
    E.g. version of VSC, where are tests located,
    where are extensions installed. etc.
    Some of these can change during the course of the tests.

    Attrs:
        channel: Are we using stable or insiders version of VSC.
        executable_dir: Directory where VSC executable is located.
        user_dir: Directory where VSC will store user related information (user settings, logs).
        extensions:dir: Directory where VSC extensions are installed.
        extension_path: Path to Python Extension VSIX.
        workspace_folder: Directory opened in VSC (during tests).
        temp_folder: Temp directory.
        screenshots_dir: Directory where screenshots are stored.
        python_path: Path to python executable.
        logfiles_dir: Directory where logs are stored.
        conda_path: Path to conda
        python_extension_dir: Directory where Python Extension is installed.
        reports_dir: Directory where reports are stored.
    """

    channel: str
    executable_dir: str
    user_dir: str
    extensions_dir: str
    extension_path: str
    workspace_folder: str
    temp_folder: str
    screenshots_dir: str
    python_path: str
    logfiles_dir: str
    conda_path: str
    python_extension_dir: str
    reports_dir: str


@dataclass
class Context:
    """Context object available in all parts of the test lifecycle.
    The behave hooks, steps will have access to this objet.

    Attrs:
        options: Instance of options.
        driver: Instance of webdriver.Chrome
    """

    options: application.Options
    driver: webdriver.Chrome


def start(options):
    """Starts VS Code and returns a context object"""
    logging.debug("Starting VS Code")
    uitests.tools.empty_directory(options.workspace_folder)
    setup_user_settings(options)
    return _launch(options)


def get_options(
    destination=".vscode test",
    vsix="ms-python-insiders.vsix",
    channel="stable",
    python_path=sys.executable,
    conda_path="conda",
):
    """Gets the options used for smoke tests."""
    destination = os.path.abspath(destination)
    options = Options(
        channel,
        os.path.join(destination, channel),
        os.path.join(destination, "user"),
        os.path.join(destination, "extensions"),
        vsix,
        os.path.join(destination, "workspace folder"),
        os.path.join(destination, "temp"),
        os.path.join(destination, "screenshots"),
        python_path,
        os.path.join(destination, "logs"),
        conda_path,
        os.path.join(destination, "extensions", "pythonExtension"),
        os.path.join(destination, "reports"),
    )
    os.makedirs(options.extensions_dir, exist_ok=True)
    os.makedirs(options.user_dir, exist_ok=True)
    os.makedirs(options.workspace_folder, exist_ok=True)
    os.makedirs(options.temp_folder, exist_ok=True)
    os.makedirs(options.screenshots_dir, exist_ok=True)
    os.makedirs(options.logfiles_dir, exist_ok=True)
    os.makedirs(options.reports_dir, exist_ok=True)
    return options


def setup_environment(options):
    """Setup environment for smoke tests."""
    # Ensure PTVSD logs are in the reports directory,
    # This way they are available for analyzing.
    os.environ["PTVSD_LOG_DIR"] = options.logfiles_dir
    # Log extension stuff into vsc.log file.
    os.environ["VSC_PYTHON_LOG_FILE"] = os.path.join(options.logfiles_dir, "pvsc.log")


def setup_user_settings(options):
    """Set up user settings for VS Code.
    E.g. we want to ensure VS Code uses a specific version of Python as the default.
    Or we want to ensure VS Code starts maximized, etc.

    """
    settings_to_add = {
        "python.pythonPath": options.python_path,
        # Log everything in LS server, to ensure they are captured in reports.
        # Found under .vscode test/reports/user/logs/xxx/exthostx/output_logging_xxx/x-Python.log
        # These are logs created by VSC.
        # Enabling this makes it difficult to look for text in the panel (there's too much content).
        # "python.analysis.logLevel": "Trace",
        "python.venvFolders": ["envs", ".pyenv", ".direnv", ".local/share/virtualenvs"],
        # Disable pylint (we don't want this message)
        "python.linting.pylintEnabled": False,
        # We dont need these (avoid VSC from displaying prompts).
        "telemetry.enableTelemetry": False,
        "telemetry.enableCrashReporter": False,
        # Start VS Code maximized (good for screenshots and the like).
        # At the same time reduce font size, so we can fit more in statusbar.
        # If there isn't much room, then Line/Column info isn't displayed in statusbar.
        # This could also impact Python Interpreter info, hence reduce font size.
        # Also more realestate (capturing logs, etc).
        # "window.zoomLevel": -1, # Disable, clicking elements doesn't work with selenium.
        "debug.showInStatusBar": "never",  # Save some more room in statusbar.
        "window.newWindowDimensions": "maximized",
        # We don't want VSC to complete the brackets.
        # When sending text to editors, such as json files, VSC will automatically complete brackets.
        # And that messes up with the text thats being sent to the editor.
        "editor.autoClosingBrackets": "never",
    }

    folder = os.path.join(options.user_dir, "User")
    os.makedirs(folder, exist_ok=True)
    settings_file = os.path.join(folder, "settings.json")
    if os.path.exists(settings_file):
        os.remove(settings_file)
    with open(settings_file, "w") as fp:
        json.dump(settings_to_add, fp, indent=4)


def uninstall_extension(options):
    """Uninstalls extensions from smoke tests copy of VSC."""
    shutil.rmtree(options.extensions_dir, ignore_errors=True)


def install_extension(options):
    """Installs extensions into smoke tests copy of VSC."""
    _set_permissions(options)
    uninstall_extension(options)
    bootstrap_extension = uitests.bootstrap.main.get_extension_path()
    _install_extension(options.extensions_dir, "bootstrap", bootstrap_extension)
    _install_extension(
        options.extensions_dir, "pythonExtension", options.extension_path
    )


def clear_logs(options):
    """Clears logs created between tests"""
    uitests.tools.empty_directory(options.logfiles_dir)
    os.makedirs(options.logfiles_dir, exist_ok=True)


def clear_vscode(options):
    # Delete the directories.
    uitests.tools.empty_directory(options.user_dir)
    for folder in glob.glob(
        os.path.join(options.python_extension_dir, "languageServer*")
    ):
        uitests.tools.empty_directory(folder)


def reload(context):
    """Reloads VS Code."""
    logging.debug("Reloading VS Code")
    # Ignore all messages written to console.
    with contextlib.redirect_stdout(io.StringIO()):
        with contextlib.redirect_stderr(io.StringIO()):
            application.exit(context)
            app_context = _launch(context.options)
    context.driver = app_context.driver
    CONTEXT["driver"] = context.driver
    return app_context


def clear_everything(context):
    """Clears everything within VS Code, that could interfer with tests.
    E.g. close opened editors, dismiss all messages..

    """
    commands = [
        "View: Revert and Close Editor",
        "Terminal: Kill the Active Terminal Instance",
        "Debug: Remove All Breakpoints",
        "File: Clear Recently Opened",
        "Clear Editor History",
        "Clear Command History",
        "View: Close All Editors",
        "View: Close Panel",
        "Notifications: Clear All Notifications",
    ]
    for command in commands:
        quick_open.select_command(context, command)


def setup_workspace(context, source_repo=None):
    """Set the workspace for a feature/scenario.
    source_repo is either the github url of the repo to be used as the workspace folder.
    Or it is None.

    """
    logging.debug(f"Setting up workspace folder from {source_repo}")

    # On windows, create a new folder every time.
    # Deleting/reverting changes doesn't work too well.
    # We get a number of access denied errors (files are in use).
    try:
        uitests.tools.empty_directory(context.options.temp_folder)
    except (PermissionError, FileNotFoundError, OSError):
        pass
    try:
        uitests.tools.empty_directory(context.options.workspace_folder)
    except (PermissionError, FileNotFoundError, OSError):
        pass
    workspace_folder_name = os.path.basename(
        tempfile.NamedTemporaryFile(prefix="workspace folder ").name
    )
    context.options.workspace_folder = os.path.join(
        context.options.temp_folder, workspace_folder_name
    )
    os.makedirs(context.options.workspace_folder, exist_ok=True)

    if source_repo is None:
        return

    # Just delete the files in current workspace.
    uitests.tools.empty_directory(context.options.workspace_folder)
    target = context.options.workspace_folder
    repo_url = _get_repo_url(source_repo)
    uitests.tools.run_command(["git", "clone", repo_url, "."], cwd=target, silent=True)

    # Its possible source_repo is https://github.com/Microsoft/vscode-python/tree/master/build
    # Meaning, we want to glon https://github.com/Microsoft/vscode-python
    # and want the workspace folder to be tree/master/build when cloned.
    if len(source_repo) > len(repo_url):
        # Exclude trailing `.git` and take everything after.
        sub_directory = source_repo[len(repo_url[:-4]) + 1 :]
        context.options.workspace_folder = os.path.join(
            context.options.workspace_folder, os.path.sep.join(sub_directory.split("/"))
        )


def launch_vscode(options):
    """Launches the smoke tests copy of VSC."""
    chrome_options = webdriver.ChromeOptions()
    # Remember to remove the leading `--`.
    # Chromedriver will add `--` for ALL arguments.
    # I.e. arguments without a leading `--` are not supported.
    for arg in [
        f"user-data-dir={options.user_dir}",
        f"extensions-dir={options.extensions_dir}",
        f"folder-uri=file:{options.workspace_folder}",
        "skip-getting-started",
        "skip-release-notes",
        "sticky-quickopen",
        "disable-telemetry",
        "disable-updates",
        "disable-crash-reporter",
        # TODO: No sure whether these are required
        # Was trying to get VSC Insiders working
        "no-sandbox",
        "--no-sandbox",
        # "no-first-run",
        # "--no-first-run",
        "--disable-dev-shm-usage",
        "disable-dev-shm-usage",
        "--disable-setuid-sandbox",
        "disable-setuid-sandbox",
    ]:
        chrome_options.add_argument(arg)

    chrome_options.binary_location = _get_binary_location(
        options.executable_dir, options.channel
    )

    chrome_driver_path = os.path.join(options.executable_dir, "chromedriver")

    # TODO: No sure whether chrome_options is required
    driver = webdriver.Chrome(
        options=chrome_options,
        chrome_options=chrome_options,
        executable_path=chrome_driver_path,
    )
    return driver


def exit(context):
    """Exits VS Code"""
    # Ignore all messages written to console.
    with contextlib.redirect_stdout(io.StringIO()):
        with contextlib.redirect_stderr(io.StringIO()):
            pid = 0
            try:
                pid = context.driver.service.process.id
            except Exception:
                pass
            try:
                context.driver.close()
            except Exception:
                pass
            try:
                context.driver.quit()
            except Exception:
                pass
            try:
                if pid != 0:
                    psutil.Process(pid).terminate()
            except Exception:
                pass
            try:
                # Clear reference.
                context.driver = None
            except Exception:
                pass


def capture_screen(context):
    """Capture screenshots and attach to the report.
    Also save to screenshots directory.

    """
    # So its easy to tell the order of screenshots taken.
    counter = getattr(context, "screenshot_counter", 1)
    context.screenshot_counter = counter + 1

    screenshot = context.driver.get_screenshot_as_base64()
    uitests.report.PrettyCucumberJSONFormatter.instance.attach_image(screenshot)

    capture_screen_to_file(context)
    # # Also save for logging purposes (easier to look at images).
    # filename = tempfile.NamedTemporaryFile(prefix=f"screen_capture_{counter}_")
    # filename = f"{os.path.basename(filename.name)}.png"
    # filename = os.path.join(context.options.screenshots_dir, filename)
    # context.driver.save_screenshot(filename)
    # relative_path = os.path.relpath(filename, context.options.reports_dir)
    # html_content = f'<a href="{relative_path}" target="_blank">More screen shots</a>'

    # uitests.report.PrettyCucumberJSONFormatter.instance.attach_html(html_content)


def capture_exception(context, info):
    """Capture exception infor and attach to the report."""
    formatted_ex = "<br>".join(
        map(
            html.escape,
            traceback.format_exception(
                type(info.exception), info.exception, info.exc_traceback
            ),
        )
    )
    uitests.report.PrettyCucumberJSONFormatter.instance.attach_html(formatted_ex)


def capture_screen_to_file(context, file_path=None, prefix=""):
    """Capture screenshots to a file"""
    if file_path is None:
        with tempfile.NamedTemporaryFile(prefix=f"{prefix}screen_capture_") as fp:
            filename = f"{os.path.basename(fp.name)}.png"
        filename = os.path.join(context.options.screenshots_dir, filename)
    else:
        filename = file_path

    context.driver.save_screenshot(filename)
    return filename


def _set_permissions(options):
    """Set necessary permissions on Linux to be able to start VSC.
    Else selenium throws errors.
    & so does VSC, when accessing vscode-ripgrep/bin/rg.

    """
    if sys.platform.startswith("linux"):
        binary_location = _get_binary_location(options.executable_dir, options.channel)
        file_stat = os.stat(binary_location)
        os.chmod(binary_location, file_stat.st_mode | stat.S_IEXEC)

        rg_path = os.path.join(
            os.path.dirname(binary_location),
            "resources",
            "app",
            "node_modules.asar.unpacked",
            "vscode-ripgrep",
            "bin",
            "rg",
        )
        file_stat = os.stat(rg_path)
        os.chmod(rg_path, file_stat.st_mode | stat.S_IEXEC)


def _install_extension(extensions_dir, extension_name, vsix):
    """Installs an extensions into smoke tests copy of VSC."""
    temp_dir = os.path.join(tempfile.gettempdir(), extension_name)
    uitests.tools.unzip_file(vsix, temp_dir)
    shutil.copytree(
        os.path.join(temp_dir, "extension"),
        os.path.join(extensions_dir, extension_name),
    )
    shutil.rmtree(temp_dir, ignore_errors=True)


def _get_binary_location(executable_directory, channel):
    """Returns the path to the VSC executable"""
    if sys.platform.startswith("darwin"):
        return os.path.join(
            executable_directory,
            "Visual Studio Code.app"
            if channel == "stable"
            else "Visual Studio Code - Insiders.app",
            "Contents",
            "MacOS",
            "Electron",
        )

    if sys.platform.startswith("win"):
        return os.path.join(
            executable_directory,
            "Code.exe" if channel == "stable" else "Code - Insiders.exe",
        )

    return os.path.join(
        executable_directory,
        "VSCode-linux-x64",
        "code" if channel == "stable" else "code-insiders",
    )


def _launch(options):
    app_context = _start_vscode(options)
    CONTEXT["driver"] = app_context.driver
    if CONTEXT["options"] is None:
        CONTEXT["options"] = options
    return app_context


def _start_vscode(options):
    application.setup_environment(options)
    driver = application.launch_vscode(options)
    context = Context(options, driver)
    # Wait for VSC to startup.
    time.sleep(2)
    return context


def _get_cli_location(executable_directory):
    if sys.platform.startswith("darwin"):
        return os.path.join(
            executable_directory,
            "Visual Studio Code.app",
            "Contents",
            "Resources",
            "app",
            "out",
            "cli.js",
        )

    if sys.platform.startswith("win"):
        return os.path.join(executable_directory, "resources", "app", "out", "cli.js")

    return os.path.join(
        executable_directory, "VSCode-linux-x64", "resources", "app", "out", "cli.js"
    )


def _get_repo_url(source_repo):
    """Will return the repo url ignoring any sub directories."""

    repo_parts = source_repo[len("https://github.com/") :].split("/")
    repo_name = (
        repo_parts[1] if repo_parts[1].endswith(".git") else f"{repo_parts[1]}.git"
    )
    return f"https://github.com/{repo_parts[0]}/{repo_name}"

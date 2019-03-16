# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import os
import os.path
import re
import shutil
import sys
import tempfile

import requests

from tasks.smoketests import tools


def _get_download_platform():
    platform = sys.platform
    if platform.startswith('linux'):
        return "linux-x64"
    if platform.startswith('darwin'):
        return "darwin"
    if platform.startswith('win'):
        return "win32-archive"


def _get_latest_version(channel="stable"):
    """Get the latest version of VS Code
    The channel defines the channel for VSC (stable or insiders)."""

    download_platform = _get_download_platform()
    url = f"https://update.code.visualstudio.com/api/releases/{channel}/{download_platform}"  # noqa
    versions = requests.get(url)
    return versions.json()[0]


def _get_download_url(
    version: str, download_platform: str, channel: str = "stable"
) -> str:
    """Get the download url for vs code."""
    return f"https://vscode-update.azurewebsites.net/{version}/{download_platform}/{channel}"  # noqa


def _get_electron_version(channel: str = "stable"):
    if channel == "stable":
        version = _get_latest_version()
        # Assume that VSC tags based on major and minor numbers.
        # E.g. 1.32 and not 1.32.1
        version_parts = version.split(".")
        tag = f"{version_parts[0]}.{version_parts[1]}"
        url = (
            f"https://raw.githubusercontent.com/Microsoft/vscode/release/{tag}/.yarnrc" # noqa
        )
    else:
        url = "https://raw.githubusercontent.com/Microsoft/vscode/master/.yarnrc" # noqa

    response = requests.get(url)
    matches = re.finditer(r'target\s"(\d+.\d+.\d+)"', response.text, re.MULTILINE)
    for _, match in enumerate(matches, start=1):
        return match.groups()[0]


def download_chrome_driver(download_path: str, channel: str = "stable"):
    """Download chrome driver corresponding to the version of electron.
    Basically check version of chrome released with the version of Electron."""

    download_path = os.path.abspath(download_path)
    os.makedirs(download_path, exist_ok=True)
    electron_version = _get_electron_version(channel)
    dir = os.path.dirname(os.path.realpath(__file__))
    js_file = os.path.join(dir, "chromeDownloader.js")
    # Use an exising npm package.
    tools.run_command(
        ["node", js_file, electron_version, download_path],
        progress_message="Downloading chrome driver",
    )


def download_vscode(download_path: str, channel: str = "stable"):
    """Download VS Code"""

    download_path = os.path.abspath(download_path)
    shutil.rmtree(download_path, ignore_errors=True)
    os.makedirs(download_path, exist_ok=True)

    download_platform = _get_download_platform()
    version = _get_latest_version(channel)
    url = _get_download_url(version, download_platform, channel)

    zip_file = os.path.join(tempfile.mkdtemp(), "vscode.zip")
    tools.download_file(url, zip_file, f"Downloading VS Code {channel}")
    tools.unzip_file(zip_file, download_path)

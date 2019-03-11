# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os.path
from invoke import task
from .vscode.application import get_options, install_extension
from .vscode.download import download_chrome_driver as download_chrome_drv
from .vscode.download import download_vscode
from .bootstrap.main import build_extension
from .main import start_smoketests


@task(name="download")
def download_all(ctx, destination=".vscode-smoke", channel="stable"):
    """Downloads VS Code (stable/insiders) and chrome driver.

    The channel defines the channel for VSC (stable or insiders).
    """
    destination = os.path.join(destination, "vscode")
    download_vscode(destination, channel)
    download_chrome_drv(destination, channel)


@task(name="download_vsc")
def download_vsc(ctx, destination=".vscode-smoke", channel="stable"):
    """Downloads VS Code (stable/insiders)."""

    destination = os.path.join(destination, "vscode")
    download_vscode(destination, channel)


@task(name="download_chrome_driver")
def download_chrome_driver(ctx, destination=".vscode-smoke", channel="stable"):
    """Downloads the Chrome Driver."""

    destination = os.path.join(destination, "vscode")
    download_chrome_drv(destination, channel)


@task(name="install_extension")
def install_ext(ctx, destination=".vscode-smoke", vsix="ms-python-insiders.vsix"):

    vsix = os.path.abspath(vsix)
    options = get_options(destination, vsix)
    install_extension(options)


@task(name="smoke")
def smoke(
    ctx, destination=".vscode-smoke", channel="stable", vsix="ms-python-insiders.vsix"
):
    """Starts the smoke tests"""

    start_smoketests(destination, channel, vsix)

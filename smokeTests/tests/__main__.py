# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


"""PVSC Smoke Tests.

Usage:
  smokeTest download [--destination=PATH] [--channel=CHANNEL]
  smokeTest install [--destination=PATH] [--vsix=VSIX] [--channel=CHANNEL]
  smokeTest launch [--destination=PATH] [--vsix=VSIX] [--channel=CHANNEL]
  smokeTest test [--embed-screenshots] [--out=OUTPUT] [--destination=PATH] [--vsix=VSIX] [--channel=CHANNEL] [--] [<behave-options> ...]
  smokeTest (-h | --help)

Options:
  -h --help             Show this screen.
  --version             Show version.
  --destination=PATH    Path for smoke tests [default: .vscode-test].
  --channel=CHANNEL     Defines the channel for VSC (stable or insiders) [default: stable].
  --vsix=VSIX           Path to VSIX [default: ms-python-insiders.vsix].
  --out=OUTPUT          Output for results (console or file) [default: file].
  --embed-screenshots   Whether to embed screenshots (applicable only when using --out=file).

"""
import os
import os.path
import sys
import time

from behave import __main__
from docopt import docopt

from . import vscode


def download(destination, channel, **kwargs):
    """Download VS Code (stable/insiders) and chrome driver.

    The channel defines the channel for VSC (stable or insiders).
    """
    destination = os.path.join(destination, channel)
    vscode.download.download_vscode(destination, channel)
    vscode.download.download_chrome_driver(destination, channel)


def install(destination, channel, vsix, **kwargs):
    """Installs the Python Extension into VS Code in preparation for the smoke tests"""
    vsix = os.path.abspath(vsix)
    options = vscode.application.get_options(destination, vsix, channel)
    vscode.application.install_extension(options)


def launch(destination, channel, vsix, timeout=30, **kwargs):
    """Launches VS Code (the same instance used for smoke tests)"""
    vsix = os.path.abspath(vsix)
    options = vscode.application.get_options(destination, vsix, channel)
    vscode.setup.start(options)
    time.sleep(30)


def test(
    out, destination, channel, vsix, behave_options, embed_screenshots=False, **kwargs
):
    """Start the smoke tests"""
    destination = os.path.abspath(destination)
    print("destination")
    print(destination)
    vsix = os.path.abspath(vsix)
    report_args = [
        "-f",
        "tests.report:PrettyCucumberJSONFormatter",
        "-o",
        os.path.join(destination, "reports", "report.json"),
        "--define",
        f"embed_screenshots={embed_screenshots}",
    ]
    stdout_args = [
        "--format",
        "plain",
        "-no-timings",
        "--no-capture",
        "--define",
        f"embed_screenshots=False",
    ]
    args = report_args if out == "file" else stdout_args
    args = (
        args
        + [
            "--define",
            f"destination={destination}",
            "--define",
            f"channel={channel}",
            "--define",
            f"vsix={vsix}",
            "--define",
            f"output={out}",
            os.path.abspath("smokeTests/tests"),
        ]
        + behave_options
    )
    import sys

    # import os
    import pathlib

    print(os.getcwd())
    os.chdir(pathlib.Path(__file__).parent)
    print(os.getcwd())
    print('args')
    print(args)
    __main__.main(args)


if __name__ == "__main__":
    arguments = docopt(__doc__, version="1.0")
    behave_options = arguments.get("<behave-options>")
    options = {
        key[2:]: value for (key, value) in arguments.items() if key.startswith("--")
    }
    options.setdefault("behave_options", behave_options)
    if arguments.get("download"):
        download(**options)
    if arguments.get("install"):
        install(**options)
    if arguments.get("test"):
        test(**options)

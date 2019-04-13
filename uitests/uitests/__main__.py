# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


"""PVSC Smoke Tests.

Usage:
  uitests download [options]
  uitests install [options]
  uitests launch [options]
  uitests test [options] [--] [<behave-options> ...]
  uitests report [options]
  uitests (-h | --help)

Options:
  -h --help                     Show this screen.
  -D, --destination=PATH        Path for smoke tests [default: .vscode-test].
  -C, --channel=CHANNEL         Defines the channel for VSC (stable or insiders) [default: stable].
  --vsix=VSIX                   Path to VSIX [default: ms-python-insiders.vsix].
  -O, --out=OUTPUT              Output for test results (console or file) [default: file].
  --embed-screenshots           Whether to embed screenshots (applicable only when using --out=file).
  -L, --log=LEVEL               Log Level [default: INFO].
  --config=PATH                 Path to the config file [default: uitests/uitests/config.json]
  --show                        Whether to display the report or not.
  -T, --timeout=TIMEOUT         Timeout for closing instance of VSC when Launched to validate instance of VSC [default: 30]

"""
import glob
import json
import logging
import os
import os.path
import pathlib
import sys
import time

from behave import __main__
from docopt import docopt
from junitparser import JUnitXml

from . import tools, vscode


def download(destination, channel, **kwargs):
    """Download VS Code (stable/insiders) and chrome driver.

    The channel defines the channel for VSC (stable or insiders).
    """
    destination = os.path.abspath(destination)
    destination = os.path.join(destination, channel)
    vscode.download.download_vscode(destination, channel)
    vscode.download.download_chrome_driver(destination, channel)


def install(destination, channel, vsix, **kwargs):
    """Installs the Python Extension into VS Code in preparation for the smoke tests."""
    destination = os.path.abspath(destination)
    vsix = os.path.abspath(vsix)
    options = vscode.application.get_options(destination, vsix=vsix, channel=channel)
    vscode.application.install_extension(options)

    # Launch extension and exit (we want to ensure folders are created & extensions work).
    context = vscode.startup.start(options)
    vscode.application.exit(context)


def launch(destination, channel, vsix, timeout=30, **kwargs):
    """Launches VS Code (the same instance used for smoke tests)."""
    destination = os.path.abspath(destination)
    vsix = os.path.abspath(vsix)
    options = vscode.application.get_options(destination, vsix=vsix, channel=channel)
    logging.info(f"Launched VSC will exit in {timeout}s")
    vscode.startup.start(options)
    time.sleep(int(timeout))


def report(destination, show=False, **kwargs):
    """Generates an HTML report and displays it."""
    _update_junit_report(destination, **kwargs)
    destination = os.path.abspath(destination)
    report_dir = os.path.join(destination, "reports")
    tools.run_command(
        [
            "node",
            os.path.join("uitests", "uitests", "js", "report.js"),
            report_dir,
            str(show),
        ]
    )


def _update_junit_report(destination, **kwargs):
    """Updates the junit reports to contain the names of the current Azdo Job."""
    destination = os.path.abspath(destination)
    report_dir = os.path.join(destination, "reports")
    report_name = os.getenv("AgentJobName", "")
    for name in glob.glob(os.path.join(report_dir, "*.xml")):
        xml = JUnitXml.fromfile(name)
        xml.name = f"({report_name}): {xml.name}"
        for suite in xml:
            suite.classname = f"({report_name}): {suite.classname}"
        xml.write()


def test(
    out, destination, channel, vsix, behave_options, embed_screenshots=False, **kwargs
):
    """Start the smoke tests."""
    destination = os.path.abspath(destination)
    vsix = os.path.abspath(vsix)
    report_args = [
        "-f",
        "uitests.report:PrettyCucumberJSONFormatter",
        "-o",
        os.path.join(destination, "reports", "report.json"),
        "--junit",
        "--junit-directory",
        os.path.join(destination, "reports"),
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
            os.path.abspath("uitests/uitests"),
        ]
        + behave_options
    )

    # Change directory for behave to work correctly.
    os.chdir(pathlib.Path(__file__).parent)
    return __main__.main(args)


def main():
    arguments = docopt(__doc__, version="1.0")
    with open(os.path.abspath(arguments.get("--config")), "r") as file:
        config_options = json.load(file)
    behave_options = arguments.get("<behave-options>")
    arguments = dict(
        (str(key), arguments.get(key) or config_options.get(key))
        for key in set(config_options) | set(arguments)
    )
    options = {
        key[2:]: value for (key, value) in arguments.items() if key.startswith("--")
    }
    log = arguments.get("--log")
    log_level = getattr(logging, log.upper())
    if log_level == logging.INFO:
        logging.basicConfig(level=log_level, format="%(message)s")
    else:
        logging.basicConfig(level=log_level)
    options.setdefault("behave_options", behave_options)
    handler = lambda **kwargs: 0  # noqa
    if arguments.get("download"):
        handler = download
    if arguments.get("install"):
        handler = install
    if arguments.get("launch"):
        handler = launch
    if arguments.get("test"):
        handler = test
    if arguments.get("report"):
        handler = report
    return handler(**options)


if __name__ == "__main__":
    sys.exit(main())

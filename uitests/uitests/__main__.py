# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


"""PVSC Smoke Tests.

Usage:
  uitests download [--channel=<stable_or_insider>] [--destination=<path>]
  uitests install [--channel=<stable_or_insider>] [--destination=<path>]
  uitests launch [--channel=<stable_or_insider>] [--destination=<path>] [--timeout=<seconds>] [--vsix=<vsix>]
  uitests test [--channel=<stable_or_insider>] [--destination=<path>] [--timeout=<seconds>] [--vsix=<vsix>] [--] [<behave-options> ...]
  uitests report [--destination=<path>] [--show]
  uitests behave -- [<behave-options> ...]

Options:
  -h --help                         Show this screen.
  --channel=<stable_or_insider>     Defines the channel for VSC (stable or insider) [default: stable].
  --destination=<path>              Path for smoke tests [default: .vscode test].
  --vsix=VSIX                       Path to VSIX [default: ms-python-insiders.vsix].
  --timeout=TIMEOUT                 Timeout for closing instance of VSC when Launched to validate instance of VSC [default: 30]
  --show                            Whether to display the report or not.
  --log=LEVEL                       Log Level [default: INFO].

 Commands:
  download                          Downloads chromedriver and VS Code (stable/insider based on --channel)
                                    E.g. `python uitests download`, `python uitests download --channel=insider`
  install                           Installs the extensions in VS Code.
                                    E.g. `python uitests install`, `python uitests install --channel=insider --vsix=hello.vsix`
  launch                            Launches VS Code (stable/insider based on --channel) with a default timeout of 30s.
                                    Used for development purposes (e.g. check if VS loads, etc).
                                    E.g. `python uitests launch`, `python uitests launch --channel=insider --timeout=60`
                                    E.g. `python uitests install`, `python uitests install --channel=insider --vsix=hello.vsix`
  test                              Launches the BDD tests using behave
                                    E.g. `python uitests test`, `python uitests test --channel=insider -- --custom-behave=arguments --tags=@wip`
  report                            Generates the BDD test reports (html report)
                                    E.g. `python uitests report`, `python uitests report --show`
  behave                            Run behave manually passing in the arguments after `--`
                                    Used for development purposes.
                                    E.g. `python uitests behave --- --dry-run`

"""
import glob
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
    vscode.application.setup_environment(options)
    driver = vscode.application.launch_vscode(options)
    context = vscode.application.Context(options, driver)
    vscode.application.exit(context)


def launch(destination, channel, vsix, timeout=30, **kwargs):
    """Launches VS Code (the same instance used for smoke tests)."""
    destination = os.path.abspath(destination)
    vsix = os.path.abspath(vsix)
    options = vscode.application.get_options(destination, vsix=vsix, channel=channel)
    logging.info(f"Launched VSC ({channel}) will exit in {timeout}s")
    context = vscode.application.start(options)
    logging.info(f"Activating Python Extension (assuming it is installed")
    vscode.extension.activate_python_extension(context)
    time.sleep(int(timeout))
    vscode.application.exit(context)


def report(destination, show=False, **kwargs):
    """Generates an HTML report and optionally displays it."""
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


def test(destination, channel, vsix, behave_options, **kwargs):
    """Start the bdd tests."""
    destination = os.path.abspath(destination)

    vsix = os.path.abspath(vsix)
    args = (
        [
            "-f",
            "uitests.report:PrettyCucumberJSONFormatter",
            "-o",
            os.path.join(destination, "reports", "report.json"),
            "--junit",
            "--junit-directory",
            os.path.join(destination, "reports"),
        ]
        + [
            "--define",
            f"destination={destination}",
            "--define",
            f"channel={channel}",
            "--define",
            f"vsix={vsix}",
            os.path.abspath("uitests/uitests"),
        ]
        # Custom arguments provided via command line or on CI.
        + behave_options
    )

    # Change directory for behave to work correctly.
    curdir = os.path.dirname(os.path.realpath(__file__))
    os.chdir(pathlib.Path(__file__).parent)

    # Selenium and other packages write to stderr & so does default logging output.
    # Confused how this can be configured with behave and other libs.
    # Hence just capture exit code from behave and throw error to signal failure to CI.
    exit_code = __main__.main(args)
    # Write exit code to a text file, so we can read it and fail CI in a separate task (fail if file exists).
    # CI doesn't seem to fail based on exit codes.
    # We can't fail on writing to stderr either as python logs stuff there & other errors that can be ignored are written there.
    failure_file = os.path.join(curdir, "uitest_failed.txt")

    if exit_code > 0:
        with open(failure_file, "w") as fp:
            fp.write(str(exit_code))
        sys.stderr.write("Behave tests failed")
        sys.stderr.flush()
    else:
        try:
            os.unlink(failure_file)
        except Exception:
            pass
    return exit_code


def run_behave(destination, *args):
    """Start the smoke tests."""
    destination = os.path.abspath(destination)

    # Change directory for behave to work correctly.
    os.chdir(pathlib.Path(__file__).parent)

    return __main__.main([*args])


def main():
    arguments = docopt(__doc__, version="1.0")
    behave_options = arguments.get("<behave-options>")
    options = {
        **{
            key[2:]: value for (key, value) in arguments.items() if key.startswith("--")
        },
        **{
            key: value for (key, value) in arguments.items() if not key.startswith("--")
        },
    }
    log = arguments.get("--log", "INFO")
    log_level = getattr(logging, log.upper())

    if log_level == logging.INFO:
        logging.basicConfig(
            level=log_level, format="%(asctime)s %(message)s", stream=sys.stdout
        )
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
    if arguments.get("behave"):
        options = behave_options
        return run_behave(arguments.get("--destination"), *behave_options)
    return handler(**options)


if __name__ == "__main__":
    sys.exit(main())

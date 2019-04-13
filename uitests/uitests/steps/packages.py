# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import behave
import uitests.tools


@behave.given('the package "{name}" is not installed')
def given_no_package(context, name):
    _uninstall_module(context, name)


@behave.when('I uninstall the package "{name}"')
def when_no_package(context, name):
    _uninstall_module(context, name)


@behave.then('uninstall the package "{name}"')
def then_no_package(context, name):
    _uninstall_module(context, name)


@behave.given('the package "{name}" is installed')
def given_package_installed(context, name):
    _install_module(context, name)


@behave.when('I install the package "{name}"')
def when_package_installed(context, name):
    _install_module(context, name)


@behave.then('install the package "{name}"')
def then_package_installed(context, name):
    _install_module(context, name)


def _uninstall_module(context, name):
    python_path = context.options.python_path
    try:
        uitests.tools.run_command(
            [python_path, "-m", "pip", "uninstall", name, "-y", "-q"], silent=True
        )
    except Exception:
        pass


def _install_module(context, name):
    python_path = context.options.python_path
    try:
        uitests.tools.run_command(
            [python_path, "-m", "pip", "install", name, "-q"], silent=True
        )
    except Exception:
        pass

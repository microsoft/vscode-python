# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See LICENSE in the project root
# for license information.

# TODO: not needed?
from __future__ import print_function, with_statement, absolute_import


__author__ = "Microsoft Corporation <ptvshelp@microsoft.com>"
__version__ = "4.0.0a5"


def reraise(exc_info):
    # TODO: docstring
    raise exc_info[0], exc_info[1], exc_info[2]  # noqa

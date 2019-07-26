# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import platform


def get_folder_tag():
    """Get the PTVSD folder tag for the current Python interpreter (format is <os>-<arch>)."""

    def get_architecture(system):
        """Detect the bitness of the current Python interpreter."""
        if system == "Darwin":
            return 64
        else:
            architecture = platform.architecture()[0]
            return architecture[:2]

    system = platform.system()
    if system == "Darwin":
        folder_name = "mac"
    elif system == "Windows":
        folder_name = "win"
    else:
        folder_name = "linux"
    return f"{folder_name}-{get_architecture(system)}"

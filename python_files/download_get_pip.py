# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import json
import os
import pathlib
import urllib.request as url_lib
from packaging.version import parse as version_parser

EXTENSION_ROOT = pathlib.Path(__file__).parent.parent
GET_PIP_DEST = EXTENSION_ROOT / "python_files"
PIP_PACKAGE = "pip"
PIP_VERSION = "latest"  # Can be "latest", or specific version "23.1.2"


def _get_package_data():
    json_uri = "https://pypi.org/pypi/{0}/json".format(PIP_PACKAGE)
    # Response format: https://warehouse.readthedocs.io/api-reference/json/#project
    # Release metadata format: https://github.com/pypa/interoperability-peps/blob/master/pep-0426-core-metadata.rst
    with url_lib.urlopen(json_uri) as response:
        return json.loads(response.read())


def _download_and_save(root, version):
    root = os.getcwd() if root is None or root == "." else root
    url = f"https://raw.githubusercontent.com/pypa/get-pip/{version}/public/get-pip.py"
    print(url)
    with url_lib.urlopen(url) as response:
        data = response.read()
        get_pip_file = pathlib.Path(root) / "get-pip.py"
        get_pip_file.write_bytes(data)


def main(root):
    data = _get_package_data()

    if PIP_VERSION == "latest":
        use_version = max(data["releases"].keys(), key=version_parser)
    else:
        use_version = PIP_VERSION

    _download_and_save(root, use_version)


if __name__ == "__main__":
    main(GET_PIP_DEST)

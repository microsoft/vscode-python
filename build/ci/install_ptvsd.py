from os import path
import sys

ROOT_DIRNAME = path.dirname(path.dirname(path.dirname(path.abspath(__file__))))
PYTHONFILES_PATH = path.join(ROOT_DIRNAME, "pythonFiles", "lib", "python")

sys.path.insert(0, PYTHONFILES_PATH)

from io import BytesIO
from packaging.requirements import Requirement
from packaging.version import Version

import json
import urllib.request
import zipfile

REQUIREMENTS_PATH = path.join(ROOT_DIRNAME, "requirements.txt")
PYPI_PTVSD_URL = "https://pypi.org/pypi/ptvsd/json"


def get_ptvsd_version():
    print("get ptvsd version from requirements.txt")
    with open(REQUIREMENTS_PATH, "r", encoding="utf-8") as requirements:
        minimum_version = Version("5")

        for line in requirements:
            req = Requirement(line)
            if req.name == "ptvsd" and req.specifier.contains(minimum_version):
                for spec in req.specifier:
                    if spec.contains(minimum_version):
                        return spec.version

        return "latest"


def download_ptvsd(ptvsd_version):
    print("download and extract ptvsd wheels")
    with urllib.request.urlopen(PYPI_PTVSD_URL) as response:
        json_response = json.loads(response.read())
        releases = json_response["releases"]
        releases_keys = list(releases)

        if ptvsd_version == "latest":
            ptvsd_version = releases_keys[-1]

        for wheel_info in releases[ptvsd_version]:
            # download only if it's a 3.7 wheel (don't download the source code)
            if wheel_info["filename"].endswith(".whl") and wheel_info[
                "python_version"
            ].endswith("37"):
                filename = wheel_info["filename"][:-4]

                with urllib.request.urlopen(wheel_info["url"]) as wheel_response:
                    wheel_file = BytesIO(wheel_response.read())
                    with zipfile.ZipFile(wheel_file, "r") as wheel:
                        wheel.extractall(path.join(PYTHONFILES_PATH, filename))


if __name__ == "__main__":
    ptvsd_version = get_ptvsd_version()
    download_ptvsd(ptvsd_version)

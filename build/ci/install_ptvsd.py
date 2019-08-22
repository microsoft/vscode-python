from io import BytesIO
from os import path
from zipfile import ZipFile
import json
import urllib.request

ROOT_DIRNAME = path.dirname(path.dirname(path.dirname(path.abspath(__file__))))
PYTHONFILES_PATH = path.join(ROOT_DIRNAME, "pythonFiles", "lib", "python")

PYPI_PTVSD_URL = "https://pypi.org/pypi/ptvsd/json"

if __name__ == "__main__":
    ptvsd_version = "latest"

    with urllib.request.urlopen(PYPI_PTVSD_URL) as response:
        json_response = json.loads(response.read())
        releases = json_response["releases"]

        # Remove these lines when the version of PTVSD in requirements.txt gets updated
        # (and add code to parse requirements.txt).
        releases_keys = list(releases)
        ptvsd_version = releases_keys[-1]

        for wheel_info in releases[ptvsd_version]:
            # Download only if it's a 3.7 wheel (aka don't download the source code).
            if wheel_info["filename"].endswith(".whl") and wheel_info[
                "python_version"
            ].endswith("37"):
                filename = wheel_info["filename"][:-4]

                with urllib.request.urlopen(wheel_info["url"]) as wheel_response:
                    wheel_file = BytesIO(wheel_response.read())
                    with ZipFile(wheel_file, "r") as wheel:
                        wheel.extractall(path.join(PYTHONFILES_PATH, filename))

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

    # Response format: https://warehouse.readthedocs.io/api-reference/json/#project
    with urllib.request.urlopen(PYPI_PTVSD_URL) as response:
        json_response = json.loads(response.read())
    releases = json_response["releases"]

    # Remove this when the version of PTVSD in requirements.txt gets updated.
    # (and add code leveraging the packaging module to parse requirements.txt) in #7002
    ptvsd_version = "5.0.0a3"

    # Release metadata format: https://github.com/pypa/interoperability-peps/blob/master/pep-0426-core-metadata.rst
    for wheel_info in releases[ptvsd_version]:
        # Download only if it's a 3.7 wheel.
        if not wheel_info["python_version"].endswith(("37", "3.7")):
            continue
        filename = wheel_info["filename"].rpartition(".")[0]  # Trim the file extension
        ptvsd_path = path.join(PYTHONFILES_PATH, filename)

        with urllib.request.urlopen(wheel_info["url"]) as wheel_response:
            wheel_file = BytesIO(wheel_response.read())
        # Extract only the contents of the ptvsd subfolder.
        prefix = path.join(f"ptvsd-{ptvsd_version}.data", "purelib", "ptvsd")

        with ZipFile(wheel_file, "r") as wheel:
            for zip_info in wheel.infolist():
                if not zip_info.filename.startswith(prefix):
                    continue
                # Flatten the folder structure.
                zip_info.filename = zip_info.filename.split(prefix)[-1]
                wheel.extract(zip_info, ptvsd_path)

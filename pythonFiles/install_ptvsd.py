from io import BytesIO
from os import path
from zipfile import ZipFile
import json
import urllib.request
import sys

ROOT = path.dirname(path.dirname(path.abspath(__file__)))
REQUIREMENTS = path.join(ROOT, "requirements.txt")
PYTHONFILES = path.join(ROOT, "pythonFiles", "lib", "python")
PYPI_PTVSD_URL = "https://pypi.org/pypi/ptvsd/json"


def install_ptvsd():
    # If we are in CI use the packaging module installed in PYTHONFILES.
    if len(sys.argv) == 2 and sys.argv[1] == "--ci":
        sys.path.insert(0, PYTHONFILES)
    from packaging.requirements import Requirement

    with open(REQUIREMENTS, "r", encoding="utf-8") as reqsfile:
        for line in reqsfile:
            pkgreq = Requirement(line)
            if pkgreq.name == "ptvsd":
                specs = pkgreq.specifier
                version = next(iter(specs)).version
                break

    try:
        version
    except NameError:
        raise Exception("ptvsd requirement not found.")

    # Response format: https://warehouse.readthedocs.io/api-reference/json/#project
    with urllib.request.urlopen(PYPI_PTVSD_URL) as response:
        json_response = json.loads(response.read())
    releases = json_response["releases"]

    # Release metadata format: https://github.com/pypa/interoperability-peps/blob/master/pep-0426-core-metadata.rst
    for wheel_info in releases[version]:
        # Download only if it's a 3.7 wheel.
        if not wheel_info["python_version"].endswith(("37", "3.7")):
            continue
        filename = wheel_info["filename"].rpartition(".")[0]  # Trim the file extension.
        ptvsd_path = path.join(PYTHONFILES, filename)

        with urllib.request.urlopen(wheel_info["url"]) as wheel_response:
            wheel_file = BytesIO(wheel_response.read())
        # Extract only the contents of the purelib subfolder (parent folder of ptvsd),
        # since ptvsd files rely on the presence of a 'ptvsd' folder.
        prefix = path.join(f"ptvsd-{version}.data", "purelib")

        with ZipFile(wheel_file, "r") as wheel:
            for zip_info in wheel.infolist():
                # Normalize path for Windows, the wheel folder structure uses forward slashes.
                normalized = path.normpath(zip_info.filename)
                # Flatten the folder structure.
                zip_info.filename = normalized.split(prefix)[-1]
                wheel.extract(zip_info, ptvsd_path)


if __name__ == "__main__":
    install_ptvsd()

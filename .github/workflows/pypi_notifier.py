# import github
# import os

# GH = github.Github(os.getenv("GITHUB_ACCESS_TOKEN"))
# GH_REPO = GH.get_repo(os.getenv("GITHUB_REPOSITORY"))


import pathlib
from urllib import request

from urllib.request import urlopen
import json


# From PyPI, get the latest package version for single package
def get_latest_package_version(package_name):
    with urlopen(f"https://pypi.org/pypi/{package_name}/json") as response:
        data = json.loads(response.read().decode())
        # print(data["info"]["version"]) # debug
        return data["info"]["version"]


# Iterate through all package we have to fetch latest
def get_entire_latest_package_version(our_packages):
    latest_versions = {}
    for package, _ in our_packages.items():
        latest_versions[package] = get_latest_package_version(package)
    return latest_versions


def mark_version_difference(our_packages, latest_packages):
    print(our_packages)
    print(latest_packages)


def main():
    # load in list of packages and its version from requirements.txt that is in one directory above
    root_path = pathlib.Path(__file__).parent.parent.parent
    requirement_content = pathlib.Path(root_path, "requirements.txt").read_text(
        encoding="utf-8"
    )
    # Dictionary of package name and its version
    packages = {}
    for line in requirement_content.splitlines():
        # print(line)
        # If line has == and \ then perform line split to store package and version
        if "==" in line and "\\" in line:
            package, version = line.split("==")
            # remove \ in version string and blank spaces
            version = version.replace("\\", "").strip()
            # print(version)
            packages[package] = version

    # entire latest package
    temp = get_entire_latest_package_version(packages)


if __name__ == "__main__":
    main()
    # get_latest_package_version("black")

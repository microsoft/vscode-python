import subprocess
import github
import os
import pathlib
import importlib.metadata
import pytest
from packaging import version
import requests

GH = github.Github(os.getenv("GITHUB_ACCESS_TOKEN"))
GH_REPO = GH.get_repo(os.getenv("GITHUB_REPOSITORY"))


def fetch_all_package_versions(package_name):
    url = f"https://pypi.org/pypi/{package_name}/json"
    response = requests.get(url)

    if response.status_code == 200:
        data = response.json()
        versions = data["releases"].keys()
        # Sort by packaging library and we have version objects.
        return sorted(versions, key=lambda v: version.parse(v))
    else:
        print(f"Failed to fetch data for {package_name}")
        return None


def main():
    # load in list of packages and its version from requirements.txt that is in one directory above
    # root_path = pathlib.Path(__file__).parent.parent.parent
    # requirement_content = pathlib.Path(root_path, "requirements.txt").read_text(
    #     encoding="utf-8"
    # )
    # Check Pytest version for Python Repo,
    # If there is new version, run Python test,
    # If Python tests fail, then create issue
    # OR We still notify to be safe.
    latest_pytest_version = fetch_all_package_versions("pytest")[-1]
    our_pytest = importlib.metadata.version("pytest")

    if (latest_pytest_version != our_pytest) or (latest_pytest_version is None):
        issue_body = "Pytest may need to be updated:\n"
        GH_REPO.create_issue(
            title="Packages may need to be updated", body=issue_body, labels=["debt"]
        )

    # Now run --pre with pip on requirements.txt and run Python files in pythonFiles/tests/run_all.py
    # Check to see if those tests pass, if they do not, then create an issue.
    subprocess.run(
        [
            "python",
            "-m",
            "pip",
            "install",
            "--upgrade",
            "-r",
            "build/test-requirements.txt",
        ],
        check=False,
    )
    subprocess.run(["pip", "install", "-r", "build/requirements.txt", "--pre"])
    # Run all tests in pythonFiles/tests/run_all.py using subprocess

    test_exit_code = subprocess.run(["python", "pythonFiles/tests/run_all.py"])
    if test_exit_code != 0:
        issue_body = "Tests failed with newest Pytest version"
        GH_REPO.create_issue(
            title="Tests failed with newest Pytest version",
            body=issue_body,
            labels=["debt"],
        )


if __name__ == "__main__":
    main()

# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import asyncio
import io
import json
import pathlib
import tarfile

import aiohttp

from . import data


def _projects(package_data, overrides=frozenset()):
    """Retrieve the list of projects from the package data.

    'package_data' is assumed to be from a 'package-lock.json' file. All
    dev-related dependencies are ignored.

    'overrides' is assumed to be a set of npm package names which are known to
    be included regardless of their "dev" dependency status. This commonly comes
    up when use Webpack.

    """
    packages = {}
    for name, details in package_data["dependencies"].items():
        if details.get("dev", False) and name not in overrides:
            continue
        packages[name] = data.Project(name, details["version"], url=details["resolved"])
    return packages


async def projects_from_data(raw_data, raw_overrides_data=None):
    """Create projects from the file contents of a package-lock.json."""
    json_data = json.loads(raw_data)
    if raw_overrides_data:
        overrides_data = frozenset(json.loads(raw_overrides_data))
    else:
        overrides_data = frozenset()
    # "lockfileVersion": 1
    if "lockfileVersion" not in json_data:
        raise ValueError("npm data does not appear to be from a package-lock.json file")
    elif json_data["lockfileVersion"] != 1:
        raise ValueError("unsupported package-lock.json format")
    return _projects(json_data, overrides_data)


def _top_level_package_filenames(tarball_paths):
    """Transform the iterable of npm tarball paths to the top-level files contained within the package."""
    paths = []
    for path in tarball_paths:
        parts = pathlib.PurePath(path).parts
        if parts[0] == "package" and len(parts) == 2:
            paths.append(parts[1])
    return frozenset(paths)


# While ``name.lower().startswith("license")`` would works in all of the cases
# below, it is better to err on the side of being conservative and be explicit
# rather than just assume that there won't be an e.g. LICENCE_PLATES or LICENSEE
# file which isn't an actual license.
LICENSE_FILENAMES = frozenset(
    x.lower()
    for x in (
        "LICENCE",  # Common typo.
        "license",
        "license.md",
        "license.mkd",
        "license.txt",
        "LICENSE.BSD",
        "LICENSE.MIT",
        "LICENSE-MIT",
        "LICENSE-MIT.txt",
    )
)


def _find_license(filenames):
    """Find the file name for the license file."""
    for filename in filenames:
        if filename.lower() in LICENSE_FILENAMES:
            return filename
    else:
        raise ValueError(f"no license file found in {sorted(filenames)}")


async def _fetch_license(session, tarball_url):
    """Download and extract the license file."""
    try:
        async with session.get(tarball_url) as response:
            response.raise_for_status()
            content = await response.read()
        with tarfile.open(mode="r:gz", fileobj=io.BytesIO(content)) as tarball:
            filenames = _top_level_package_filenames(tarball.getnames())
            license_filename = _find_license(filenames)
            with tarball.extractfile(f"package/{license_filename}") as file:
                return file.read().decode("utf-8")
    except Exception as exc:
        return exc


async def fill_in_licenses(requested_projects):
    """Add the missing licenses to requested_projects.

    Any failures in the searching for licenses are returned.

    """
    failures = {}
    names = list(requested_projects.keys())
    urls = (requested_projects[name].url for name in names)
    async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(verify_ssl=False)) as session:
        tasks = (_fetch_license(session, url) for url in urls)
        for name, license_or_exc in zip(names, await asyncio.gather(*tasks)):
            details = requested_projects[name]
            license_or_exc = await _fetch_license(session, details.url)
            if isinstance(license_or_exc, Exception):
                details.error = license_or_exc
                details.purpose = "npm"
                failures[name] = details
            else:
                details.license = license_or_exc
            print("⬡", end="", flush=True)
    return failures

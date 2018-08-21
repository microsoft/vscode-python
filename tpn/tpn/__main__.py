# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

"""Third-party notices generation.

Usage: tpn [--npm=<package-lock.json>] --config=<TPN.toml> <tpn_path>

Options:
    --npm=<package.json>            Path to a package-lock.json for npm.
    --config=<TPN.toml>             Path to the configuration file.

"""
import asyncio
import json
import pathlib
import sys

import docopt
import pytoml as toml

from . import config
from . import tpnfile
from . import npm


ACCEPTABLE_PURPOSES = frozenset({"explicit", "npm", "pypi"})


async def handle_index(module, raw_path, config_projects, cached_projects):
    _, _, index_name = module.__name__.rpartition(".")
    with open(raw_path, encoding="utf-8") as file:
        raw_data = file.read()
    requested_projects = await module.projects_from_data(raw_data)
    projects, stale = config.sort(index_name, config_projects, requested_projects)
    for name, details in projects.items():
        print(f"{name} {details.version}: sourced from configuration file")
    valid_cache_entries = tpnfile.sort(cached_projects, requested_projects)
    for name, details in valid_cache_entries.items():
        print(f"{name} {details.version}: sourced from TPN cache")
    projects.update(valid_cache_entries)
    failures = await module.fill_in_licenses(requested_projects)
    projects.update(requested_projects)
    return projects, stale, failures


def main(tpn_path, *, config_path, npm_path=None, pypi_path=None):
    tpn_path = pathlib.Path(tpn_path)
    config_path = pathlib.Path(config_path)
    config_data = toml.loads(config_path.read_text(encoding="utf-8"))
    config_projects = config.get_projects(config_data, ACCEPTABLE_PURPOSES)
    projects = config.get_explicit_entries(config_projects)
    if tpn_path.exists():
        cached_projects = tpnfile.parse_tpn(tpn_path.read_text(encoding="utf-8"))
    else:
        cached_projects = {}
    tasks = []
    if npm_path:
        tasks.append(handle_index(npm, npm_path, config_projects, cached_projects))
    if pypi_path:
        tasks.append(handle_index(pypi, pypi_path, config_projects, cached_projects))
    loop = asyncio.get_event_loop()
    gathered = loop.run_until_complete(asyncio.gather(*tasks))
    stale = {}
    failures = {}
    for found_projects, found_stale, found_failures in gathered:
        projects.update(found_projects)
        stale.update(found_stale)
        failures.update(found_failures)
    for name in stale:
        print("STALE in config file:", name)
    if failures:
        for name, details in failures.items():
            print(
                f"FAILED to find license for {name} {details.version} @ {details.url}: {details.error}"
            )
        sys.exit(1)
    with open(tpn_path, "w", encoding="utf-8", newline="\n") as file:
        file.write(tpnfile.generate_tpn(config_data, projects))


if __name__ == "__main__":
    arguments = docopt.docopt(__doc__)
    main(
        arguments["<tpn_path>"],
        config_path=arguments["--config"],
        npm_path=arguments["--npm"],
    )

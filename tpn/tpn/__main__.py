# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

"""Third-party notices generation.

Usage: tpn [--npm=<package-lock.json>] [--npm-overrides=<webpack-overrides.json>] --config=<TPN.toml> <tpn_path>

Options:
    --npm=<package-lock.json>                 Path to a package-lock.json for npm.
    --npm-overrides=<webpack-overrides.json>  Path to a JSON file containing an array of names to override "dev" in <package-lock.json>.
    --config=<TPN.toml>                       Path to the configuration file.

"""
import asyncio
import json
import os
import pathlib
import re
import sys
import textwrap

import docopt
import pytoml as toml

from . import config
from . import tpnfile
from . import npm


ACCEPTABLE_PURPOSES = frozenset({"explicit", "npm", "PyPI"})


async def handle_index(module, raw_path, config_projects, cached_projects, overrides_path=None):
    _, _, index_name = module.__name__.rpartition(".")
    with open(raw_path, encoding="utf-8") as file:
        raw_data = file.read()
    if overrides_path:
        with open(overrides_path, encoding="utf-8") as file:
            raw_overrides_data = file.read()
    else:
        raw_overrides_data = None
    requested_projects = await module.projects_from_data(raw_data, raw_overrides_data)
    projects, stale = config.sort(index_name, config_projects, requested_projects)
    for name, details in projects.items():
        print(f"{name} {details.version}: sourced from configuration file")
    valid_cache_entries = tpnfile.sort(cached_projects, requested_projects)
    for name, details in valid_cache_entries.items():
        print(f"{name} {details.version}: sourced from TPN cache")
    projects.update(valid_cache_entries)
    failures = await module.fill_in_licenses(requested_projects)
    projects.update(requested_projects)
    # Check if a project which is stale by version is actually unneeded.
    for stale_project in stale.keys():
        if stale_project in projects:
            stale[stale_project].error = config.UnneededEntry(stale_project)
    return projects, stale, failures


def _fix_toml(text, comments):
    lines = text.split(os.linesep)
    for i, line in enumerate(lines):
        for orig in comments:
            if line != orig:
                continue
            line += comments[orig]
        if "\\n" in line:
            line = line.replace('\\"', '"')
            line = line.replace('"', '"""\n', 1)
            line = line[::-1].replace('"', '"""', 1)[::-1]
            line = line.replace("\\n", "\n")
        lines[i] = line
    return os.linesep.join(lines)


def _find_trailing_comments(text):
    for line in text.splitlines():
        m = re.match(r".*?( +#[^#]*)$", line)
        if not m:
            continue
        line, _, _ = line.rpartition('#')
        comment, = m.groups()
        yield line.rstrip(), comment


def main(tpn_path, *, config_path, npm_path=None, npm_overrides=None, pypi_path=None):
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
        tasks.append(handle_index(npm, npm_path, config_projects, cached_projects, npm_overrides))
    if pypi_path:
        tasks.append(handle_index(pypi, pypi_path, config_projects, cached_projects))
    loop = asyncio.get_event_loop()
    print()
    gathered = loop.run_until_complete(asyncio.gather(*tasks))
    print()
    stale = {}
    failures = {}
    for found_projects, found_stale, found_failures in gathered:
        projects.update(found_projects)
        stale.update(found_stale)
        failures.update(found_failures)
    if stale:
        print("STALE ", end="")
        print("*" * 20)
        for name, details in stale.items():
            print(details.error)
    if failures:
        print("FAILURES ", end="")
        print("*" * 20)  # Make failure stand out more.
        for name, details in failures.items():
            print(f"{name!r} {details.version} @ {details.url}: {details.error}")
            print(f"NPM URL: {details.npm}")
            print(textwrap.dedent(f"""
            [[project]]
            name = "{name}"
            version = "{details.version}"
            url = "{details.url}"
            purpose = "{details.purpose or "XXX"}"
            license = \"\"\"
            (TODO)
            \"\"\"
            """))
            config_data["project"].append({
                'name': name,
                'version': details.version,
                'url': details.url,
                'purpose': details.purpose or "(TODO)",
                'license': "(TODO)\n",
                })
        print()
        print(f"Could not find a license for {len(failures)} projects")
        print(f"Update {config_path} by filling in the license there for each (look for TODO)")

    comments = dict(_find_trailing_comments(
        config_path.read_text(encoding="utf-8")))

    # Normalize the format and sort.
    config_data["project"] = sorted(config_data["project"], key=lambda p: p["name"])
    text = _fix_toml(
            toml.dumps(config_data),
            comments,
            )
    config_path.write_text(text, encoding="utf-8")

    if stale or failures:
        sys.exit(1)
    else:
        with open(tpn_path, "w", encoding="utf-8", newline="\n") as file:
            file.write(tpnfile.generate_tpn(config_data, projects))


if __name__ == "__main__":
    arguments = docopt.docopt(__doc__)
    main(
        arguments["<tpn_path>"],
        config_path=arguments["--config"],
        npm_path=arguments["--npm"],
        npm_overrides=arguments["--npm-overrides"],
    )

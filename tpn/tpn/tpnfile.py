# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import dataclasses
import pathlib
import re

from . import data


TPN_SECTION_TEMPLATE = "%% {name} {version} NOTICES AND INFORMATION BEGIN HERE ({url})\n=========================================\n{license}\n=========================================\nEND OF {name} NOTICES AND INFORMATION"
TPN_SECTION_RE = re.compile(
    r"%% (?P<name>.+?) (?P<version>\S+) NOTICES AND INFORMATION BEGIN HERE \((?P<url>http.+?)\)\n=========================================\n(?P<license>.+?)\n=========================================\nEND OF (?P=name) NOTICES AND INFORMATION",
    re.DOTALL,
)


def parse_tpn(text):
    """Break the TPN text up into individual project details."""
    licenses = {}
    for match in TPN_SECTION_RE.finditer(text):
        details = match.groupdict()
        name = details["name"]
        licenses[name] = data.Project(**details)
    return licenses


def sort(cached_projects, requested_projects):
    """Tease out the projects which have a valid cache entry.

    Both cached_projects and requested_projects are mutated as appropriate when
    relevant cached entries are found.

    """
    projects = {}
    for name, details in list(requested_projects.items()):
        if name in cached_projects:
            cached_details = cached_projects[name]
            del cached_projects[name]
            if cached_details.version == details.version:
                projects[name] = cached_details
                del requested_projects[name]
    return projects


def generate_tpn(config, projects):
    """Create the TPN text."""
    parts = [config["metadata"]["header"]]
    project_names = sorted(projects.keys(), key=str.lower)
    toc = []
    index_padding = len(f"{len(project_names)}.")
    for index, name in enumerate(project_names, 1):
        index_format = f"{index}.".ljust(index_padding)
        toc.append(
            f"{index_format} {name} {projects[name].version} ({projects[name].url})"
        )
    parts.append("\n".join(toc))
    licenses = []
    for name in project_names:
        details = projects[name]
        licenses.append(TPN_SECTION_TEMPLATE.format(**dataclasses.asdict(details)))
    parts.append("\n\n".join(licenses))
    return "\n\n\n".join(parts) + "\n"

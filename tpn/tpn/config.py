# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

from __future__ import annotations

import dataclasses
import enum

from . import data


@dataclasses.dataclass
class ConfigProject(data.Project):
    """Projects from a TOML configuration file."""

    license: str
    # Must be optional due to 'error' being optional in base class.
    purpose: Optional[str] = None


FIELDS = {"name", "version", "url", "purpose", "license"}


def get_projects(config, acceptable_purposes):
    """Pull out projects as specified in a configuration file."""
    projects = {}
    for project_data in config["project"]:
        if not all(key in project_data for key in FIELDS):
            name = project_data.get("name", "<unknown>")
            missing_keys = FIELDS.difference(project_data.keys())
            raise KeyError(f"{name!r} is missing the keys {sorted(missing_keys)}")
        if project_data["purpose"] not in acceptable_purposes:
            raise ValueError(
                f"{project_data['name']!r} has a purpose of {project_data['purpose']!r}"
                f" which is not one of {sorted(acceptable_purposes)}"
            )
        projects[project_data["name"]] = ConfigProject(**project_data)
    return projects


def get_explicit_entries(config_projects):
    """Pull out and return the projects in the config that were explicitly entered.

    The projects in the returned dict are deleted from config_projects.

    """
    explicit_projects = {
        name: details
        for name, details in config_projects.items()
        if details.purpose == "explicit"
    }
    for project in explicit_projects:
        del config_projects[project]
    return explicit_projects


def sort(purpose, config_projects, requested_projects):
    """Sort projects in the config for the specified 'purpose' into valid and stale entries.

    The config_projects mapping will have all 'purpose' projects deleted from it
    in the end. The requested_projects mapping will have any project which was
    appropriately found in config_projects deleted. In the end:

    - config_projects will have no projects related to 'purpose' left.
    - requested_projects will have projects for which no match in config_projects
      was found.
    - The first returned item will be all projects which had a match in both
      config_projects and requested_projects for 'purpose'
    - The second item returned will be all projects which match 'purpose' that
      were not placed into the first returned item

    """
    projects = {}
    stale = {}
    config_subset = {
        project: details
        for project, details in config_projects.items()
        if details.purpose == purpose
    }
    for name, details in config_subset.items():
        del config_projects[name]
        config_version = details.version
        match = False
        if name in requested_projects:
            requested_version = requested_projects[name].version
            if config_version == requested_version:
                projects[name] = details
                del requested_projects[name]
                match = True
        if not match:
            stale[name] = details

    return projects, stale

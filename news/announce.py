# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

"""Generate the changelog.

Usage: announce [--dry_run | --interim | --final] [<directory>]

"""
import dataclasses
import enum
import operator
import os
import pathlib
import re
import subprocess
import sys

import docopt


FILENAME_RE = re.compile(r"(?P<issue>\d+)(?P<nonce>-\S+)?\.md")


@dataclasses.dataclass
class NewsEntry:
    """Representation of a news entry."""

    issue_number: int
    description: str
    path: pathlib.Path


def news_entries(directory):
    """Yield news entries in the directory."""
    for path in directory.iterdir():
        if path.name == "README.md":
            continue
        match = FILENAME_RE.match(path.name)
        if match is None:
            raise ValueError(f"{path} has a bad file name")
        issue = int(match.group("issue"))
        entry = path.read_text("utf-8")
        yield NewsEntry(issue, entry, path)


@dataclasses.dataclass
class SectionTitle:
    """Create a data object for a section of the changelog."""

    index: int
    title: str
    path: pathlib.Path


def sections(directory):
    """Yield the sections in their appropriate order."""
    found = []
    for path in directory.iterdir():
        if not path.is_dir() or path.name.startswith("."):
            continue
        position, sep, title = path.name.partition(" ")
        if not sep:
            print(
                f"directory {path.name!r} is missing a ranking; skipping",
                file=sys.stderr,
            )
            continue
        found.append(SectionTitle(int(position), title, path))
    return sorted(found, key=operator.attrgetter("index"))


def gather(directory):
    """Gather all the entries together."""
    data = []
    for section in sections(directory):
        data.append((section, list(news_entries(section.path))))
    return data


def entry_markdown(entry):
    """Generate the Markdown for the specified entry."""
    enumerated_item = "1. "
    indent = " " * len(enumerated_item)
    issue_url = (
        f"https://github.com/Microsoft/vscode-python/issues/{entry.issue_number}"
    )
    issue_md = f"([#{entry.issue_number}]({issue_url}))"
    entry_lines = entry.description.strip().splitlines()
    formatted_lines = [f"{enumerated_item}{entry_lines[0]}"]
    formatted_lines.extend(f"{indent}{line}" for line in entry_lines[1:])
    formatted_lines.append(f"{indent}{issue_md}")
    return "\n".join(formatted_lines)
    return ENTRY_TEMPLATE.format(
        entry=entry.description.strip(), issue=entry.issue_number, issue_url=issue_url
    )


def changelog_markdown(data):
    """Generate the Markdown for the release."""
    changelog = []
    for section, entries in data:
        changelog.append(f"### {section.title}")
        changelog.append("")
        changelog.extend(map(entry_markdown, entries))
        changelog.append("")
    return "\n".join(changelog)


def git_rm(path):
    """Run git-rm on the path."""
    status = subprocess.run(
        ["git", "rm", os.fspath(path.resolve())],
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    try:
        status.check_returncode()
    except Exception:
        print(status.stdout, file=sys.stderr)
        raise


def cleanup(data):
    """Remove news entries from git and disk."""
    for section, entries in data:
        for entry in entries:
            git_rm(entry.path)


class RunType(enum.Enum):
    """Possible run-time options."""

    dry_run = 0
    interim = 1
    final = 2


def main(run_type, directory):
    directory = pathlib.Path(directory)
    data = gather(directory)
    markdown = changelog_markdown(data)
    if run_type != RunType.dry_run:
        # XXX This can lead to mojibake; hopefully Python 3.7 will resolve this.
        print(markdown)
    if run_type == RunType.final:
        cleanup(data)


if __name__ == "__main__":
    arguments = docopt.docopt(__doc__)
    for possible_run_type in RunType:
        if arguments[f"--{possible_run_type.name}"]:
            run_type = possible_run_type
            break
    else:
        run_type = RunType.interim
    directory = arguments["<directory>"] or pathlib.Path(__file__).parent
    main(run_type, directory)

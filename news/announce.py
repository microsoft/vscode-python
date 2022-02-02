# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

"""Generate the changelog.

Usage: announce [--dry_run | --interim | --final] [--update=<news_file>] [<directory>]

"""
import dataclasses
import datetime
import enum
import json
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
    """Yield news entries in the directory.

    Entries are sorted by issue number.

    """
    entries = []
    for path in directory.iterdir():
        if path.name == "README.md":
            continue
        match = FILENAME_RE.match(path.name)
        if match is None:
            raise ValueError(f"{path} has a bad file name")
        issue = int(match.group("issue"))
        try:
            entry = path.read_text("utf-8")
        except UnicodeDecodeError as exc:
            raise ValueError(f"'{path}' is not encoded as UTF-8") from exc
        if "\ufeff" in entry:
            raise ValueError(f"'{path}' contains the BOM")
        entries.append(NewsEntry(issue, entry, path))
    entries.sort(key=operator.attrgetter("issue_number"))
    yield from entries


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
        if not path.is_dir() or path.name.startswith((".", "_")):
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
        shell=False,
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


def complete_news(version, entry, previous_news):
    """Prepend a news entry to the previous news file."""
    title, _, previous_news = previous_news.partition("\n")
    title = title.strip()
    previous_news = previous_news.strip()
    section_title = (
        f"## {version} ({datetime.date.today().strftime('%d %B %Y')})"
    ).replace("(0", "(")
    # TODO: Insert the "Thank you!" section (in monthly releases)?
    return f"{title}\n\n{section_title}\n\n{entry.strip()}\n\n\n{previous_news}"


def main(run_type, directory, news_file=None):
    directory = pathlib.Path(directory)
    data = gather(directory)
    markdown = changelog_markdown(data)
    if news_file:
        with open(news_file, "r", encoding="utf-8") as file:
            previous_news = file.read()
        package_config_path = pathlib.Path(news_file).parent / "package.json"
        config = json.loads(package_config_path.read_text(encoding="utf-8"))
        new_news = complete_news(config["version"], markdown, previous_news)
        if run_type == RunType.dry_run:
            print(f"would be written to {news_file}:")
            print()
            print(new_news)
        else:
            with open(news_file, "w", encoding="utf-8") as file:
                file.write(new_news)
    else:
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
    main(run_type, directory, arguments["--update"])

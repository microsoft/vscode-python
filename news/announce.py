"""Generate the changelog."""
import enum
import operator
import os
import pathlib
import re
import subprocess
import types

import click


FILENAME_RE = re.compile(r"(?P<issue>\d+)(?P<nonce>-\S+)?\.md")
ISSUE_URL = "https://github.com/Microsoft/vscode-python/issues/{issue}"
ENTRY_TEMPLATE = "1. {entry} ([#{issue}]({issue_url}))"
SECTION_DEPTH = "###"


def NewsEntry(issue_number, description, path):
    """Construct a data object for a news entry."""
    # TODO: replace with a dataclass in Python 3.7.
    return types.SimpleNamespace(issue_number=issue_number,
                                 description=description, path=path)


def news_entries(directory):
    """Yield news entries in the directory."""
    for path in directory.iterdir():
        if path.name == 'README.md':
            continue
        match = FILENAME_RE.match(path.name)
        if match is None:
            raise ValueError(f'{path} has a bad file name')
        issue = int(match.group('issue'))
        entry = path.read_text("utf-8")
        yield NewsEntry(issue, entry, path)


def SectionTitle(index, title, path):
    """Create a data object for a section of the changelog."""
    # TODO: replace with a dataclass in Python 3.7.
    return types.SimpleNamespace(index=index, title=title, path=path)


def sections(directory):
    """Yield the sections in their appropriate order."""
    found = []
    for path in directory.iterdir():
        if not path.is_dir() or path.name.startswith('.'):
            continue
        position, sep, title = path.name.partition(' ')
        if not sep:
            raise ValueError(f'directory is missing position part: {path.name!r}')
        found.append(SectionTitle(int(position), title, path))
    return sorted(found, key=operator.attrgetter('index'))


def gather(directory):
    """Gather all the entries together."""
    data = []
    for section in sections(directory):
        data.append((section, list(news_entries(section.path))))
    return data


def entry_markdown(entry):
    """Generate the Markdown for the specified entry."""
    issue_url = ISSUE_URL.format(issue=entry.issue_number)
    return ENTRY_TEMPLATE.format(entry=entry.description,
                                 issue=entry.issue_number,
                                 issue_url=issue_url)


def changelog_markdown(data):
    """Generate the Markdown for the release."""
    changelog = []
    for section, entries in data:
        changelog.append(f"{SECTION_DEPTH} {section.title}")
        changelog.append("")
        changelog.extend(map(entry_markdown, entries))
        changelog.append("")
    return "\n".join(changelog)


def git_rm(path):
    """Run git-rm on the path."""
    status = subprocess.run(['git', 'rm', os.fspath(path.resolve())],
                            shell=True)
    status.check_returncode()


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


@click.command()
@click.option('--dry-run', 'run_type', flag_value=RunType.dry_run,
              help='validate input')
@click.option('--interim', 'run_type', flag_value=RunType.interim, default=True,
              help='generate Markdown')
@click.option('--final', 'run_type', flag_value=RunType.final,
              help='generate Markdown & `git rm` news files')
@click.argument('directory', default=pathlib.Path(__file__).parent,
                type=click.Path(exists=True, file_okay=False))
def main(run_type, directory):
    directory = pathlib.Path(directory)
    data = gather(directory)
    markdown = changelog_markdown(data)
    if run_type != RunType.dry_run:
        print(markdown)
    if run_type == RunType.final:
        cleanup(data)


if __name__ == '__main__':
    main()

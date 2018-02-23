"""Generate the changelog."""
import enum
import operator
import pathlib
import re

import click


FILENAME_RE = re.compile(r"(?P<issue>\d+)(?P<nonce>-\S+)?\.md")
ISSUE_URL = "https://github.com/Microsoft/vscode-python/issues/{issue}"
ENTRY_TEMPLATE = "- {entry} ([#{issue}]({issue_url}))"
SECTION_DEPTH = "##"


def news_entries(directory, *, cleanup=False):
    """Iterate over the news entries in the directory."""
    for path in directory.iterdir():
        if path.name == 'README.md':
            continue
        match = FILENAME_RE.match(path.name)
        if match is None:
            raise ValueError(f'{path} has a bad file name')
        issue = int(match.group('issue'))
        entry = path.read_text("utf-8")
        # I want dataclasses!
        yield issue, entry
        # XXX if cleanup: `git rm` the file


def sections(directory):
    """Iterate over the sections."""
    found = []
    for path in directory.iterdir():
        if not path.is_dir():
            continue
        position, _, title = path.name.partition(' ')
        found.append((int(position), title, path))
    ordered_found = sorted(found, key=operator.itemgetter(0))
    # I want dataclasses!
    yield from (section[1:] for section in ordered_found)


def gather(directory, *, cleanup=False):
    """Gather all the entries together."""
    data = []
    for name, path in sections(directory):
        # I want dataclasses!
        data.append((name, news_entries(path, cleanup=cleanup)))
    return data


def entry_markdown(entry):
    """Generate the Markdown for the specified entry."""
    issue_url = ISSUE_URL.format(issue=entry[0])
    return ENTRY_TEMPLATE.format(entry=entry[1], issue=entry[0],
                                 issue_url=issue_url)


def changelog_markdown(data):
    """Generate the Markdown for the release."""
    changelog = []
    for section, entries in data:
        changelog.append(f"{SECTION_DEPTH} {section}")
        changelog.append("")
        changelog.extend(map(entry_markdown, entries))
        changelog.append("")
    return "\n".join(changelog)


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
    cleanup = run_type == RunType.final
    data = gather(directory, cleanup=cleanup)
    markdown = changelog_markdown(data)
    if run_type != RunType.dry_run:
        print(markdown)


if __name__ == '__main__':
    main()

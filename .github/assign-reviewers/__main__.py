from __future__ import annotations

import pathlib
import random
import sys

import typing
from typing import (
    AbstractSet,
    Container,
    FrozenSet,
    Iterable,
    Tuple,
)

import gidgethub.abc
import gidgethub.httpx
import gidgethub.actions
import httpx
import trio
import yaml


class ConfigData(typing.TypedDict):

    """Dict representation of assign-reviers.yml."""

    numberOfReviewers: int
    team: list[str]
    reviewers: list[str]


def select_reviewers(
    *,
    author: str,
    available_reviewers: AbstractSet[str],
    assigned_reviewers: AbstractSet[str],
    count: int,
) -> Tuple[FrozenSet[str], FrozenSet[str]]:
    """Select people to review the PR.

    If the author is a potential reviewer, remove them from contention. Also
    deduct the number of reviewers necessary based on any that have already
    been asked to review who are also eligible to review.

    """
    already_reviewing = frozenset(available_reviewers & assigned_reviewers)
    potential_reviewers = set(available_reviewers)  # Mutable copy.
    potential_reviewers -= assigned_reviewers
    potential_reviewers.discard(author)
    count -= len(assigned_reviewers)
    selected_reviewers = []
    while count > 0 and potential_reviewers:
        selected = random.choice(list(potential_reviewers))
        potential_reviewers.discard(selected)
        selected_reviewers.append(selected)
        count -= 1
    selected_reviewers = frozenset(selected_reviewers)
    return already_reviewing | selected_reviewers, selected_reviewers


async def add_assignee(
    gh: gidgethub.abc.GitHubAPI, team: Container[str], reviewers: Iterable[str]
) -> None:
    """Assign the PR.

    For team members, assign to themselves. For external PRs, randomly select
    one of the reviewers.

    """
    event = gidgethub.actions.event()
    if (assignee := event["pull_request"]["user"]["login"]) not in team:
        assignee = random.choice(list(reviewers))
    await gh.post(
        "/repos/{owner}/{repo}/issues/{issue_number}/assignees",
        url_vars={
            "owner": event["repository"]["owner"]["login"],
            "repo": event["repository"]["name"],
            "issue_number": event["pull_request"]["number"],
        },
        data={"assignees": [assignee]},
    )


async def add_reviewers(
    gh: gidgethub.abc.GitHubAPI, reviewers_to_add: Iterable[str]
) -> None:
    """Add reviewers to a PR."""
    event = gidgethub.actions.event()
    await gh.post(
        "/repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers",
        url_vars={
            "owner": event["repository"]["owner"]["login"],
            "repo": event["repository"]["name"],
            "issue_number": event["pull_request"]["number"],
        },
        data={"reviewers": list(reviewers_to_add)},
    )


async def main(token: str):
    config_file = pathlib.Path(__file__).parent.parent / "assign-reviewers.yml"
    with config_file.open(encoding="utf-8") as file:
        config: ConfigData = yaml.safe_load(file)
    event = gidgethub.actions.event()
    team_reviewers, reviewers_to_add = select_reviewers(
        author=event["pull_request"]["user"]["login"],
        available_reviewers=frozenset(config["reviewers"]),
        assigned_reviewers={
            reviewer["login"]
            for reviewer in event["pull_request"]["requested_reviewers"]
        },
        count=int(config["numberOfReviewers"]),
    )
    async with httpx.AsyncClient(timeout=None) as client:
        gh = gidgethub.httpx.GitHubAPI(
            client, event["repository"]["full_name"], oauth_token=token
        )
        async with trio.open_nursery() as nursery:
            if not event["pull_request"]["assignee"]:
                nursery.start_soon(
                    add_assignee, gh, frozenset(config["team"]), team_reviewers
                )
            if reviewers_to_add and not event["pull_request"]["draft"]:
                nursery.start_soon(add_reviewers, gh, reviewers_to_add)


if __name__ == "__main__":
    trio.run(main, sys.argv[1])

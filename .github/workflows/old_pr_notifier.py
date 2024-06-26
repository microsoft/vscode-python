import os
import requests
from datetime import datetime

REPO = "microsoft/vscode-python"
# TOKEN = os.environ["GH_TOKEN"]
# HEADERS = {"Authorization": f"token {TOKEN}"}
STALE_DAYS = 30  # Number of days to consider a PR stale. Set for a month.


def get_last_comment_date(pr_object):
    # pr_number = # We need to iterate through all PR we have open in the repo
    url = f"https://api.github.com/repos/{REPO}/issues/{pr_object['number']}/comments"
    response = requests.get(url)
    if response.status_code == 200:
        comments = response.json()
        print(comments)
        if comments:
            # Find maximum by comment creation date value.
            last_comment = max(comments, key=lambda c: c["created_at"])
            # Convert to datetime object and remove "Z" at end of string.
            # Z is part of ISO 8601 standard that represent zero UTC offset,
            # but datetime.fromisoformat does not support it.
            # print("what are we returning")
            # print(datetime.fromisoformat(last_comment["created_at"].rstrip("Z")))
            return datetime.fromisoformat(last_comment["created_at"].rstrip("Z"))
        # return None
        # In case there are no comments, create date when the PR was created
        return datetime.fromisoformat(pr_object["created_at"].rstrip("Z"))


# Fetch all open PR in repository
def get_open_pull_requests(owner, repo):
    url = f"https://api.github.com/repos/{owner}/{repo}/pulls?state=open"
    response = requests.get(url)
    if response.status_code == 200:
        # print(type(response.json()))
        return response.json()
    else:
        print("Failed to fetch PRs:", response.content)
        return []


def main():
    # print(get_last_comment_date(22741))
    all_pr = get_open_pull_requests("microsoft", "vscode-python")
    # Itarate through all PRs, and check if the latest comment in the PR is older than 30 days.
    for pr in all_pr:
        today = datetime.now()
        latest_comment_date = get_last_comment_date(pr)
        # print(type(latest_comment_date))
        age_of_pr = today - latest_comment_date
        if age_of_pr.days > 30:
            print("Older than one month!!!")
            print(pr["number"])
        else:
            print("pretty new")


if __name__ == "__main__":
    main()

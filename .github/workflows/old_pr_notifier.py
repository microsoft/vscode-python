import os
import requests
from datetime import datetime

REPO = "microsoft/vscode-python"
# TOKEN = os.environ["GH_TOKEN"]
# HEADERS = {"Authorization": f"token {TOKEN}"}
STALE_DAYS = 30  # Number of days to consider a PR stale. Set for a month.


def get_last_comment_date(pr_number):
    # pr_number = # We need to iterate through all PR we have open in the repo
    url = f"https://api.github.com/repos/{REPO}/issues/{pr_number}/comments"
    response = requests.get(url)
    if response.status_code == 200:
        comments = response.json()
        # print(comments)
        if comments:
            # Find maximum by comment creation date value.
            last_comment = max(comments, key=lambda c: c["created_at"])
            # Convert to datetime object and remove "Z" at end of string.
            # Z is part of ISO 8601 standard that represent zero UTC offset,
            # but datetime.fromisoformat does not support it.
            return datetime.fromisoformat(last_comment["created_at"].rstrip("Z"))
    return None


# Fetch all open PR in repository
def get_all_open_pull_requests(owner, repo_name):
    url = f"https://api.github.com/repos/{owner}/{repo_name}/pulls?state=open"
    response = requests.get(url)
    if response.status_code == 200:
        return response.json()  # Returns list of opened PRs.
    else:
        print("Failed to fetch PRs:", response.content)
        return []


def main():
    # print(get_last_comment_date(22741)) testing
    all_open_prs = get_all_open_pull_requests("microsoft", "vscode-python")


if __name__ == "__main__":
    main()

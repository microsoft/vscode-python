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


def main():
    print(get_last_comment_date(22741))


if __name__ == "__main__":
    main()

import requests
import os
from datetime import datetime, timezone

GITHUB_API_URL = "https://api.github.com"
REPO = "microsoft/vscode-python"
TOKEN = os.getenv("GITHUB_TOKEN")


def fetch_issues():
    headers = {"Authorization": f"token {TOKEN}"}
    query = f"{GITHUB_API_URL}/repos/{REPO}/issues?state=open&per_page=100"
    response = requests.get(query, headers=headers)
    response.raise_for_status()
    return response.json()


def calculate_thumbs_up_per_day(issue):
    created_at = datetime.strptime(issue["created_at"], "%Y-%m-%dT%H:%M:%SZ")
    now = datetime.now(timezone.utc)
    days_open = (now - created_at).days or 1
    thumbs_up = next(
        (group["count"] for group in issue["reactions"] if group["content"] == "+1"), 0
    )
    return thumbs_up / days_open


def generate_markdown_summary(issues):
    summary = "| URL | Title | 👍/day |\n| --- | ----- | ------ |\n"
    for issue in issues:
        thumbs_up_per_day = calculate_thumbs_up_per_day(issue)
        summary += (
            f"| {issue['html_url']} | {issue['title']} | {thumbs_up_per_day:.2f} |\n"
        )
    return summary


def main():
    issues = fetch_issues()
    summary = generate_markdown_summary(issues)
    with open("endorsement_velocity_summary.md", "w") as f:
        f.write(summary)


if __name__ == "__main__":
    main()

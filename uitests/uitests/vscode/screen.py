# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os

import requests

import uitests.vscode.application
from uitests.tools import retry


def get_screen_text(context):
    """Gets the text from the current VSC screen."""

    image_file = uitests.vscode.application.capture_screen_to_file(context)

    # Get endpoint and key from environment variables
    endpoint = os.getenv("AZURE_COGNITIVE_ENDPOINT")
    subscription_key = os.getenv("AZURE_COGNITIVE_KEY")

    if endpoint is None or subscription_key is None:
        raise EnvironmentError(
            "Variables AZURE_COGNITIVE_ENDPOINT, AZURE_COGNITIVE_KEY not defined"
        )

    ocr_url = f"{endpoint}vision/v2.0/ocr"

    @retry(ConnectionError, tries=10, backoff=2)
    def get_result():
        headers = {
            "Ocp-Apim-Subscription-Key": subscription_key,
            "Content-Type": "application/octet-stream",
        }

        with open(image_file, "rb") as fp:
            response = requests.post(ocr_url, headers=headers, data=fp.read())

        response.raise_for_status()
        return response.json()

    result = get_result()

    # Extract the text.
    line_infos = [region["lines"] for region in result["regions"]]
    word_infos = []
    for line in line_infos:
        for word_metadata in line:
            for word_info in word_metadata["words"]:
                word_infos.append(word_info.get("text"))

    return " ".join(word_infos)

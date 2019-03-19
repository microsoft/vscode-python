# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import behave
import tests


@behave.then('a message with the text "{message}" is displayed')
def show_message(context, message: str):
    tests.vscode.notifications.wait_for_message(context, message)


@behave.then('a message containing the text "{message}" is displayed')
def show_message_containing(context, message: str):
    tests.vscode.notifications.wait_for_message_containing(context, message)

# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import behave
import uitests.vscode.notifications


@behave.then('a message with the text "{message}" is displayed')
def show_message(context, message):
    uitests.vscode.notifications.wait_for_message(context, message)


@behave.then('a message containing the text "{message}" is displayed')
def show_message_containing(context, message):
    uitests.vscode.notifications.wait_for_message_containing(context, message)


@behave.then('dismiss the message containing the text "{message}"')
def dismiss_message(context, message):
    uitests.vscode.notifications.dismiss_message(context, message)


@behave.then('click "{button}" button on the message containing the text "{message}"')
def dismiss_message_with_button(context, button, message):
    uitests.vscode.notifications.dismiss_message(context, message, button)

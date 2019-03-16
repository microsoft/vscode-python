# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import behave


@behave.then('a message with the text "{message}" is displayed')
def show_message(context, message: str):
    context.app.notifications.wait_for_message(message)


@behave.then('a message containing the text "{message}" is displayed')
def show_message_containing(context, message: str):
    context.app.notifications.wait_for_message_containing(message)

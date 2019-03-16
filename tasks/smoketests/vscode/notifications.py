# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


from . import core, quick_open


def clear(context, **kwargs):
    quick_open.select_command(context, "Notifications: Clear All Notifications")


def wait_for_message(context, value: str, **kwargs):
    selector = ".notifications-toasts.visible .notifications-list-container .notification-list-item-message"
    find = lambda elements: [element for element in elements if element.text == value]
    return core.wait_for_elements(context, selector, find)


def wait_for_message_containing(context, value: str, **kwargs):
    selector = ".notifications-toasts.visible .notifications-list-container .notification-list-item-message"
    find = lambda elements: [
        element for element in elements if element.text.index(value) >= 0
    ]
    return core.wait_for_elements(context, selector, find)

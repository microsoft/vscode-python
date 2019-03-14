# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


from .base import Notifications as BaseNotifications, Component


class Notifications(BaseNotifications, Component):
    def clear(self, **kwargs):
        self.app.quick_open.select_command("Notifications: Clear All Notifications")

    def wait_for_message(self, value: str, **kwargs):
        selector = ".notifications-toasts.visible .notifications-list-container .notification-list-item-message"
        find = lambda elements: [element for element in elements if element.text == value]
        return self.app.core.wait_for_elements(selector, find)

    def wait_for_message_containing(self, value: str, **kwargs):
        selector = ".notifications-toasts.visible .notifications-list-container .notification-list-item-message"
        find = lambda elements: [element for element in elements if element.text.index(value) >= 0]
        return self.app.core.wait_for_elements(selector, find)

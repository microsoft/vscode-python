# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import time

from uitests.tools import retry

from . import core, quick_open


def clear(context, **kwargs):
    quick_open.select_command(context, "Notifications: Clear All Notifications")


def wait_for_message(context, value, **kwargs):
    selector = ".notifications-toasts.visible .notifications-list-container .notification-list-item-message"

    def find(elements):
        return [element for element in elements if element.text == value]

    return core.wait_for_elements(context.driver, selector, find, **kwargs)


def dismiss_message(
    context, message, button_text=None, retry_count=100, retry_interval=0.1
):
    @retry(AssertionError, tries=retry_count, delay=retry_interval)
    def dismiss():
        # Get a list of all notifications with the above message
        elements = _get_messages_containing_text(context, message)

        if button_text is None:
            # For each of these click the `X` box
            for close_icon in map(_get_close_button, elements):
                close_icon.click()
                # Wait for click to take affect.
                time.sleep(0.5)
        else:
            # For each of these click the `<button_text>` button
            for button in map(
                lambda element: _get_button(element, button_text), elements
            ):
                button.click()
                # Wait for click to take affect.
                time.sleep(0.5)

    dismiss()


def wait_for_message_containing(context, value, **kwargs):
    selector = ".notifications-toasts.visible .notifications-list-container .notification-list-item-message"

    def find(elements):
        return [element for element in elements if value in element.text]

    return core.wait_for_elements(context.driver, selector, find, **kwargs)


def _does_notification_contain_message(element, message):
    return any(
        [
            child
            for child in element.find_elements_by_css_selector(
                ".notification-list-item-message"
            )
            if message.lower() in child.text.lower()
        ]
    )


def _get_close_button(element):
    return element.find_element_by_css_selector(
        ".action-label.icon.clear-notification-action"
    )


def _get_button(element, button_text):
    buttons = element.find_elements_by_css_selector(".monaco-button.monaco-text-button")
    valid_buttons = [
        button for button in buttons if button_text.lower() in button.text.lower()
    ]
    return valid_buttons[0] if any(valid_buttons) else None


def _get_messages_containing_text(context, message):
    selector = ".notifications-toasts.visible .notifications-list-container"

    def find(elements):
        return [
            element
            for element in elements
            if _does_notification_contain_message(element, message)
        ]

    # Get a list of all notifications with the above message
    # If the message isn't visible yet, then no need to retry, we'll do that in dismiss.
    elements = core.wait_for_elements(context.driver, selector, find, retry_count=2)
    if any(elements):
        return elements
    else:
        raise AssertionError(f"No notification with the provided message '{message}'")

# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import time

from selenium import webdriver
from selenium.common.exceptions import (
    NoSuchElementException,
    StaleElementReferenceException,
)


def _try_and_find(fn, **kwargs):
    timeout_messge: str = kwargs.get("timeout_messge", "Timeout")
    retry_count: int = kwargs.get("retry_count", 100)
    retry_interval: int = kwargs.get("retry_interval", 100)
    timeout = kwargs.get("timeout", None)
    if timeout is not None:
        retry_count = (timeout * 1000) / retry_interval
    else:
        timeout = retry_count * retry_interval / 1000

    trial_counter = 1
    start = time.time()
    while trial_counter < retry_count:
        if time.time() - start > timeout:
            trial_counter = retry_count + 1
        try:
            return fn.__call__()
        except (NoSuchElementException, StaleElementReferenceException):
            trial_counter += 1
            time.sleep(retry_interval / 1000)
    else:
        msg = f"Timeout: {timeout_messge} after {(retry_count * retry_interval) / 1000} seconds."
        raise SystemError(msg)


class Core(object):
    def __init__(self, driver: webdriver.Chrome):
        self.driver = driver

    def dispatch_keys(self, keys: str, **kwargs):
        element = kwargs.get("element", self.driver.switch_to.active_element)
        element.send_keys(keys)

    def wait_and_click(self):
        pass

    def wait_and_double_click(self):
        pass

    def wait_for_element(self, css_selector, predicate=lambda ele: True, **kwargs):
        def find():
            element = self.driver.find_element_by_css_selector(css_selector)
            if not element.is_displayed():
                raise NoSuchElementException(
                    "Element not yet visible, so lets wait again"
                )
            if predicate(element) is True:
                return element
            raise NoSuchElementException("Predicate returned False in wait_for_element")

        return _try_and_find(find, **kwargs)

    def wait_for_elements(self, css_selector, predicate=lambda elements: [], **kwargs):
        def find():
            elements = self.driver.find_elements_by_css_selector(css_selector)
            filtered = predicate(elements)
            if filtered:
                # Ensure all items returned are visible.
                for element in filtered:
                    if not element.is_displayed():
                        raise NoSuchElementException(
                            "Element not yet visible, so lets wait again"
                        )

                return filtered
            raise NoSuchElementException(
                "Predicate returned False in wait_for_elements"
            )

        return _try_and_find(find, **kwargs)

    def wait_for_active_element(self, css_selector, **kwargs):
        def is_active():
            element = self.driver.find_element_by_css_selector(css_selector)
            assert element == self.driver.switch_to.active_element
            if not element.is_displayed():
                raise NoSuchElementException(
                    "Element not yet visible, so lets wait again"
                )
            return element

        return _try_and_find(is_active, **kwargs)

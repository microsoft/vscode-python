# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os
import shutil
import time
from typing import List
from dataclasses import dataclass
from enum import Enum
from selenium import webdriver
from .utils import get_binary_location, get_cli_location
from ..bootstrap.main import get_extension_path as get_bootstrap_ext_path
from ..utils.tools import run_command, ensure_directory
from selenium.common.exceptions import NoSuchElementException
import selenium
import selenium.common
import selenium.webdriver

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
            ele = fn.__call__()
            return ele
        except NoSuchElementException:
            trial_counter += 1
            time.sleep(retry_interval / 1000)
    else:
        msg = f"Timeout: {timeout_messge} after {(retry_count * retry_interval) / 1000} seconds."
        raise SystemError(msg)


class Core(object):
    def __init__(self, driver: webdriver.Chrome):
        self.driver = driver

    def dispatch_keys(self, keys: str, **kwargs):
        ele = kwargs.get('element', self.driver.switch_to.active_element)
        ele.send_keys(keys)

    def wait_and_click(self):
        pass

    def wait_and_double_click(self):
        pass

    def wait_for_element(self, css_selector, predicate=lambda ele: True, **kwargs):
        def find():
            ele = self.driver.find_element_by_css_selector(css_selector)
            if predicate(ele) == True:
                return ele
            raise NoSuchElementException("Predicate returned False in wait_for_element")

        return _try_and_find(find, **kwargs)

    def wait_for_elements(self, css_selector, predicate=lambda eles: True, **kwargs):
        def find():
            eles = self.driver.find_elements_by_css_selector(css_selector)
            if predicate(eles) == True:
                return eles
            raise NoSuchElementException("Predicate returned False in wait_for_elements")

        return _try_and_find(find, **kwargs)

    def wait_for_active_element(self, css_selector, **kwargs):
        def is_active():
            ele = self.driver.find_element_by_css_selector(css_selector)
            assert ele == self.driver.switch_to.active_element
            return ele

        return _try_and_find(is_active, **kwargs)

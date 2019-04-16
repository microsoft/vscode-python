# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import pytest
import sys
import os
import pandas as pd
import json
from .scripts import print_variable_value, print_variables, find_variable_json
from IPython import get_ipython

@pytest.mark.skipif(get_ipython() == None,
                    reason="Can't run variable tests without IPython console")
def test_variable_list(capsys):
    # Execute a single cell before we get the variables. 
    get_ipython().run_cell('x = 3\r\ny = 4\r\nz=5')
    vars = get_variables(capsys)
    have_x = False
    have_y = False
    have_z = False
    for sub in vars:
        have_x |= sub['name'] == 'x'
        have_y |= sub['name'] == 'y'
        have_z |= sub['name'] == 'z'
    assert have_x
    assert have_y
    assert have_z

@pytest.mark.skipif(get_ipython() == None,
                    reason="Can't run variable tests without IPython console")
def test_variable_value(capsys):
    # Execute a single cell before we get the variables. This is the variable we'll look for.
    get_ipython().run_cell('x = 3')
    vars = get_variables(capsys)
    varx = find_variable_json('x', vars)
    assert varx
    varx_value = get_variable_value(varx, capsys)
    assert varx_value
    assert varx_value == '3'


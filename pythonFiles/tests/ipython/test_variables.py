# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import pytest
import sys
import os
import json
from .scripts import get_variable_value, get_variables, get_data_frame_info, get_data_frame_rows, check_for_ipython
import imp
haveIPython = check_for_ipython()

@pytest.mark.skipif(not haveIPython,
                    reason="Can't run variable tests without IPython console")
def test_variable_list(capsys):
    from IPython import get_ipython
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

@pytest.mark.skipif(not haveIPython,
                    reason="Can't run variable tests without IPython console")
def test_variable_value(capsys):
    from IPython import get_ipython
    # Execute a single cell before we get the variables. This is the variable we'll look for.
    get_ipython().run_cell('x = 3')
    vars = get_variables(capsys)
    varx_value = get_variable_value(vars, 'x', capsys)
    assert varx_value
    assert varx_value == '3'

@pytest.mark.skipif(not haveIPython,
                    reason="Can't run variable tests without IPython console")
def test_dataframe_info(capsys):
    from IPython import get_ipython
    # Setup some different types
    get_ipython().run_cell('''
import pandas as pd
import numpy as np
ls = list([10, 20, 30, 40])
df = pd.DataFrame(ls)
se = pd.Series(ls)
np = np.array(ls)
obj = {}
''')
    vars = get_variables(capsys)
    df = get_variable_value(vars, 'df', capsys)
    se = get_variable_value(vars, 'se', capsys)
    np = get_variable_value(vars, 'np', capsys)
    ls = get_variable_value(vars, 'ls', capsys)
    obj = get_variable_value(vars, 'obj', capsys)
    assert df
    assert se
    assert np
    assert ls
    assert obj
    verify_dataframe_info(vars, 'df', capsys, True)
    verify_dataframe_info(vars, 'se', capsys, True)
    verify_dataframe_info(vars, 'np', capsys, True)
    verify_dataframe_info(vars, 'ls', capsys, True)
    verify_dataframe_info(vars, 'obj', capsys, False)

def verify_dataframe_info(vars, name, capsys, hasInfo):
    info = get_data_frame_info(vars, name, capsys)
    assert info
    assert 'columns' in info
    assert len(info['columns']) > 0 if hasInfo else True
    assert 'rowCount' in info
    assert info['rowCount'] > 0 if hasInfo else info['rowCount'] == 0

@pytest.mark.skipif(not haveIPython,
                    reason="Can't run variable tests without IPython console")
def test_dataframe_rows(capsys):
    from IPython import get_ipython
    # Setup some different types
    path = os.path.dirname(os.path.abspath(__file__))
    file = os.path.abspath(os.path.join(path, 'random.csv'))
    file = file.replace('\\', '\\\\')
    dfstr = 'import pandas as pd\r\ndf = pd.read_csv(\'{}\')'.format(file)
    get_ipython().run_cell(dfstr)
    vars = get_variables(capsys)
    df = get_variable_value(vars, 'df', capsys)
    assert df
    info = get_data_frame_info(vars, 'df', capsys)
    assert 'rowCount' in info
    assert info['rowCount'] == 6000
    rows = get_data_frame_rows(info, 100, 200, capsys)
    assert rows
    assert rows['data'][0]['+h2'] == 'Fy3 W[pMT['




# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import pytest
import os
from .scripts import (
    get_variable_value,
    get_variables,
    get_data_frame_info,
    get_data_frame_rows,
    check_for_ipython,
)

haveIPython = check_for_ipython()


@pytest.mark.skipif(
    not haveIPython, reason="Can't run variable tests without IPython console"
)
def test_variable_list(capsys):
    from IPython import get_ipython

    # Execute a single cell before we get the variables.
    get_ipython().run_cell("x = 3\r\ny = 4\r\nz=5")
    vars = get_variables(capsys)
    have_x = False
    have_y = False
    have_z = False
    for sub in vars:
        have_x |= sub["name"] == "x"
        have_y |= sub["name"] == "y"
        have_z |= sub["name"] == "z"
    assert have_x
    assert have_y
    assert have_z


@pytest.mark.skipif(
    not haveIPython, reason="Can't run variable tests without IPython console"
)
def test_variable_value(capsys):
    from IPython import get_ipython

    # Execute a single cell before we get the variables. This is the variable we'll look for.
    get_ipython().run_cell("x = 3")
    vars = get_variables(capsys)
    varx_value = get_variable_value(vars, "x", capsys)
    assert varx_value
    assert varx_value == "3"


@pytest.mark.skipif(
    not haveIPython, reason="Can't run variable tests without IPython console"
)
def test_dataframe_info(capsys):
    from IPython import get_ipython

    # Setup some different types
    get_ipython().run_cell(
        """
import pandas as pd
import numpy as np
ls = list([10, 20, 30, 40])
df = pd.DataFrame(ls)
se = pd.Series(ls)
np1 = np.array(ls)
np2 = np.array([[1, 2, 3], [4, 5, 6]])
dict1 = {'Name': 'Zara', 'Age': 7, 'Class': 'First'}
obj = {}
col = pd.Series(data=np.random.random_sample((7,))*100)
dfInit = {}
idx = pd.date_range('2007-01-01', periods=7, freq='M')
for i in range(30):
     dfInit[i] = col
dfInit['idx'] = idx
df2 = pd.DataFrame(dfInit).set_index('idx')
df3 = df2.iloc[:, [0,1]]
se2 = df2.loc[df2.index[0], :]
"""
    )
    vars = get_variables(capsys)
    df = get_variable_value(vars, "df", capsys)
    se = get_variable_value(vars, "se", capsys)
    np = get_variable_value(vars, "np1", capsys)
    np2 = get_variable_value(vars, "np2", capsys)
    ls = get_variable_value(vars, "ls", capsys)
    obj = get_variable_value(vars, "obj", capsys)
    df3 = get_variable_value(vars, "df3", capsys)
    se2 = get_variable_value(vars, "se2", capsys)
    dict1 = get_variable_value(vars, "dict1", capsys)
    assert df
    assert se
    assert np
    assert ls
    assert obj
    assert df3
    assert se2
    assert dict1
    verify_dataframe_info(vars, "df", "index", capsys, True)
    verify_dataframe_info(vars, "se", "index", capsys, True)
    verify_dataframe_info(vars, "np1", "index", capsys, True)
    verify_dataframe_info(vars, "ls", "index", capsys, True)
    verify_dataframe_info(vars, "np2", "index", capsys, True)
    verify_dataframe_info(vars, "obj", "index", capsys, False)
    verify_dataframe_info(vars, "df3", "idx", capsys, True)
    verify_dataframe_info(vars, "se2", "index", capsys, True)
    verify_dataframe_info(vars, "df2", "idx", capsys, True)
    verify_dataframe_info(vars, "dict1", "index", capsys, True)


def verify_dataframe_info(vars, name, indexColumn, capsys, hasInfo):
    info = get_data_frame_info(vars, name, capsys)
    assert info
    assert "columns" in info
    assert len(info["columns"]) > 0 if hasInfo else True
    assert "rowCount" in info
    if hasInfo:
        assert info["rowCount"] > 0
        assert info["indexColumn"]
        assert info["indexColumn"] == indexColumn


@pytest.mark.skipif(
    not haveIPython, reason="Can't run variable tests without IPython console"
)
def test_dataframe_rows(capsys):
    from IPython import get_ipython

    # Setup some different types
    path = os.path.dirname(os.path.abspath(__file__))
    file = os.path.abspath(os.path.join(path, "random.csv"))
    file = file.replace("\\", "\\\\")
    dfstr = "import pandas as pd\r\ndf = pd.read_csv('{}')".format(file)
    get_ipython().run_cell(dfstr)
    vars = get_variables(capsys)
    df = get_variable_value(vars, "df", capsys)
    assert df
    info = get_data_frame_info(vars, "df", capsys)
    assert "rowCount" in info
    assert info["rowCount"] == 6000
    rows = get_data_frame_rows(info, 100, 200, capsys)
    assert rows
    assert rows["data"][0]["+h2"] == "Fy3 W[pMT["
    get_ipython().run_cell(
        """
import pandas as pd
import numpy as np
ls = list([10, 20, 30, 40])
df = pd.DataFrame(ls)
se = pd.Series(ls)
np1 = np.array(ls)
np2 = np.array([[1, 2, 3], [4, 5, 6]])
obj = {}
"""
    )
    vars = get_variables(capsys)
    np2 = get_variable_value(vars, "np2", capsys)
    assert np2
    info = get_data_frame_info(vars, "np2", capsys)
    assert "rowCount" in info
    assert info["rowCount"] == 2
    rows = get_data_frame_rows(info, 0, 2, capsys)
    assert rows
    assert rows["data"][0]

# Query Jupyter server for the info about a dataframe
import json as _VSCODE_json
import pandas as _VSCODE_pd
import pandas.io.json as _VSCODE_pd_json
import builtins as _VSCODE_builtins
import vscodeDataFrameHelpers as _VSCODE_dataFrameHelpers

# Function to do our work. It will return the object
def _VSCODE_getDataFrameInfo(df):
    df = _VSCODE_dataFrameHelpers._VSCODE_convertToDataFrame(df)
    rowCount = _VSCODE_dataFrameHelpers._VSCODE_getRowCount(df)

    # If any rows, use pandas json to convert a single row to json. Extract
    # the column names and types from the json so we match what we'll fetch when
    # we ask for all of the rows
    if rowCount:
        try:
            row = df.iloc[0:1]
            json_row = _VSCODE_pd_json.to_json(None, row, date_format="iso")
            columnNames = list(_VSCODE_json.loads(json_row))
        except:
            columnNames = list(df)
    else:
        columnNames = list(df)

    # Compute the index column. It may have been renamed
    indexColumn = df.index.name if df.index.name else "index"
    columnTypes = _VSCODE_builtins.list(df.dtypes)

    # Make sure the index column exists
    if indexColumn not in columnNames:
        columnNames.insert(0, indexColumn)
        columnTypes.insert(0, "int64")

    # Then loop and generate our output json
    columns = []
    for n in _VSCODE_builtins.range(0, _VSCODE_builtins.len(columnNames)):
        column_type = columnTypes[n]
        column_name = str(columnNames[n])
        colobj = {}
        colobj["key"] = column_name
        colobj["name"] = column_name
        colobj["type"] = str(column_type)
        columns.append(colobj)

    # Save this in our target
    target = {}
    target["columns"] = columns
    target["indexColumn"] = indexColumn
    target["rowCount"] = rowCount

    # return our json object as a string
    return _VSCODE_json.dumps(target)

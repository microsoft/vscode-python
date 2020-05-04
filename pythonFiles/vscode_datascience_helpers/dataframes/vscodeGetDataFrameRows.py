# Query for the rows of a data frame
import pandas.io.json as _VSCODE_pd_json
import vscodeDataFrameHelpers as _VSCODE_dataFrameHelpers

# Function to retrieve a set of rows for a data frame
def _VSCODE_getDataFrameRows(df, start, end):
    df = _VSCODE_dataFrameHelpers._VSCODE_convertToDataFrame(df)

    # Turn into JSON using pandas. We use pandas because it's about 3 orders of magnitude faster to turn into JSON
    rows = df.iloc[start:end]
    return _VSCODE_pd_json.to_json(None, rows, orient="table", date_format="iso")

import pandas as _VSCODE_pd
import builtins as _VSCODE_builtins

# Function that converts the var passed in into a pandas data frame if possible
def _VSCODE_convertToDataFrame(df):
    if isinstance(df, list):
        df = _VSCODE_pd.DataFrame(df)
    elif isinstance(df, _VSCODE_pd.Series):
        df = _VSCODE_pd.Series.to_frame(df)
    elif isinstance(df, dict):
        df = _VSCODE_pd.Series(df)
        df = _VSCODE_pd.Series.to_frame(df)
    elif hasattr(df, "toPandas"):
        df = df.toPandas()
    else:
        """Disabling bandit warning for try, except, pass. We want to swallow all exceptions here to not crash on
        variable fetching"""
        try:
            temp = _VSCODE_pd.DataFrame(df)
            df = temp
        except:  # nosec
            pass
    return df


# Function to compute row count for a value
def _VSCODE_getRowCount(var):
    if hasattr(var, "shape"):
        try:
            # Get a bit more restrictive with exactly what we want to count as a shape, since anything can define it
            if isinstance(var.shape, tuple):
                return var.shape[0]
        except TypeError:
            return 0
    elif hasattr(var, "__len__"):
        try:
            return _VSCODE_builtins.len(var)
        except TypeError:
            return 0

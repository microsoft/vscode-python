# Query Jupyter server for defined variables list
# Tested on 2.7 and 3.6
from sys import getsizeof
import json

# who_ls is a Jupyter line magic to fetch currently defined vars
_VSCode_JupyterVars = %who_ls

print(json.dumps([{'name': var,
                   'type': type(eval(var)).__name__,
                   'size': getsizeof(var),
                   'expensive': True
                   } for var in _VSCode_JupyterVars]))

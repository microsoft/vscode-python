#Adds the virtual environment's executable path to json file

import json,sys
import os.path
key = sys.argv[1]

if os.path.isfile('$(ENV_PATHS_LOCATION)'):
    with open('$(ENV_PATHS_LOCATION)', 'r') as read_file:
        data = json.load(read_file)
else:
    with open('$(ENV_PATHS_LOCATION)', 'w+') as read_file:
        data = {}
with open('$(ENV_PATHS_LOCATION)', 'w') as outfile:
    data[key] = sys.executable
    json.dump(data, outfile, sort_keys=True, indent=4)

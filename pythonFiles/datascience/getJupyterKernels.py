# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import jupyter_client.kernelspec

specs = jupyter_client.kernelspec.KernelSpecManager().get_all_specs()
all_specs = {
    "kernelspecs": specs
}

sys.stdout.write(json.dumps(all_specs))
sys.stdout.flush()

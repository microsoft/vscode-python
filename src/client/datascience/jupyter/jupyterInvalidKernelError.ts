// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as localize from '../../common/utils/localize';
import { sendTelemetryEvent } from '../../telemetry';
import { Telemetry } from '../constants';
import { IJupyterKernelSpec } from '../types';
import { LiveKernelModel } from './kernels/types';

export class JupyterInvalidKernelError extends Error {
    constructor(private _kernelSpec: IJupyterKernelSpec | LiveKernelModel) {
        super(localize.DataScience.kernelInvalid().format(_kernelSpec.display_name || _kernelSpec.name));
        sendTelemetryEvent(Telemetry.KernelInvalid);
    }

    public get kernelSpec(): IJupyterKernelSpec | LiveKernelModel {
        return this._kernelSpec;
    }
}

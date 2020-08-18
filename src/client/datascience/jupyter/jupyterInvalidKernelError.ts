// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as localize from '../../common/utils/localize';
import { sendTelemetryEvent } from '../../telemetry';
import { Telemetry } from '../constants';
import { getDisplayNameOrNameOfKernelConnection } from './kernels/helpers';
import { KernelConnectionMetadata } from './kernels/types';

export class JupyterInvalidKernelError extends Error {
    constructor(public readonly kernelConnectionMetadata: KernelConnectionMetadata | undefined) {
        super(
            localize.DataScience.kernelInvalid().format(
                getDisplayNameOrNameOfKernelConnection(kernelConnectionMetadata)
            )
        );
        sendTelemetryEvent(Telemetry.KernelInvalid);
    }
}

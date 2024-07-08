// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { traceError } from '../../../../logging';
import { sendTelemetryEvent } from '../../../../telemetry';
import { EventName } from '../../../../telemetry/constants';

export type NativePythonTelemetry = MissingCondaEnvironments;

export type MissingCondaEnvironments = {
    event: 'MissingCondaEnvironments';
    data: {
        missingCondaEnvironments: {
            missing: number;
            envDirsNotFound?: number;
            userProvidedCondaExe?: boolean;
            rootPrefixNotFound?: boolean;
            condaPrefixNotFound?: boolean;
            condaManagerNotFound?: boolean;
            sysRcNotFound?: boolean;
            userRcNotFound?: boolean;
            otherRcNotFound?: boolean;
            missingEnvDirsFromSysRc?: number;
            missingEnvDirsFromUserRc?: number;
            missingEnvDirsFromOtherRc?: number;
            missingFromSysRcEnvDirs?: number;
            missingFromUserRcEnvDirs?: number;
            missingFromOtherRcEnvDirs?: number;
        };
    };
};

export function sendNativeTelemetry(data: NativePythonTelemetry): void {
    switch (data.event) {
        case 'MissingCondaEnvironments': {
            sendTelemetryEvent(
                EventName.NATIVE_FINDER_MISSING_CONDA_ENVS,
                undefined,
                data.data.missingCondaEnvironments,
            );
            break;
        }
        default: {
            traceError(`Unhandled Telemetry Event type ${data.event}`);
        }
    }
}

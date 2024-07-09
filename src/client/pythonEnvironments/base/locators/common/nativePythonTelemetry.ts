// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { traceError } from '../../../../logging';
import { sendTelemetryEvent } from '../../../../telemetry';
import { EventName } from '../../../../telemetry/constants';

export type NativePythonTelemetry = MissingCondaEnvironments | MissingPoetryEnvironments;

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

export type MissingPoetryEnvironments = {
    event: 'MissingPoetryEnvironments';
    data: {
        missingPoetryEnvironments: {
            missing: number;
            missingInPath: number;
            userProvidedPoetryExe?: boolean;
            poetryExeNotFound?: boolean;
            globalConfigNotFound?: boolean;
            cacheDirNotFound?: boolean;
            cacheDirIsDifferent?: boolean;
            virtualenvsPathNotFound?: boolean;
            virtualenvsPathIsDifferent?: boolean;
            inProjectIsDifferent?: boolean;
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
        case 'MissingPoetryEnvironments': {
            sendTelemetryEvent(
                EventName.NATIVE_FINDER_MISSING_POETRY_ENVS,
                undefined,
                data.data.missingPoetryEnvironments,
            );
            break;
        }
        default: {
            traceError(`Unhandled Telemetry Event type ${JSON.stringify(data)}`);
        }
    }
}

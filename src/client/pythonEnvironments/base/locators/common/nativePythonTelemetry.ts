// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { traceError } from '../../../../logging';
import { sendTelemetryEvent } from '../../../../telemetry';
import { EventName } from '../../../../telemetry/constants';

export type NativePythonTelemetry = MissingCondaEnvironments | MissingPoetryEnvironments | RefreshPerformance;

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

export type RefreshPerformance = {
    event: 'RefreshPerformance';
    data: {
        refreshPerformance: {
            total: number;
            breakdown: {
                Locators: number;
                Path: number;
                GlobalVirtualEnvs: number;
                Workspaces: number;
            };
            locators: {
                Conda?: number;
                Homebrew?: number;
                LinuxGlobalPython?: number;
                MacCmdLineTools?: number;
                MacPythonOrg?: number;
                MacXCode?: number;
                PipEnv?: number;
                Poetry?: number;
                PyEnv?: number;
                Venv?: number;
                VirtualEnv?: number;
                VirtualEnvWrapper?: number;
                WindowsRegistry?: number;
                WindowsStore?: number;
            };
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
        case 'RefreshPerformance': {
            sendTelemetryEvent(EventName.NATIVE_FINDER_PERF, undefined, {
                duration: data.data.refreshPerformance.total,
                breakdownGlobalVirtualEnvs: data.data.refreshPerformance.breakdown.GlobalVirtualEnvs,
                breakdownLocators: data.data.refreshPerformance.breakdown.Locators,
                breakdownPath: data.data.refreshPerformance.breakdown.Path,
                breakdownWorkspaces: data.data.refreshPerformance.breakdown.Workspaces,
                locatorConda: data.data.refreshPerformance.locators.Conda,
                locatorHomebrew: data.data.refreshPerformance.locators.Homebrew,
                locatorLinuxGlobalPython: data.data.refreshPerformance.locators.LinuxGlobalPython,
                locatorMacCmdLineTools: data.data.refreshPerformance.locators.MacCmdLineTools,
                locatorMacPythonOrg: data.data.refreshPerformance.locators.MacPythonOrg,
                locatorMacXCode: data.data.refreshPerformance.locators.MacXCode,
                locatorPipEnv: data.data.refreshPerformance.locators.PipEnv,
                locatorPoetry: data.data.refreshPerformance.locators.Poetry,
                locatorPyEnv: data.data.refreshPerformance.locators.PyEnv,
                locatorVenv: data.data.refreshPerformance.locators.Venv,
                locatorVirtualEnv: data.data.refreshPerformance.locators.VirtualEnv,
                locatorVirtualEnvWrapper: data.data.refreshPerformance.locators.VirtualEnvWrapper,
                locatorWindowsRegistry: data.data.refreshPerformance.locators.WindowsRegistry,
                locatorWindowsStore: data.data.refreshPerformance.locators.WindowsStore,
            });
            break;
        }
        default: {
            traceError(`Unhandled Telemetry Event type ${JSON.stringify(data)}`);
        }
    }
}

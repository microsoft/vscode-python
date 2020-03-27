// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IWorkspaceService } from '../common/application/types';
import { IFileSystem } from '../common/platform/types';
import { Resource } from '../common/types';
import { SystemVariables } from '../common/variables/systemVariables';

import { sendTelemetryEvent } from '.';
import { EventName } from './constants';

export namespace EnvFileTelemetry {
    let _defaultEnvFileSetting: string | undefined;
    let envFileTelemetrySent = false;

    export function sendTelemetry(hasCustomEnvPath: boolean = false) {
        sendTelemetryEvent(EventName.ENVFILE_WORKSPACE, undefined, { hasCustomEnvPath });

        envFileTelemetrySent = true;
    }

    export function shouldSendTelemetry(): boolean {
        return !envFileTelemetrySent;
    }

    export function shouldSendSettingTelemetry(workspaceService: IWorkspaceService, envFileSetting?: string): boolean {
        // Trick to force shouldSendTelemetry to use the stubs in the unit tests.
        return (
            // tslint:disable-next-line: no-unnecessary-qualifier
            EnvFileTelemetry.shouldSendTelemetry() &&
            // tslint:disable-next-line: no-unnecessary-qualifier
            envFileSetting !== EnvFileTelemetry.defaultEnvFileSetting(workspaceService)
        );
    }

    export function defaultEnvFileSetting(workspaceService: IWorkspaceService) {
        if (!_defaultEnvFileSetting) {
            const section = workspaceService.getConfiguration('python');
            _defaultEnvFileSetting = section.inspect<string>('envFile')!.defaultValue;
        }

        return _defaultEnvFileSetting;
    }

    export async function defaultPathEnvFileExists(
        fileSystem: IFileSystem,
        workspaceService: IWorkspaceService,
        resource: Resource
    ): Promise<boolean> {
        const systemVariables = new SystemVariables(resource, undefined, workspaceService);
        const envFilePath = systemVariables.resolveAny(defaultEnvFileSetting(workspaceService))!;

        return fileSystem.fileExists(envFilePath);
    }

    // Reset global state for tests.
    export namespace EnvFileTelemetryTests {
        export function resetState() {
            _defaultEnvFileSetting = undefined;
            envFileTelemetrySent = false;
        }
    }
}

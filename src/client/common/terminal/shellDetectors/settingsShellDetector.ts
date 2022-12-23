// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Terminal } from 'vscode';
import { traceVerbose } from '../../../logging';
import { IWorkspaceService } from '../../application/types';
import { IPlatformService } from '../../platform/types';
import { OSType } from '../../utils/platform';
import { ShellIdentificationTelemetry, TerminalShellType } from '../types';
import { BaseShellDetector } from './baseShellDetector';

/**
 * Identifies the shell based on the user settings.
 *
 * @export
 * @class SettingsShellDetector
 * @extends {BaseShellDetector}
 */
@injectable()
export class SettingsShellDetector extends BaseShellDetector {
    constructor(
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService,
        @inject(IPlatformService) private readonly platform: IPlatformService,
    ) {
        super(2);
    }
    public getTerminalShellPath(): string | undefined {
        let osSection = '';
        switch (this.platform.osType) {
            case OSType.Windows: {
                osSection = 'windows';
                break;
            }
            case OSType.OSX: {
                osSection = 'osx';
                break;
            }
            case OSType.Linux: {
                osSection = 'linux';
                break;
            }
            default: {
                return '';
            }
        }
        const legacyShell = this.workspace.getConfiguration('terminal.integrated.shell').get<string>(osSection);
        if (legacyShell) return legacyShell;
        const profiles = this.workspace
            .getConfiguration('terminal.integrated.profiles')
            .get<{ [key: string]: any }>(osSection);
        const defaultProfile = this.workspace
            .getConfiguration('terminal.integrated.defaultProfile')
            .get<string>(osSection);
        if (profiles && defaultProfile) return profiles[defaultProfile]?.path;
    }
    public identify(
        telemetryProperties: ShellIdentificationTelemetry,
        _terminal?: Terminal,
    ): TerminalShellType | undefined {
        const shellPath = this.getTerminalShellPath();
        telemetryProperties.hasCustomShell = !!shellPath;
        const shell = shellPath ? this.identifyShellFromShellPath(shellPath) : TerminalShellType.other;

        if (shell !== TerminalShellType.other) {
            telemetryProperties.shellIdentificationSource = 'environment';
        } else {
            telemetryProperties.shellIdentificationSource = 'settings';
        }
        traceVerbose(`Shell path from user settings '${shellPath}'`);
        return shell;
    }
}

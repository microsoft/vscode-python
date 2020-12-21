// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject } from 'inversify';
import { Terminal } from 'vscode';
import { IApplicationEnvironment } from '../../application/types';
import { traceVerbose } from '../../logger';
import { ShellIdentificationTelemetry, TerminalShellType } from '../types';
import { BaseShellDetector } from './baseShellDetector';

/**
 * Identifies the shell, based on the VSC Environment API.
 *
 * @export
 * @class VSCEnvironmentShellDetector
 * @extends {BaseShellDetector}
 */
export class VSCEnvironmentShellDetector extends BaseShellDetector {
    constructor(@inject(IApplicationEnvironment) private readonly appEnv: IApplicationEnvironment) {
        super(3);
    }
    public identify(
        telemetryProperties: ShellIdentificationTelemetry,
        _terminal?: Terminal,
    ): TerminalShellType | undefined {
        if (!this.appEnv.shell) {
            return;
        }
        const shell = this.identifyShellFromShellPath(this.appEnv.shell);
        traceVerbose(`Terminal shell path '${this.appEnv.shell}' identified as shell '${shell}'`);
        telemetryProperties.shellIdentificationSource =
            shell === TerminalShellType.other ? telemetryProperties.shellIdentificationSource : 'vscode';
        return shell;
    }
}

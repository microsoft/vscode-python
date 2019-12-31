// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, multiInject } from 'inversify';
import { Terminal } from 'vscode';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import '../extensions';
import { traceVerbose } from '../logger';
import { IPlatformService } from '../platform/types';
import { OSType } from '../utils/platform';
import { IShellDetector, ShellIdentificationTelemetry, TerminalShellType } from './types';

const defaultOSShells = {
    [OSType.Linux]: TerminalShellType.bash,
    [OSType.OSX]: TerminalShellType.bash,
    [OSType.Windows]: TerminalShellType.commandPrompt,
    [OSType.Unknown]: TerminalShellType.other
};

@injectable()
export class ShellDetector {
    constructor(@inject(IPlatformService) private readonly platform: IPlatformService, @multiInject(IShellDetector) private readonly shellDetectors: IShellDetector[]) {}
    /**
     * Logic is as follows:
     * 1. Try to identify the type of the shell based on the name of the terminal.
     * 2. Try to identify the type of the shell based on the usettigs in VSC.
     * 3. Try to identify the type of the shell based on the user environment (OS).
     * 4. If all else fail, use defaults hardcoded (cmd for windows, bash for linux & mac).
     * More information here See solution here https://github.com/microsoft/vscode/issues/74233#issuecomment-497527337
     *
     * @param {Terminal} [terminal]
     * @returns {TerminalShellType}
     * @memberof TerminalHelper
     */
    public identifyTerminalShell(terminal?: Terminal): TerminalShellType {
        let shell: TerminalShellType | undefined;
        const telemetryProperties: ShellIdentificationTelemetry = {
            failed: true,
            shellIdentificationSource: 'default',
            terminalProvided: !!terminal,
            hasCustomShell: undefined,
            hasShellInEnv: undefined
        };

        // Sort in order of priority and then identify the shell.
        const shellDetectors = this.shellDetectors.slice();
        shellDetectors.sort((a, b) => (a.priority < b.priority ? 1 : 0));

        for (const detector of shellDetectors) {
            shell = detector.identify(telemetryProperties, terminal);
            traceVerbose(`${detector}. Shell identified as ${shell} ${terminal ? `(Terminal name is ${terminal.name})` : ''}`);
            if (shell && shell !== TerminalShellType.other) {
                break;
            }
        }

        // This information is useful in determining how well we identify shells on users machines.
        // This impacts executing code in terminals and activation of environments in terminal.
        // So, the better this works, the better it is for the user.
        sendTelemetryEvent(EventName.TERMINAL_SHELL_IDENTIFICATION, undefined, telemetryProperties);
        traceVerbose(`Shell identified as '${shell}'`);

        // If we could not identify the shell, use the defaults.
        if (shell === undefined || shell === TerminalShellType.other) {
            traceVerbose('Using default OS shell');
            shell = defaultOSShells[this.platform.osType];
        }
        return shell;
    }
}

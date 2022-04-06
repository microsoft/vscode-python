// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { traceLog } from '../../logging';
import { IWorkspaceService } from '../application/types';
import { isCI, isTestExecution } from '../constants';
import { Logging } from '../utils/localize';
import { getOSType, getUserHomeDir, OSType } from '../utils/platform';
import { IProcessLogger, SpawnOptions } from './types';

@injectable()
export class ProcessLogger implements IProcessLogger {
    constructor(@inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService) {}

    public logProcess(fileOrCommand: string, args?: string[], options?: SpawnOptions) {
        if (!isTestExecution() && isCI && process.env.UITEST_DISABLE_PROCESS_LOGGING) {
            // Added to disable logging of process execution commands during UI Tests.
            // Used only during UI Tests (hence this setting need not be exposed as a valid setting).
            return;
        }
        let command = args
            ? [fileOrCommand, ...args].map((e) => e.trimQuotes().toCommandArgumentForPythonExt()).join(' ')
            : fileOrCommand;
        const info = [`> ${this.getDisplayCommands(command)}`];
        if (options && options.cwd) {
            info.push(`${Logging.currentWorkingDirectory()} ${this.getDisplayCommands(options.cwd)}`);
        }

        info.forEach((line) => {
            traceLog(line);
        });
    }

    private getDisplayCommands(command: string): string {
        if (this.workspaceService.workspaceFolders && this.workspaceService.workspaceFolders.length === 1) {
            command = replaceMatchesWithCharacter(command, this.workspaceService.workspaceFolders[0].uri.fsPath, '.');
        }
        const home = getUserHomeDir();
        if (home) {
            command = replaceMatchesWithCharacter(command, home, '~');
        }
        return command;
    }
}

/**
 * Finds case insensitive matches in the original string and replaces it with character provided.
 */
function replaceMatchesWithCharacter(original: string, match: string, character: string): string {
    // Backslashes have special meaning in regexes, we need an extra backlash so
    // it's not considered special. Also match both forward and backward slash
    // versions of 'match' for Windows.
    const pattern = match.replaceAll('\\', getOSType() === OSType.Windows ? '(\\\\|/)' : '\\\\');
    let regex = new RegExp(pattern, 'ig');
    return original.replace(regex, character);
}

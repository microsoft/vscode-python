// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as os from 'os';
import { AttachProcess } from './process';
import { IAttachProcess, ProcessListCommand } from './types';

export namespace PsProcessParser {
    const secondColumnCharacters = 50;
    const commColumnTitle = ''.padStart(secondColumnCharacters, 'a');

    // the BSD version of ps uses '-c' to have 'comm' only output the executable name and not
    // the full path. The Linux version of ps has 'comm' to only display the name of the executable
    // Note that comm on Linux systems is truncated to 16 characters:
    // https://bugzilla.redhat.com/show_bug.cgi?id=429565
    // Since 'args' contains the full path to the executable, even if truncated, searching will work as desired.
    export const psLinuxCommand: ProcessListCommand = {
        command: 'ps',
        args: ['axww', '-o', `pid=,comm=${commColumnTitle},args=`]
    };
    export const psDarwinCommand: ProcessListCommand = {
        command: 'ps',
        args: ['axww', '-o', `pid=,comm=${commColumnTitle},args=`, '-c']
    };

    export function parseProcessesFromPs(processes: string): IAttachProcess[] {
        const lines: string[] = processes.split(os.EOL);
        return parseProcessesFromPsArray(lines);
    }

    function parseProcessesFromPsArray(processArray: string[]): IAttachProcess[] {
        const processEntries: IAttachProcess[] = [];

        // lines[0] is the header of the table
        for (let i = 1; i < processArray.length; i += 1) {
            const line = processArray[i];
            if (!line) {
                continue;
            }

            const processEntry = parseLineFromPs(line);
            if (processEntry) {
                processEntries.push(processEntry);
            }
        }

        return processEntries;
    }

    function parseLineFromPs(line: string): IAttachProcess | undefined {
        // Explanation of the regex:
        //   - any leading whitespace
        //   - PID
        //   - whitespace
        //   - executable name --> this is PsAttachItemsProvider.secondColumnCharacters - 1 because ps reserves one character
        //     for the whitespace separator
        //   - whitespace
        //   - args (might be empty)
        const psEntry: RegExp = new RegExp(`^\\s*([0-9]+)\\s+(.{${secondColumnCharacters - 1}})\\s+(.*)$`);
        const matches = psEntry.exec(line);

        if (matches?.length === 4) {
            const pid = matches[1].trim();
            const executable = matches[2].trim();
            const cmdline = matches[3].trim();

            return new AttachProcess(executable, pid, cmdline);
        }
    }
}

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IPlatformService } from '../../../common/platform/types';
import { IProcessServiceFactory } from '../../../common/process/types';
import { AttachProcess as AttachProcessLocalization } from '../../../common/utils/localize';
import { PsProcessParser } from './psProcessParser';
import { IAttachItem, IAttachProcessProvider, ProcessListCommand } from './types';
import { WmicProcessParser } from './wmicProcessParser';

@injectable()
export class AttachProcessProvider implements IAttachProcessProvider {
    constructor(
        @inject(IPlatformService) private readonly platformService: IPlatformService,
        @inject(IProcessServiceFactory) private readonly processServiceFactory: IProcessServiceFactory
    ) {}

    public getAttachItems(): Promise<IAttachItem[]> {
        return this._getInternalProcessEntries().then(processEntries => {
            processEntries.sort((a, b) => {
                const compareStrings = (aLower: string, bLower: string): number => {
                    if (aLower === bLower) {
                        return 0;
                    }

                    // localeCompare is significantly slower than < and > (2000 ms vs 80 ms for 10,000 elements)
                    // We can change to localeCompare if this becomes an issue
                    return aLower < bLower ? -1 : 1;
                };
                const aLabel = a.label.toLowerCase();
                const bLabel = b.label.toLowerCase();
                const aPython = aLabel.startsWith('python');
                const bPython = bLabel.startsWith('python');

                if (aPython || bPython) {
                    if (aPython && !bPython) {
                        return -1;
                    }
                    if (bPython && !aPython) {
                        return 1;
                    }

                    const aCmdLine = a.detail!.toLowerCase();
                    const bCmdLine = b.detail!.toLowerCase();

                    return aPython ? compareStrings(aCmdLine, bCmdLine) : compareStrings(bCmdLine, aCmdLine);
                }

                return compareStrings(aLabel, bLabel);
            });

            return processEntries;
        });
    }

    public async _getInternalProcessEntries(): Promise<IAttachItem[]> {
        let processCmd: ProcessListCommand;
        if (this.platformService.isMac) {
            processCmd = PsProcessParser.psDarwinCommand;
        } else if (this.platformService.isLinux) {
            processCmd = PsProcessParser.psLinuxCommand;
        } else if (this.platformService.isWindows) {
            processCmd = WmicProcessParser.wmicCommand;
        } else {
            throw new Error(AttachProcessLocalization.unsupportedOS().format(this.platformService.osType));
        }

        const processService = await this.processServiceFactory.create();
        const output = await processService.exec(processCmd.command, processCmd.args, { throwOnStdErr: true });

        return this.platformService.isWindows ? WmicProcessParser.parseProcesses(output.stdout) : PsProcessParser.parseProcesses(output.stdout);
    }
}

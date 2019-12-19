// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IApplicationShell, ICommandManager } from '../../../common/application/types';
import { IPlatformService } from '../../../common/platform/types';
import { IProcessServiceFactory } from '../../../common/process/types';
import { IDisposableRegistry } from '../../../common/types';
import { AttachProcess as AttachProcessLocalization } from '../../../common/utils/localize';
import { BaseAttachProcessProvider } from './baseProvider';
import { PsProcessParser } from './psProcessParser';
import { IAttachItem, ProcessListCommand } from './types';

@injectable()
export class PsAttachProcessProvider extends BaseAttachProcessProvider {
    constructor(
        @inject(IApplicationShell) applicationShell: IApplicationShell,
        @inject(ICommandManager) commandManager: ICommandManager,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
        @inject(IPlatformService) private readonly platformService: IPlatformService,
        @inject(IProcessServiceFactory) private readonly processServiceFactory: IProcessServiceFactory
    ) {
        super(applicationShell, commandManager, disposableRegistry);
    }

    // Perf numbers:
    // OS X 10.10
    // | # of processes | Time (ms) |
    // |----------------+-----------|
    // |            272 |        52 |
    // |            296 |        49 |
    // |            384 |        53 |
    // |            784 |       116 |
    //
    // Ubuntu 16.04
    // | # of processes | Time (ms) |
    // |----------------+-----------|
    // |            232 |        26 |
    // |            336 |        34 |
    // |            736 |        62 |
    // |           1039 |       115 |
    // |           1239 |       182 |

    // ps outputs as a table. With the option "ww", ps will use as much width as necessary.
    // However, that only applies to the right-most column. Here we use a hack of setting
    // the column header to 50 a's so that the second column will have at least that many
    // characters. 50 was chosen because that's the maximum length of a "label" in the
    // QuickPick UI in VS Code.

    public async _getInternalProcessEntries(): Promise<IAttachItem[]> {
        let processCmd: ProcessListCommand;
        if (this.platformService.isMac) {
            processCmd = PsProcessParser.psDarwinCommand;
        } else if (this.platformService.isLinux) {
            processCmd = PsProcessParser.psLinuxCommand;
        } else {
            throw new Error(AttachProcessLocalization.unsupportedOS().format(this.platformService.osType));
        }

        const processService = await this.processServiceFactory.create();
        const output = await processService.exec(processCmd.command, processCmd.args, { throwOnStdErr: true });

        return PsProcessParser.parseProcessesFromPs(output.stdout);
    }
}

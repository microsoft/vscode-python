// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';

import { traceError } from '../../common/logger';
import { noop } from '../../common/utils/misc';
import { Identifiers } from '../constants';
import { ICell, ICellHashLogger, ICellHashProvider } from '../types';
import { CellHashProvider } from './cellhashprovider';

// This class provides hashes for debugging jupyter cells. Call getHashes just before starting debugging to compute all of the
// hashes for cells.
@injectable()
export class CellHashLogger implements ICellHashLogger {
    constructor(@inject(ICellHashProvider) private provider: ICellHashProvider) {}

    public async preExecute(cell: ICell, silent: boolean): Promise<void> {
        const providerObj: CellHashProvider = this.provider as CellHashProvider;

        try {
            if (!silent) {
                // Don't log empty cells
                const stripped = providerObj.extractExecutableLines(cell);
                if (stripped.length > 0 && stripped.find((s) => s.trim().length > 0)) {
                    // When the user adds new code, we know the execution count is increasing
                    providerObj.incExecutionCount();

                    // Skip hash on unknown file though
                    if (cell.file !== Identifiers.EmptyFileName) {
                        await providerObj.addCellHash(cell, providerObj.getExecutionCount());
                    }
                }
            }
        } catch (exc) {
            // Don't let exceptions in a preExecute mess up normal operation
            traceError(exc);
        }
    }

    public async postExecute(_cell: ICell, _silent: boolean): Promise<void> {
        noop();
    }

    public getCellHashProvider(): ICellHashProvider {
        return this.provider;
    }
}

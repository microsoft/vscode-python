// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri, CancellationToken, Range, Position } from 'vscode';
import { traceError } from '../../common/logger';
import { symbolProvider } from '../../common/process/internal/scripts';
import { IPythonExecutionFactory } from '../../common/process/types';
import { ITestRangeProvider } from './types';

type RawSymbol = { namespace: string; name: string; range: Range };

export class TestRangeProvider implements ITestRangeProvider {
    constructor(private readonly pythonExecFactory: IPythonExecutionFactory) {}

    public async getRange(
        testFile: Uri,
        testNames: string[],
        token?: CancellationToken,
    ): Promise<(Range | undefined)[]> {
        const symbols = await this.getSymbolsData(testFile, token);
        const ranges: (Range | undefined)[] = testNames.map((testName) => {
            const symbol = symbols.find((s) => s.name === testName);
            if (symbol) {
                return new Range(
                    new Position(symbol.range.start.line, symbol.range.start.character),
                    new Position(symbol.range.end.line, symbol.range.end.character),
                );
            }
            return undefined;
        });

        return ranges;
    }

    private async getSymbolsData(testFile: Uri, token?: CancellationToken): Promise<RawSymbol[]> {
        const args = symbolProvider(testFile.fsPath);
        const pythonService = await this.pythonExecFactory.create({ resource: testFile });
        const proc = await pythonService.exec(args, { throwOnStdErr: true, token });
        try {
            return (JSON.parse(proc.stdout) as unknown) as RawSymbol[];
        } catch (ex) {
            traceError('Test Location [error]: ', ex);
        }
        return [];
    }
}

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { CancellationTokenSource, Range, SymbolInformation, SymbolKind, TextEditorRevealType, Uri } from 'vscode';
import { traceError } from '../../common/logger';
import { swallowExceptions } from '../../common/utils/decorators';
import { captureTelemetry } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { ITestCollectionStorageService, TestFunction } from '../common/types';
import { ITestCodeNavigator, ITestNavigatorHelper } from './types';

@injectable()
export class TestFunctionCodeNavigator implements ITestCodeNavigator {
    private cancellationToken?: CancellationTokenSource;
    constructor(
        @inject(ITestNavigatorHelper) private readonly helper: ITestNavigatorHelper,
        @inject(ITestCollectionStorageService) private readonly storage: ITestCollectionStorageService
    ) {}
    @swallowExceptions('Navigate to test function')
    @captureTelemetry(EventName.UNITTEST_NAVIGATE_TEST_FUNCTION, undefined, true)
    public async navigateTo(resource: Uri, fn: TestFunction): Promise<void> {
        if (this.cancellationToken) {
            this.cancellationToken.cancel();
        }
        const item = this.storage.findFlattendTestFunction(resource, fn);
        if (!item) {
            throw new Error('Flattend test function not found');
        }
        this.cancellationToken = new CancellationTokenSource();
        const [doc, editor] = await this.helper.openFile(Uri.file(item.parentTestFile.fullPath));
        let range: Range | undefined;
        if (item.testFunction.line) {
            range = new Range(item.testFunction.line, 0, item.testFunction.line + 1, 0);
        } else {
            const predicate = (s: SymbolInformation) => s.name === item.testFunction.name && (s.kind === SymbolKind.Method || s.kind === SymbolKind.Function);
            const symbol = await this.helper.findSymbol(doc, predicate, this.cancellationToken.token);
            range = symbol ? symbol.location.range : undefined;
        }
        if (!range) {
            traceError('Unable to navigate to test function', new Error('Test Function not found'));
            return;
        }
        editor.revealRange(range, TextEditorRevealType.Default);
    }
}

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { CancellationTokenSource, Range, SymbolInformation, SymbolKind, TextEditorRevealType, Uri } from 'vscode';
import { IDocumentManager } from '../../common/application/types';
import { traceError } from '../../common/logger';
import { swallowExceptions } from '../../common/utils/decorators';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { ITestCollectionStorageService, TestSuite } from '../common/types';
import { ITestCodeNavigator, ITestNavigatorHelper } from './types';

@injectable()
export class TestSuiteCodeNavigator implements ITestCodeNavigator {
    private cancellationToken?: CancellationTokenSource;
    constructor(
        @inject(ITestNavigatorHelper) private readonly helper: ITestNavigatorHelper,
        @inject(IDocumentManager) private readonly docManager: IDocumentManager,
        @inject(ITestCollectionStorageService) private readonly storage: ITestCollectionStorageService,
    ) {}
    @swallowExceptions('Navigate to test suite')
    @captureTelemetry(EventName.UNITTEST_NAVIGATE, { bySuite: true }, true) // For measuring execution time.
    public async navigateTo(resource: Uri, suite: TestSuite, focus: boolean = true): Promise<void> {
        sendTelemetryEvent(EventName.UNITTEST_NAVIGATE, undefined, { focus_code: focus, bySuite: true });
        if (this.cancellationToken) {
            this.cancellationToken.cancel();
        }
        const item = this.storage.findFlattendTestSuite(resource, suite);
        if (!item) {
            throw new Error('Flattened test suite not found');
        }
        this.cancellationToken = new CancellationTokenSource();
        const [doc, editor] = await this.helper.openFile(Uri.file(item.parentTestFile.fullPath));
        let range: Range | undefined;
        if (item.testSuite.line) {
            range = new Range(item.testSuite.line, 0, item.testSuite.line, 0);
        } else {
            const predicate = (s: SymbolInformation) => s.name === item.testSuite.name && s.kind === SymbolKind.Class;
            const symbol = await this.helper.findSymbol(doc, predicate, this.cancellationToken.token);
            range = symbol ? symbol.location.range : undefined;
        }
        if (!range) {
            traceError('Unable to navigate to test suite', new Error('Test Suite not found'));
            return;
        }
        if (focus) {
            range = new Range(range.start.line, range.start.character, range.start.line, range.start.character);
            await this.docManager.showTextDocument(doc, { preserveFocus: false, selection: range });
        } else {
            editor.revealRange(range, TextEditorRevealType.Default);
        }
    }
}

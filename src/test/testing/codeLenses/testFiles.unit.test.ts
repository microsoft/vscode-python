// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert, expect } from 'chai';
import { mock } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { DocumentSymbolProvider, EventEmitter, Uri } from 'vscode';
import { IWorkspaceService } from '../../../client/common/application/types';
import { IFileSystem } from '../../../client/common/platform/types';
import { IServiceContainer } from '../../../client/ioc/types';
import { LanguageServerSymbolProvider } from '../../../client/providers/symbolProvider';
import { TestFileCodeLensProvider } from '../../../client/testing/codeLenses/testFiles';
import { ITestCollectionStorageService } from '../../../client/testing/common/types';

suite('Code lenses - Test files', () => {
    let testCollectionStorage: typemoq.IMock<ITestCollectionStorageService>;
    let workspaceService: typemoq.IMock<IWorkspaceService>;
    let fileSystem: typemoq.IMock<IFileSystem>;
    let serviceContainer: typemoq.IMock<IServiceContainer>;
    let symbolProvider: DocumentSymbolProvider;
    let onDidChange: EventEmitter<void>;
    let codeLensProvider: TestFileCodeLensProvider;
    setup(() => {
        workspaceService = typemoq.Mock.ofType<IWorkspaceService>();
        fileSystem = typemoq.Mock.ofType<IFileSystem>();
        testCollectionStorage = typemoq.Mock.ofType<ITestCollectionStorageService>();
        serviceContainer = typemoq.Mock.ofType<IServiceContainer>();
        symbolProvider = mock(LanguageServerSymbolProvider);
        onDidChange = new EventEmitter<void>();
        serviceContainer
            .setup((c) => c.get(typemoq.It.isValue(IWorkspaceService)))
            .returns(() => workspaceService.object);
        serviceContainer.setup((c) => c.get(typemoq.It.isValue(IFileSystem))).returns(() => fileSystem.object);
        codeLensProvider = new TestFileCodeLensProvider(
            onDidChange,
            symbolProvider,
            testCollectionStorage.object,
            serviceContainer.object,
        );
    });

    teardown(() => {
        onDidChange.dispose();
    });

    test('Function getTestFileWhichNeedsCodeLens() returns `undefined` if there are no workspace corresponding to document', async () => {
        const document = {
            uri: Uri.file('path/to/document'),
        };
        workspaceService
            .setup((w) => w.getWorkspaceFolder(document.uri))
            .returns(() => undefined)
            .verifiable(typemoq.Times.once());
        testCollectionStorage
            .setup((w) => w.getTests(typemoq.It.isAny()))
            .returns(() => undefined)
            .verifiable(typemoq.Times.never());
        const files = codeLensProvider.getTestFileWhichNeedsCodeLens(document as any);
        expect(files).to.equal(undefined, 'No files should be returned');
        workspaceService.verifyAll();
        testCollectionStorage.verifyAll();
    });

    test('Function getTestFileWhichNeedsCodeLens() returns `undefined` if test storage is empty', async () => {
        const document = {
            uri: Uri.file('path/to/document'),
        };
        const workspaceUri = Uri.file('path/to/workspace');
        const workspace = { uri: workspaceUri };
        workspaceService
            .setup((w) => w.getWorkspaceFolder(document.uri))
            .returns(() => workspace as any)
            .verifiable(typemoq.Times.once());
        testCollectionStorage
            .setup((w) => w.getTests(workspaceUri))
            .returns(() => undefined)
            .verifiable(typemoq.Times.once());
        const files = codeLensProvider.getTestFileWhichNeedsCodeLens(document as any);
        expect(files).to.equal(undefined, 'No files should be returned');
        workspaceService.verifyAll();
        testCollectionStorage.verifyAll();
    });

    test('Function getTestFileWhichNeedsCodeLens() returns `undefined` if tests returned from storage does not contain document', async () => {
        const document = {
            uri: Uri.file('path/to/document5'),
        };
        const workspaceUri = Uri.file('path/to/workspace');
        const workspace = { uri: workspaceUri };
        const tests = {
            testFiles: [
                {
                    fullPath: 'path/to/document1',
                },
                {
                    fullPath: 'path/to/document2',
                },
            ],
        };
        workspaceService
            .setup((w) => w.getWorkspaceFolder(document.uri))
            .returns(() => workspace as any)
            .verifiable(typemoq.Times.once());
        testCollectionStorage
            .setup((w) => w.getTests(workspaceUri))
            .returns(() => tests as any)
            .verifiable(typemoq.Times.once());
        fileSystem.setup((f) => f.arePathsSame('path/to/document1', 'path/to/document5')).returns(() => false);
        fileSystem.setup((f) => f.arePathsSame('path/to/document2', 'path/to/document5')).returns(() => false);
        const files = codeLensProvider.getTestFileWhichNeedsCodeLens(document as any);
        expect(files).to.equal(undefined, 'No files should be returned');
        workspaceService.verifyAll();
        testCollectionStorage.verifyAll();
    });

    test('Function getTestFileWhichNeedsCodeLens() returns test file if tests returned from storage contains document', async () => {
        const document = {
            uri: Uri.file('path/to/document2'),
        };
        const workspaceUri = Uri.file('path/to/workspace');
        const workspace = { uri: workspaceUri };
        const testFile2 = {
            fullPath: Uri.file('path/to/document2').fsPath,
        };
        const tests = {
            testFiles: [
                {
                    fullPath: Uri.file('path/to/document1').fsPath,
                },
                testFile2,
            ],
        };
        workspaceService
            .setup((w) => w.getWorkspaceFolder(typemoq.It.isValue(document.uri)))
            .returns(() => workspace as any)
            .verifiable(typemoq.Times.once());
        testCollectionStorage
            .setup((w) => w.getTests(typemoq.It.isValue(workspaceUri)))
            .returns(() => tests as any)
            .verifiable(typemoq.Times.once());
        fileSystem
            .setup((f) => f.arePathsSame(Uri.file('/path/to/document1').fsPath, Uri.file('/path/to/document2').fsPath))
            .returns(() => false);
        fileSystem
            .setup((f) => f.arePathsSame(Uri.file('/path/to/document2').fsPath, Uri.file('/path/to/document2').fsPath))
            .returns(() => true);
        const files = codeLensProvider.getTestFileWhichNeedsCodeLens(document as any);
        assert.deepEqual(files, testFile2 as any);
        workspaceService.verifyAll();
        testCollectionStorage.verifyAll();
    });
});

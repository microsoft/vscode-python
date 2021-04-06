// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { ApplicationShell } from '../../../client/common/application/applicationShell';
import { CommandManager } from '../../../client/common/application/commandManager';
import { CommandSource, IApplicationShell, ICommandManager } from '../../../client/common/application/types';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../client/common/platform/types';
import { ServiceContainer } from '../../../client/ioc/container';
import { IServiceContainer } from '../../../client/ioc/types';
import { TestCollectionStorageService } from '../../../client/testing/common/services/storageService';
import { ITestCollectionStorageService, TestFunction, Tests } from '../../../client/testing/common/types';
import { TestDisplay } from '../../../client/testing/display/picker';
import { createEmptyResults } from '../results';

suite('Testing - TestDisplay', () => {
    const wkspace = Uri.file(__dirname);
    let mockedCommandManager: ICommandManager;
    let mockedServiceContainer: IServiceContainer;
    let mockedTestCollectionStorage: ITestCollectionStorageService;
    let mockedAppShell: IApplicationShell;
    let testDisplay: TestDisplay;

    function fullPathInTests(collectedTests: Tests, fullpath?: string): Tests {
        collectedTests.testFiles = [
            {
                fullPath: fullpath ? fullpath : 'path/to/testfile',
                ...anything(),
            },
        ];
        return collectedTests;
    }

    setup(() => {
        mockedCommandManager = mock(CommandManager);
        mockedServiceContainer = mock(ServiceContainer);
        mockedTestCollectionStorage = mock(TestCollectionStorageService);
        mockedAppShell = mock(ApplicationShell);
        when(mockedServiceContainer.get<ITestCollectionStorageService>(ITestCollectionStorageService)).thenReturn(
            instance(mockedTestCollectionStorage),
        );
        when(mockedServiceContainer.get<IApplicationShell>(IApplicationShell)).thenReturn(instance(mockedAppShell));

        testDisplay = new TestDisplay(instance(mockedServiceContainer), instance(mockedCommandManager));
    });

    suite('displayFunctionTestPickerUI', () => {
        const paths: { [key: string]: any } = {
            match: {
                fullPath: '/path/to/testfile',
                fileName: '/path/to/testfile',
            },
            mismatch: {
                fullPath: '/path/to/testfile',
                fileName: '/testfile/to/path',
            },
        };
        let tests: Tests;

        function codeLensTestFunctions(testfunctions?: TestFunction[]): TestFunction[] {
            if (!testfunctions) {
                return [{ ...anything() }];
            }
            const functions: TestFunction[] = [];
            testfunctions.forEach((fn) => functions.push(fn));
            return functions;
        }

        setup(() => {
            tests = createEmptyResults();
            when(mockedServiceContainer.get<IFileSystem>(IFileSystem)).thenReturn(new FileSystem());
            when(mockedTestCollectionStorage.getTests(wkspace)).thenReturn(tests);
            when(mockedAppShell.showQuickPick(anything(), anything())).thenResolve();
        });

        test(`Test that a dropdown picker for parametrized tests is shown if compared paths are equal (OS independent) (#8627)`, () => {
            const { fullPath, fileName } = paths.match;
            fullPathInTests(tests, fullPath);

            testDisplay.displayFunctionTestPickerUI(
                CommandSource.commandPalette,
                wkspace,
                'rootDirectory',
                Uri.file(fileName),
                codeLensTestFunctions(),
            );

            verify(mockedAppShell.showQuickPick(anything(), anything())).once();
        });

        test(`Test that a dropdown picker for parametrized tests is NOT shown if compared paths are NOT equal (OS independent) (#8627)`, () => {
            const { fullPath, fileName } = paths.mismatch;
            fullPathInTests(tests, fullPath);

            testDisplay.displayFunctionTestPickerUI(
                CommandSource.commandPalette,
                wkspace,
                'rootDirectory',
                Uri.file(fileName),
                codeLensTestFunctions(),
            );

            verify(mockedAppShell.showQuickPick(anything(), anything())).never();
        });

        test(`Test that clicking a codelens on parametrized tests opens a dropdown picker on windows (#8627)`, function () {
            if (process.platform !== 'win32') {
                this.skip();
            }
            // The error described in #8627 originated from the problem that the casing of the drive letter was different
            // in a test items fullPath property to the one of a file that contained the clicked parametrized test.
            const fileName = 'c:\\path\\to\\testfile';
            fullPathInTests(tests, 'C:\\path\\to\\testfile');

            testDisplay.displayFunctionTestPickerUI(
                CommandSource.commandPalette,
                wkspace,
                'rootDirectory',
                Uri.file(fileName),
                codeLensTestFunctions(),
            );

            verify(mockedAppShell.showQuickPick(anything(), anything())).once();
        });
    });
});

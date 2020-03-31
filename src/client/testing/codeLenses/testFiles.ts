'use strict';

// tslint:disable:no-object-literal-type-assertion

import {
    CancellationToken,
    CancellationTokenSource,
    CodeLens,
    CodeLensProvider,
    DocumentSymbolProvider,
    Event,
    EventEmitter,
    Position,
    Range,
    SymbolInformation,
    SymbolKind,
    TextDocument,
    Uri
} from 'vscode';
import { IWorkspaceService } from '../../../client/common/application/types';
import { IFileSystem } from '../../../client/common/platform/types';
import { IServiceContainer } from '../../../client/ioc/types';
import * as constants from '../../common/constants';
import { CommandSource } from '../common/constants';
import {
    ITestCollectionStorageService,
    TestFile,
    TestFunction,
    TestStatus,
    TestsToRun,
    TestSuite
} from '../common/types';

type FunctionsAndSuites = {
    functions: TestFunction[];
    suites: TestSuite[];
};

export class TestFileCodeLensProvider implements CodeLensProvider {
    private workspaceService: IWorkspaceService;
    private fileSystem: IFileSystem;
    // tslint:disable-next-line:variable-name
    constructor(
        private _onDidChange: EventEmitter<void>,
        private symbolProvider: DocumentSymbolProvider,
        private testCollectionStorage: ITestCollectionStorageService,
        serviceContainer: IServiceContainer
    ) {
        this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.fileSystem = serviceContainer.get<IFileSystem>(IFileSystem);
    }

    get onDidChangeCodeLenses(): Event<void> {
        return this._onDidChange.event;
    }

    public async provideCodeLenses(document: TextDocument, token: CancellationToken) {
        const wkspace = this.workspaceService.getWorkspaceFolder(document.uri);
        if (!wkspace) {
            return [];
        }
        const testItems = this.testCollectionStorage.getTests(wkspace.uri);
        if (!testItems || testItems.testFiles.length === 0 || testItems.testFunctions.length === 0) {
            return [];
        }

        const cancelTokenSrc = new CancellationTokenSource();
        token.onCancellationRequested(() => {
            cancelTokenSrc.cancel();
        });

        // Strop trying to build the code lenses if unable to get a list of
        // symbols in this file afrer x time.
        setTimeout(() => {
            if (!cancelTokenSrc.token.isCancellationRequested) {
                cancelTokenSrc.cancel();
            }
        }, constants.Delays.MaxUnitTestCodeLensDelay);

        return this.getCodeLenses(document, cancelTokenSrc.token, this.symbolProvider);
    }

    public resolveCodeLens(codeLens: CodeLens, _token: CancellationToken): CodeLens | Thenable<CodeLens> {
        codeLens.command = { command: 'python.runtests', title: 'Test' };
        return Promise.resolve(codeLens);
    }

    public getTestFileWhichNeedsCodeLens(document: TextDocument): TestFile | undefined {
        const wkspace = this.workspaceService.getWorkspaceFolder(document.uri);
        if (!wkspace) {
            return;
        }
        const tests = this.testCollectionStorage.getTests(wkspace.uri);
        if (!tests) {
            return;
        }
        return tests.testFiles.find((item) => this.fileSystem.arePathsSame(item.fullPath, document.uri.fsPath));
    }

    private async getCodeLenses(
        document: TextDocument,
        token: CancellationToken,
        symbolProvider: DocumentSymbolProvider
    ) {
        const file = this.getTestFileWhichNeedsCodeLens(document);
        if (!file) {
            return [];
        }
        const allFuncsAndSuites = getAllTestSuitesAndFunctionsPerFile(file);

        try {
            const symbols = (await symbolProvider.provideDocumentSymbols(document, token)) as SymbolInformation[];
            if (!symbols) {
                return [];
            }
            return symbols
                .filter(
                    (symbol) =>
                        symbol.kind === SymbolKind.Function ||
                        symbol.kind === SymbolKind.Method ||
                        symbol.kind === SymbolKind.Class
                )
                .map((symbol) => {
                    // This is bloody crucial, if the start and end columns are the same
                    // then vscode goes bonkers when ever you edit a line (start scrolling magically).
                    const range = new Range(
                        symbol.location.range.start,
                        new Position(symbol.location.range.end.line, symbol.location.range.end.character + 1)
                    );

                    return this.getCodeLens(
                        document.uri,
                        allFuncsAndSuites,
                        range,
                        symbol.name,
                        symbol.kind,
                        symbol.containerName
                    );
                })
                .reduce((previous, current) => previous.concat(current), [])
                .filter((codeLens) => codeLens !== null);
        } catch (reason) {
            if (token.isCancellationRequested) {
                return [];
            }
            return Promise.reject(reason);
        }
    }

    private getCodeLens(
        file: Uri,
        allFuncsAndSuites: FunctionsAndSuites,
        range: Range,
        symbolName: string,
        symbolKind: SymbolKind,
        symbolContainer: string
    ): CodeLens[] {
        switch (symbolKind) {
            case SymbolKind.Function:
            case SymbolKind.Method: {
                return getFunctionCodeLens(file, allFuncsAndSuites, symbolName, range, symbolContainer);
            }
            case SymbolKind.Class: {
                const cls = allFuncsAndSuites.suites.find((item) => item.name === symbolName);
                if (!cls) {
                    return [];
                }
                return [
                    new CodeLens(range, {
                        title: getTestStatusIcon(cls.status) + constants.Text.CodeLensRunUnitTest,
                        command: constants.Commands.Tests_Run,
                        arguments: [undefined, CommandSource.codelens, file, <TestsToRun>{ testSuite: [cls] }]
                    }),
                    new CodeLens(range, {
                        title: getTestStatusIcon(cls.status) + constants.Text.CodeLensDebugUnitTest,
                        command: constants.Commands.Tests_Debug,
                        arguments: [undefined, CommandSource.codelens, file, <TestsToRun>{ testSuite: [cls] }]
                    })
                ];
            }
            default: {
                return [];
            }
        }
    }
}

function getTestStatusIcon(status?: TestStatus): string {
    switch (status) {
        case TestStatus.Pass: {
            return `${constants.Octicons.Test_Pass} `;
        }
        case TestStatus.Error: {
            return `${constants.Octicons.Test_Error} `;
        }
        case TestStatus.Fail: {
            return `${constants.Octicons.Test_Fail} `;
        }
        case TestStatus.Skipped: {
            return `${constants.Octicons.Test_Skip} `;
        }
        default: {
            return '';
        }
    }
}

function getTestStatusIcons(fns: TestFunction[]): string {
    const statuses: string[] = [];
    let count = fns.filter((fn) => fn.status === TestStatus.Pass).length;
    if (count > 0) {
        statuses.push(`${constants.Octicons.Test_Pass} ${count}`);
    }
    count = fns.filter((fn) => fn.status === TestStatus.Skipped).length;
    if (count > 0) {
        statuses.push(`${constants.Octicons.Test_Skip} ${count}`);
    }
    count = fns.filter((fn) => fn.status === TestStatus.Fail).length;
    if (count > 0) {
        statuses.push(`${constants.Octicons.Test_Fail} ${count}`);
    }
    count = fns.filter((fn) => fn.status === TestStatus.Error).length;
    if (count > 0) {
        statuses.push(`${constants.Octicons.Test_Error} ${count}`);
    }

    return statuses.join(' ');
}
function getFunctionCodeLens(
    file: Uri,
    functionsAndSuites: FunctionsAndSuites,
    symbolName: string,
    range: Range,
    symbolContainer: string
): CodeLens[] {
    let fn: TestFunction | undefined;
    if (symbolContainer.length === 0) {
        fn = functionsAndSuites.functions.find((func) => func.name === symbolName);
    } else {
        // Assume single levels for now.
        functionsAndSuites.suites
            .filter((s) => s.name === symbolContainer)
            .forEach((s) => {
                const f = s.functions.find((item) => item.name === symbolName);
                if (f) {
                    fn = f;
                }
            });
    }

    if (fn) {
        return [
            new CodeLens(range, {
                title: getTestStatusIcon(fn.status) + constants.Text.CodeLensRunUnitTest,
                command: constants.Commands.Tests_Run,
                arguments: [undefined, CommandSource.codelens, file, <TestsToRun>{ testFunction: [fn] }]
            }),
            new CodeLens(range, {
                title: getTestStatusIcon(fn.status) + constants.Text.CodeLensDebugUnitTest,
                command: constants.Commands.Tests_Debug,
                arguments: [undefined, CommandSource.codelens, file, <TestsToRun>{ testFunction: [fn] }]
            })
        ];
    }

    // Ok, possible we're dealing with parameterized unit tests.
    // If we have [ in the name, then this is a parameterized function.
    const functions = functionsAndSuites.functions.filter(
        (func) => func.name.startsWith(`${symbolName}[`) && func.name.endsWith(']')
    );
    if (functions.length === 0) {
        return [];
    }

    // Find all flattened functions.
    return [
        new CodeLens(range, {
            title: `${getTestStatusIcons(functions)} ${constants.Text.CodeLensRunUnitTest} (Multiple)`,
            command: constants.Commands.Tests_Picker_UI,
            arguments: [undefined, CommandSource.codelens, file, functions]
        }),
        new CodeLens(range, {
            title: `${getTestStatusIcons(functions)} ${constants.Text.CodeLensDebugUnitTest} (Multiple)`,
            command: constants.Commands.Tests_Picker_UI_Debug,
            arguments: [undefined, CommandSource.codelens, file, functions]
        })
    ];
}

function getAllTestSuitesAndFunctionsPerFile(testFile: TestFile): FunctionsAndSuites {
    // tslint:disable-next-line:prefer-type-cast
    const all = { functions: [...testFile.functions], suites: [] as TestSuite[] };
    testFile.suites.forEach((suite) => {
        all.suites.push(suite);

        const allChildItems = getAllTestSuitesAndFunctions(suite);
        all.functions.push(...allChildItems.functions);
        all.suites.push(...allChildItems.suites);
    });
    return all;
}
function getAllTestSuitesAndFunctions(testSuite: TestSuite): FunctionsAndSuites {
    const all: { functions: TestFunction[]; suites: TestSuite[] } = { functions: [], suites: [] };
    testSuite.functions.forEach((fn) => {
        all.functions.push(fn);
    });
    testSuite.suites.forEach((suite) => {
        all.suites.push(suite);

        const allChildItems = getAllTestSuitesAndFunctions(suite);
        all.functions.push(...allChildItems.functions);
        all.suites.push(...allChildItems.suites);
    });
    return all;
}

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { QuickPickItem, Uri } from 'vscode';
import { IApplicationShell, ICommandManager } from '../../common/application/types';
import * as constants from '../../common/constants';
import { IFileSystem } from '../../common/platform/types';
import { IServiceContainer } from '../../ioc/types';
import {
    FlattenedTestFunction,
    ITestCollectionStorageService,
    ITestDisplay,
    TestFile,
    TestFunction,
    Tests,
    TestStatus,
    TestsToRun,
} from '../common/types';

@injectable()
export class TestDisplay implements ITestDisplay {
    private readonly testCollectionStorage: ITestCollectionStorageService;
    private readonly appShell: IApplicationShell;
    constructor(
        @inject(IServiceContainer) private readonly serviceRegistry: IServiceContainer,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
    ) {
        this.testCollectionStorage = serviceRegistry.get<ITestCollectionStorageService>(ITestCollectionStorageService);
        this.appShell = serviceRegistry.get<IApplicationShell>(IApplicationShell);
    }
    public displayStopTestUI(workspace: Uri, message: string) {
        this.appShell.showQuickPick([message]).then((item) => {
            if (item === message) {
                this.commandManager.executeCommand(constants.Commands.Tests_Stop, undefined, workspace);
            }
        });
    }
    public displayTestUI(cmdSource: constants.CommandSource, wkspace: Uri) {
        const tests = this.testCollectionStorage.getTests(wkspace);
        this.appShell
            .showQuickPick(buildItems(tests), { matchOnDescription: true, matchOnDetail: true })
            .then((item) =>
                item ? onItemSelected(this.commandManager, cmdSource, wkspace, item, false) : Promise.resolve(),
            );
    }
    public selectTestFunction(rootDirectory: string, tests: Tests): Promise<FlattenedTestFunction> {
        return new Promise<FlattenedTestFunction>((resolve, reject) => {
            this.appShell
                .showQuickPick(buildItemsForFunctions(rootDirectory, tests.testFunctions), {
                    matchOnDescription: true,
                    matchOnDetail: true,
                })
                .then((item) => {
                    if (item && item.fn) {
                        return resolve(item.fn);
                    }
                    return reject();
                }, reject);
        });
    }
    public selectTestFile(rootDirectory: string, tests: Tests): Promise<TestFile> {
        return new Promise<TestFile>((resolve, reject) => {
            this.appShell
                .showQuickPick(buildItemsForTestFiles(rootDirectory, tests.testFiles), {
                    matchOnDescription: true,
                    matchOnDetail: true,
                })
                .then((item) => {
                    if (item && item.testFile) {
                        return resolve(item.testFile);
                    }
                    return reject();
                }, reject);
        });
    }
    public displayFunctionTestPickerUI(
        cmdSource: constants.CommandSource,
        wkspace: Uri,
        rootDirectory: string,
        file: Uri,
        testFunctions: TestFunction[],
        debug?: boolean,
    ) {
        const tests = this.testCollectionStorage.getTests(wkspace);
        if (!tests) {
            return;
        }
        const fileName = file.fsPath;
        const fs = this.serviceRegistry.get<IFileSystem>(IFileSystem);
        const testFile = tests.testFiles.find(
            (item) => item.name === fileName || fs.arePathsSame(item.fullPath, fileName),
        );
        if (!testFile) {
            return;
        }
        const flattenedFunctions = tests.testFunctions.filter((fn) => {
            return (
                fn.parentTestFile.name === testFile.name &&
                testFunctions.some((testFunc) => testFunc.nameToRun === fn.testFunction.nameToRun)
            );
        });
        const runAllItem = buildRunAllParametrizedItem(flattenedFunctions, debug);
        const functionItems = buildItemsForFunctions(rootDirectory, flattenedFunctions, undefined, undefined, debug);
        this.appShell
            .showQuickPick(runAllItem.concat(...functionItems), { matchOnDescription: true, matchOnDetail: true })
            .then((testItem) =>
                testItem ? onItemSelected(this.commandManager, cmdSource, wkspace, testItem, debug) : Promise.resolve(),
            );
    }
}

export enum Type {
    RunAll = 0,
    ReDiscover = 1,
    RunFailed = 2,
    RunFolder = 3,
    RunFile = 4,
    RunClass = 5,
    RunMethod = 6,
    ViewTestOutput = 7,
    Null = 8,
    SelectAndRunMethod = 9,
    DebugMethod = 10,
    Configure = 11,
    RunParametrized = 12,
}
const statusIconMapping = new Map<TestStatus, string>();
statusIconMapping.set(TestStatus.Pass, constants.Octicons.Test_Pass);
statusIconMapping.set(TestStatus.Fail, constants.Octicons.Test_Fail);
statusIconMapping.set(TestStatus.Error, constants.Octicons.Test_Error);
statusIconMapping.set(TestStatus.Skipped, constants.Octicons.Test_Skip);

type TestItem = QuickPickItem & {
    type: Type;
    fn?: FlattenedTestFunction;
    fns?: TestFunction[];
};

type TestFileItem = QuickPickItem & {
    type: Type;
    testFile?: TestFile;
};

function getSummary(tests?: Tests) {
    if (!tests || !tests.summary) {
        return '';
    }
    const statusText: string[] = [];
    if (tests.summary.passed > 0) {
        statusText.push(`${constants.Octicons.Test_Pass} ${tests.summary.passed} Passed`);
    }
    if (tests.summary.failures > 0) {
        statusText.push(`${constants.Octicons.Test_Fail} ${tests.summary.failures} Failed`);
    }
    if (tests.summary.errors > 0) {
        const plural = tests.summary.errors === 1 ? '' : 's';
        statusText.push(`${constants.Octicons.Test_Error} ${tests.summary.errors} Error${plural}`);
    }
    if (tests.summary.skipped > 0) {
        statusText.push(`${constants.Octicons.Test_Skip} ${tests.summary.skipped} Skipped`);
    }
    return statusText.join(', ').trim();
}
function buildItems(tests?: Tests): TestItem[] {
    const items: TestItem[] = [];
    items.push({ description: '', label: 'Run All Tests', type: Type.RunAll });
    items.push({ description: '', label: 'Discover Tests', type: Type.ReDiscover });
    items.push({ description: '', label: 'Run Test Method ...', type: Type.SelectAndRunMethod });
    items.push({ description: '', label: 'Configure Tests', type: Type.Configure });

    const summary = getSummary(tests);
    items.push({ description: '', label: 'View Test Output', type: Type.ViewTestOutput, detail: summary });

    if (tests && tests.summary.failures > 0) {
        items.push({
            description: '',
            label: 'Run Failed Tests',
            type: Type.RunFailed,
            detail: `${constants.Octicons.Test_Fail} ${tests.summary.failures} Failed`,
        });
    }

    return items;
}

const statusSortPrefix = {
    [TestStatus.Error]: '1',
    [TestStatus.Fail]: '2',
    [TestStatus.Skipped]: '3',
    [TestStatus.Pass]: '4',
    [TestStatus.Discovering]: undefined,
    [TestStatus.Idle]: undefined,
    [TestStatus.Running]: undefined,
    [TestStatus.Unknown]: undefined,
};

function buildRunAllParametrizedItem(tests: FlattenedTestFunction[], debug: boolean = false): TestItem[] {
    const testFunctions: TestFunction[] = [];
    tests.forEach((fn) => {
        testFunctions.push(fn.testFunction);
    });
    return [
        {
            description: '',
            label: debug ? 'Debug All' : 'Run All',
            type: Type.RunParametrized,
            fns: testFunctions,
        },
    ];
}
function buildItemsForFunctions(
    rootDirectory: string,
    tests: FlattenedTestFunction[],
    sortBasedOnResults: boolean = false,
    displayStatusIcons: boolean = false,
    debug: boolean = false,
): TestItem[] {
    const functionItems: TestItem[] = [];
    tests.forEach((fn) => {
        let icon = '';
        if (displayStatusIcons && fn.testFunction.status && statusIconMapping.has(fn.testFunction.status)) {
            icon = `${statusIconMapping.get(fn.testFunction.status)} `;
        }

        functionItems.push({
            description: '',
            detail: path.relative(rootDirectory, fn.parentTestFile.fullPath),
            label: icon + fn.testFunction.name,
            type: debug === true ? Type.DebugMethod : Type.RunMethod,
            fn: fn,
        });
    });
    functionItems.sort((a, b) => {
        let sortAPrefix = '5-';
        let sortBPrefix = '5-';
        if (sortBasedOnResults && a.fn && a.fn.testFunction.status && b.fn && b.fn.testFunction.status) {
            sortAPrefix = statusSortPrefix[a.fn.testFunction.status]
                ? statusSortPrefix[a.fn.testFunction.status]!
                : sortAPrefix;
            sortBPrefix = statusSortPrefix[b.fn.testFunction.status]
                ? statusSortPrefix[b.fn.testFunction.status]!
                : sortBPrefix;
        }
        if (`${sortAPrefix}${a.detail}${a.label}` < `${sortBPrefix}${b.detail}${b.label}`) {
            return -1;
        }
        if (`${sortAPrefix}${a.detail}${a.label}` > `${sortBPrefix}${b.detail}${b.label}`) {
            return 1;
        }
        return 0;
    });
    return functionItems;
}
function buildItemsForTestFiles(rootDirectory: string, testFiles: TestFile[]): TestFileItem[] {
    const fileItems: TestFileItem[] = testFiles.map((testFile) => {
        return {
            description: '',
            detail: path.relative(rootDirectory, testFile.fullPath),
            type: Type.RunFile,
            label: path.basename(testFile.fullPath),
            testFile: testFile,
        };
    });
    fileItems.sort((a, b) => {
        if (!a.detail && !b.detail) {
            return 0;
        }
        if (!a.detail || a.detail < b.detail!) {
            return -1;
        }
        if (!b.detail || a.detail! > b.detail) {
            return 1;
        }
        return 0;
    });
    return fileItems;
}
export function onItemSelected(
    commandManager: ICommandManager,
    cmdSource: constants.CommandSource,
    wkspace: Uri,
    selection: TestItem,
    debug?: boolean,
) {
    if (!selection || typeof selection.type !== 'number') {
        return;
    }
    switch (selection.type) {
        case Type.Null: {
            return;
        }
        case Type.RunAll: {
            return commandManager.executeCommand(
                constants.Commands.Tests_Run,
                undefined,
                cmdSource,
                wkspace,
                undefined,
            );
        }
        case Type.RunParametrized: {
            return commandManager.executeCommand(
                constants.Commands.Tests_Run_Parametrized,
                undefined,
                cmdSource,
                wkspace,
                selection.fns!,
                debug!,
            );
        }
        case Type.ReDiscover: {
            return commandManager.executeCommand(constants.Commands.Tests_Discover, undefined, cmdSource, wkspace);
        }
        case Type.ViewTestOutput: {
            return commandManager.executeCommand(constants.Commands.Tests_ViewOutput, undefined, cmdSource);
        }
        case Type.RunFailed: {
            return commandManager.executeCommand(constants.Commands.Tests_Run_Failed, undefined, cmdSource, wkspace);
        }
        case Type.SelectAndRunMethod: {
            const cmd = debug
                ? constants.Commands.Tests_Select_And_Debug_Method
                : constants.Commands.Tests_Select_And_Run_Method;
            return commandManager.executeCommand(cmd, undefined, cmdSource, wkspace);
        }
        case Type.RunMethod: {
            const testsToRun: TestsToRun = { testFunction: [selection.fn!.testFunction] };
            return commandManager.executeCommand(
                constants.Commands.Tests_Run,
                undefined,
                cmdSource,
                wkspace,
                testsToRun,
            );
        }
        case Type.DebugMethod: {
            const testsToRun: TestsToRun = { testFunction: [selection.fn!.testFunction] };
            return commandManager.executeCommand(
                constants.Commands.Tests_Debug,
                undefined,
                cmdSource,
                wkspace,
                testsToRun,
            );
        }
        case Type.Configure: {
            return commandManager.executeCommand(constants.Commands.Tests_Configure, undefined, cmdSource, wkspace);
        }
        default: {
            return;
        }
    }
}

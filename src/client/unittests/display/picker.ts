import * as path from 'path';
import { QuickPickItem, Uri, window } from 'vscode';
import * as vscode from 'vscode';
import * as constants from '../../common/constants';
import { FlattenedTestFunction, ITestCollectionStorageService, TestFile, TestFunction, Tests, TestStatus, TestsToRun } from '../common/types';

export class TestDisplay {
    constructor(private testCollectionStorage: ITestCollectionStorageService) { }
    public displayStopTestUI(workspace: Uri, message: string) {
        window.showQuickPick([message]).then(item => {
            if (item === message) {
                vscode.commands.executeCommand(constants.Commands.Tests_Stop, workspace);
            }
        });
    }
    public displayTestUI(wkspace: Uri) {
        const tests = this.testCollectionStorage.getTests(wkspace);
        window.showQuickPick(buildItems(tests), { matchOnDescription: true, matchOnDetail: true })
            .then(item => onItemSelected(wkspace, item, false));
    }
    public selectTestFunction(rootDirectory: string, tests: Tests): Promise<FlattenedTestFunction> {
        return new Promise<FlattenedTestFunction>((resolve, reject) => {
            window.showQuickPick(buildItemsForFunctions(rootDirectory, tests.testFunctions), { matchOnDescription: true, matchOnDetail: true })
                .then(item => {
                    if (item && item.fn) {
                        return resolve(item.fn);
                    }
                    return reject();
                }, reject);
        });
    }
    public selectTestFile(rootDirectory: string, tests: Tests): Promise<TestFile> {
        return new Promise<TestFile>((resolve, reject) => {
            window.showQuickPick(buildItemsForTestFiles(rootDirectory, tests.testFiles), { matchOnDescription: true, matchOnDetail: true })
                .then(item => {
                    if (item && item.testFile) {
                        return resolve(item.testFile);
                    }
                    return reject();
                }, reject);
        });
    }
    public displayFunctionTestPickerUI(wkspace: Uri, rootDirectory: string, file: Uri, testFunctions: TestFunction[], debug?: boolean) {
        const tests = this.testCollectionStorage.getTests(wkspace);
        if (!tests) {
            return;
        }
        const fileName = file.fsPath;
        const testFile = tests.testFiles.find(item => item.name === fileName || item.fullPath === fileName);
        if (!testFile) {
            return;
        }
        const flattenedFunctions = tests.testFunctions.filter(fn => {
            return fn.parentTestFile.name === testFile.name &&
                testFunctions.some(testFunc => testFunc.nameToRun === fn.testFunction.nameToRun);
        });

        window.showQuickPick(buildItemsForFunctions(rootDirectory, flattenedFunctions, undefined, undefined, debug),
            { matchOnDescription: true, matchOnDetail: true }).then(testItem => {
                return onItemSelected(wkspace, testItem, debug);
            });
    }
}

enum Type {
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
    DebugMethod = 10
}
const statusIconMapping = new Map<TestStatus, string>();
statusIconMapping.set(TestStatus.Pass, constants.Octicons.Test_Pass);
statusIconMapping.set(TestStatus.Fail, constants.Octicons.Test_Fail);
statusIconMapping.set(TestStatus.Error, constants.Octicons.Test_Error);
statusIconMapping.set(TestStatus.Skipped, constants.Octicons.Test_Skip);

type TestItem = QuickPickItem & {
    type: Type;
    fn?: FlattenedTestFunction;
};

type TestFileItem = QuickPickItem & {
    type: Type;
    testFile?: TestFile;
};

function getSummary(tests?: Tests) {
    if (!tests || !tests.summary) {
        return '';
    }
    const statusText = [];
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
    items.push({ description: '', label: 'Run All Unit Tests', type: Type.RunAll });
    items.push({ description: '', label: 'Discover Unit Tests', type: Type.ReDiscover });
    items.push({ description: '', label: 'Run Unit Test Method ...', type: Type.SelectAndRunMethod });

    const summary = getSummary(tests);
    items.push({ description: '', label: 'View Unit Test Output', type: Type.ViewTestOutput, detail: summary });

    if (tests && tests.summary.failures > 0) {
        items.push({ description: '', label: 'Run Failed Tests', type: Type.RunFailed, detail: `${constants.Octicons.Test_Fail} ${tests.summary.failures} Failed` });
    }

    return items;
}

const statusSortPrefix = {};
statusSortPrefix[TestStatus.Error] = '1';
statusSortPrefix[TestStatus.Fail] = '2';
statusSortPrefix[TestStatus.Skipped] = '3';
statusSortPrefix[TestStatus.Pass] = '4';

function buildItemsForFunctions(rootDirectory: string, tests: FlattenedTestFunction[], sortBasedOnResults: boolean = false, displayStatusIcons: boolean = false, debug: boolean = false): TestItem[] {
    const functionItems: TestItem[] = [];
    tests.forEach(fn => {
        let icon = '';
        if (displayStatusIcons && statusIconMapping.has(fn.testFunction.status)) {
            icon = `${statusIconMapping.get(fn.testFunction.status)} `;
        }

        functionItems.push({
            description: '',
            detail: path.relative(rootDirectory, fn.parentTestFile.fullPath),
            label: icon + fn.testFunction.name,
            type: debug === true ? Type.DebugMethod : Type.RunMethod,
            fn: fn
        });
    });
    functionItems.sort((a, b) => {
        let sortAPrefix = '5-';
        let sortBPrefix = '5-';
        if (sortBasedOnResults) {
            sortAPrefix = statusSortPrefix[a.fn.testFunction.status] ? statusSortPrefix[a.fn.testFunction.status] : sortAPrefix;
            sortBPrefix = statusSortPrefix[b.fn.testFunction.status] ? statusSortPrefix[b.fn.testFunction.status] : sortBPrefix;
        }
        if (sortAPrefix + a.detail + a.label < sortBPrefix + b.detail + b.label) {
            return -1;
        }
        if (sortAPrefix + a.detail + a.label > sortBPrefix + b.detail + b.label) {
            return 1;
        }
        return 0;
    });
    return functionItems;
}
function buildItemsForTestFiles(rootDirectory: string, testFiles: TestFile[]): TestFileItem[] {
    const fileItems: TestFileItem[] = testFiles.map(testFile => {
        return {
            description: '',
            detail: path.relative(rootDirectory, testFile.fullPath),
            type: Type.RunFile,
            label: path.basename(testFile.fullPath),
            testFile: testFile
        };
    });
    fileItems.sort((a, b) => {
        if (a.detail < b.detail) {
            return -1;
        }
        if (a.detail > b.detail) {
            return 1;
        }
        return 0;
    });
    return fileItems;
}
function onItemSelected(wkspace: Uri, selection: TestItem, debug?: boolean) {
    if (!selection || typeof selection.type !== 'number') {
        return;
    }
    let cmd = '';
    // tslint:disable-next-line:no-any
    const args: any[] = [wkspace];
    switch (selection.type) {
        case Type.Null: {
            return;
        }
        case Type.RunAll: {
            cmd = constants.Commands.Tests_Run;
            break;
        }
        case Type.ReDiscover: {
            cmd = constants.Commands.Tests_Discover;
            break;
        }
        case Type.ViewTestOutput: {
            cmd = constants.Commands.Tests_ViewOutput;
            break;
        }
        case Type.RunFailed: {
            cmd = constants.Commands.Tests_Run_Failed;
            break;
        }
        case Type.SelectAndRunMethod: {
            cmd = debug ? constants.Commands.Tests_Select_And_Debug_Method : constants.Commands.Tests_Select_And_Run_Method;
            break;
        }
        case Type.RunMethod: {
            cmd = constants.Commands.Tests_Run;
            // tslint:disable-next-line:prefer-type-cast
            args.push({ testFunction: [selection.fn.testFunction] } as TestsToRun);
            break;
        }
        case Type.DebugMethod: {
            cmd = constants.Commands.Tests_Debug;
            // tslint:disable-next-line:prefer-type-cast
            args.push({ testFunction: [selection.fn.testFunction] } as TestsToRun);
            args.push(true);
            break;
        }
        default: {
            return;
        }
    }

    vscode.commands.executeCommand(cmd, ...args);
}

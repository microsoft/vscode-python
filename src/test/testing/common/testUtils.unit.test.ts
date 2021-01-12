// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import * as path from 'path';
import { Uri } from 'vscode';
import { getNamesAndValues } from '../../../client/common/utils/enum';
import {
    getChildren,
    getParent,
    getParentFile,
    getParentSuite,
    getTestDataItemType,
    getTestFile,
    getTestFolder,
    getTestFunction,
    getTestSuite,
} from '../../../client/testing/common/testUtils';
import {
    FlattenedTestFunction,
    FlattenedTestSuite,
    SubtestParent,
    TestFile,
    TestFolder,
    TestFunction,
    Tests,
    TestSuite,
} from '../../../client/testing/common/types';
import { TestDataItem, TestDataItemType, TestWorkspaceFolder } from '../../../client/testing/types';

function longestCommonSubstring(strings: string[]): string {
    strings = strings.concat().sort();
    let substr = strings.shift() || '';
    strings.forEach((str) => {
        for (const [idx, ch] of [...substr].entries()) {
            if (str[idx] !== ch) {
                substr = substr.substring(0, idx);
                break;
            }
        }
    });
    return substr;
}

export function createMockTestDataItem<T extends TestDataItem>(
    type: TestDataItemType,
    nameSuffix: string = '',
    name?: string,
    nameToRun?: string,
) {
    const folder: TestFolder = {
        resource: Uri.file(__filename),
        folders: [],
        name: name || 'Some Folder' + nameSuffix,
        nameToRun: nameToRun || name || ' Some Folder' + nameSuffix,
        testFiles: [],
        time: 0,
    };
    const file: TestFile = {
        resource: Uri.file(__filename),
        name: name || 'Some File' + nameSuffix,
        nameToRun: nameToRun || name || ' Some File' + nameSuffix,
        fullPath: __filename,
        xmlName: name || 'some xml name' + nameSuffix,
        functions: [],
        suites: [],
        time: 0,
    };
    const func: TestFunction = {
        resource: Uri.file(__filename),
        name: name || 'Some Function' + nameSuffix,
        nameToRun: nameToRun || name || ' Some Function' + nameSuffix,
        time: 0,
    };
    const suite: TestSuite = {
        resource: Uri.file(__filename),
        name: name || 'Some Suite' + nameSuffix,
        nameToRun: nameToRun || name || ' Some Suite' + nameSuffix,
        functions: [],
        isInstance: true,
        isUnitTest: false,
        suites: [],
        xmlName: name || 'some name' + nameSuffix,
        time: 0,
    };

    switch (type) {
        case TestDataItemType.file:
            return file as T;
        case TestDataItemType.folder:
            return folder as T;
        case TestDataItemType.function:
            return func as T;
        case TestDataItemType.suite:
            return suite as T;
        case TestDataItemType.workspaceFolder:
            return new TestWorkspaceFolder({ uri: Uri.file(''), name: 'a', index: 0 }) as T;
        default:
            throw new Error(`Unknown type ${type}`);
    }
}

export function createSubtestParent(funcs: TestFunction[]): SubtestParent {
    const name = longestCommonSubstring(funcs.map((func) => func.name));
    const nameToRun = longestCommonSubstring(funcs.map((func) => func.nameToRun));
    const subtestParent: SubtestParent = {
        name: name,
        nameToRun: nameToRun,
        asSuite: {
            resource: Uri.file(__filename),
            name: name,
            nameToRun: nameToRun,
            functions: funcs,
            suites: [],
            isUnitTest: false,
            isInstance: false,
            xmlName: '',
            time: 0,
        },
        time: 0,
    };
    funcs.forEach((func) => {
        func.subtestParent = subtestParent;
    });
    return subtestParent;
}

export function createTests(
    folders: TestFolder[],
    files: TestFile[],
    suites: TestSuite[],
    funcs: TestFunction[],
): Tests {
    return {
        summary: { errors: 0, skipped: 0, passed: 0, failures: 0 },
        rootTestFolders: folders.length > 0 ? [folders[0]] : [],
        testFolders: folders,
        testFiles: files,
        testSuites: suites.map((suite) => {
            return {
                testSuite: suite,
                xmlClassName: suite.xmlName,
            } as any;
        }),
        testFunctions: funcs.map((func) => {
            return {
                testFunction: func,
                xmlClassName: func.name,
            } as any;
        }),
    };
}

suite('Unit Tests - TestUtils', () => {
    test('Get TestDataItemType for Folders', () => {
        const item = createMockTestDataItem(TestDataItemType.folder);
        assert.equal(getTestDataItemType(item), TestDataItemType.folder);
    });
    test('Get TestDataItemType for Files', () => {
        const item = createMockTestDataItem(TestDataItemType.file);
        assert.equal(getTestDataItemType(item), TestDataItemType.file);
    });
    test('Get TestDataItemType for Functions', () => {
        const item = createMockTestDataItem(TestDataItemType.function);
        assert.equal(getTestDataItemType(item), TestDataItemType.function);
    });
    test('Get TestDataItemType for Suites', () => {
        const item = createMockTestDataItem(TestDataItemType.suite);
        assert.equal(getTestDataItemType(item), TestDataItemType.suite);
    });
    test('Casting to a specific items', () => {
        for (const typeName of getNamesAndValues<TestDataItemType>(TestDataItemType)) {
            const item = createMockTestDataItem(typeName.value);
            const file = getTestFile(item);
            const folder = getTestFolder(item);
            const suite = getTestSuite(item);
            const func = getTestFunction(item);

            switch (typeName.value) {
                case TestDataItemType.file: {
                    assert.equal(file, item);
                    assert.equal(folder, undefined);
                    assert.equal(suite, undefined);
                    assert.equal(func, undefined);
                    break;
                }
                case TestDataItemType.folder: {
                    assert.equal(file, undefined);
                    assert.equal(folder, item);
                    assert.equal(suite, undefined);
                    assert.equal(func, undefined);
                    break;
                }
                case TestDataItemType.function: {
                    assert.equal(file, undefined);
                    assert.equal(folder, undefined);
                    assert.equal(suite, undefined);
                    assert.equal(func, item);
                    break;
                }
                case TestDataItemType.suite: {
                    assert.equal(file, undefined);
                    assert.equal(folder, undefined);
                    assert.equal(suite, item);
                    assert.equal(func, undefined);
                    break;
                }
                case TestDataItemType.workspaceFolder: {
                    assert.equal(file, undefined);
                    assert.equal(folder, undefined);
                    assert.equal(suite, undefined);
                    assert.equal(func, undefined);
                    break;
                }
                default:
                    throw new Error(`Unknown type ${typeName.name},${typeName.value}`);
            }
        }
    });
    test('Get Parent of folder', () => {
        const folder1 = createMockTestDataItem<TestFolder>(TestDataItemType.folder);
        const folder2 = createMockTestDataItem<TestFolder>(TestDataItemType.folder);
        const folder3 = createMockTestDataItem<TestFolder>(TestDataItemType.folder);
        const folder4 = createMockTestDataItem<TestFolder>(TestDataItemType.folder);
        const folder5 = createMockTestDataItem<TestFolder>(TestDataItemType.folder);
        folder1.folders.push(folder2);
        folder1.folders.push(folder3);
        folder2.folders.push(folder4);
        folder3.folders.push(folder5);
        const tests: Tests = {
            rootTestFolders: [folder1],
            summary: { errors: 0, skipped: 0, passed: 0, failures: 0 },
            testFiles: [],
            testFolders: [folder1, folder2, folder3, folder4, folder5],
            testFunctions: [],
            testSuites: [],
        };
        assert.equal(getParent(tests, folder1), undefined);
        assert.equal(getParent(tests, folder2), folder1);
        assert.equal(getParent(tests, folder3), folder1);
        assert.equal(getParent(tests, folder4), folder2);
        assert.equal(getParent(tests, folder5), folder3);
    });
    test('Get Parent of file', () => {
        const folder1 = createMockTestDataItem<TestFolder>(TestDataItemType.folder);
        const folder2 = createMockTestDataItem<TestFolder>(TestDataItemType.folder);
        const folder3 = createMockTestDataItem<TestFolder>(TestDataItemType.folder);
        const folder4 = createMockTestDataItem<TestFolder>(TestDataItemType.folder);
        const folder5 = createMockTestDataItem<TestFolder>(TestDataItemType.folder);
        folder1.folders.push(folder2);
        folder1.folders.push(folder3);
        folder2.folders.push(folder4);
        folder3.folders.push(folder5);

        const file1 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        const file2 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        const file3 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        const file4 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        folder1.testFiles.push(file1);
        folder3.testFiles.push(file2);
        folder3.testFiles.push(file3);
        folder5.testFiles.push(file4);
        const tests: Tests = {
            rootTestFolders: [folder1],
            summary: { errors: 0, skipped: 0, passed: 0, failures: 0 },
            testFiles: [file1, file2, file3, file4],
            testFolders: [folder1, folder2, folder3, folder4, folder5],
            testFunctions: [],
            testSuites: [],
        };
        assert.equal(getParent(tests, file1), folder1);
        assert.equal(getParent(tests, file2), folder3);
        assert.equal(getParent(tests, file3), folder3);
        assert.equal(getParent(tests, file4), folder5);
    });
    test('Get Parent File', () => {
        const file1 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        const file2 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        const file3 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        const file4 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        const suite1 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        const suite2 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        const suite3 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        const suite4 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        const suite5 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        const fn1 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        const fn2 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        const fn3 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        const fn4 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        const fn5 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        file1.suites.push(suite1);
        file1.suites.push(suite2);
        file3.suites.push(suite3);
        suite3.suites.push(suite4);
        suite4.suites.push(suite5);
        file1.functions.push(fn1);
        file1.functions.push(fn2);
        suite1.functions.push(fn3);
        suite1.functions.push(fn4);
        suite3.functions.push(fn5);
        const flattendSuite1: FlattenedTestSuite = {
            testSuite: suite1,
            xmlClassName: suite1.xmlName,
        } as any;
        const flattendSuite2: FlattenedTestSuite = {
            testSuite: suite2,
            xmlClassName: suite2.xmlName,
        } as any;
        const flattendSuite3: FlattenedTestSuite = {
            testSuite: suite3,
            xmlClassName: suite3.xmlName,
        } as any;
        const flattendSuite4: FlattenedTestSuite = {
            testSuite: suite4,
            xmlClassName: suite4.xmlName,
        } as any;
        const flattendSuite5: FlattenedTestSuite = {
            testSuite: suite5,
            xmlClassName: suite5.xmlName,
        } as any;
        const flattendFn1: FlattenedTestFunction = {
            testFunction: fn1,
            xmlClassName: fn1.name,
        } as any;
        const flattendFn2: FlattenedTestFunction = {
            testFunction: fn2,
            xmlClassName: fn2.name,
        } as any;
        const flattendFn3: FlattenedTestFunction = {
            testFunction: fn3,
            xmlClassName: fn3.name,
        } as any;
        const flattendFn4: FlattenedTestFunction = {
            testFunction: fn4,
            xmlClassName: fn4.name,
        } as any;
        const flattendFn5: FlattenedTestFunction = {
            testFunction: fn5,
            xmlClassName: fn5.name,
        } as any;
        const tests: Tests = {
            rootTestFolders: [],
            summary: { errors: 0, skipped: 0, passed: 0, failures: 0 },
            testFiles: [file1, file2, file3, file4],
            testFolders: [],
            testFunctions: [flattendFn1, flattendFn2, flattendFn3, flattendFn4, flattendFn5],
            testSuites: [flattendSuite1, flattendSuite2, flattendSuite3, flattendSuite4, flattendSuite5],
        };
        // Test parent file of functions (standalone and those in suites).
        assert.equal(getParentFile(tests, fn1), file1);
        assert.equal(getParentFile(tests, fn2), file1);
        assert.equal(getParentFile(tests, fn3), file1);
        assert.equal(getParentFile(tests, fn4), file1);
        assert.equal(getParentFile(tests, fn5), file3);

        // Test parent file of suites (standalone and nested suites).
        assert.equal(getParentFile(tests, suite1), file1);
        assert.equal(getParentFile(tests, suite2), file1);
        assert.equal(getParentFile(tests, suite3), file3);
        assert.equal(getParentFile(tests, suite4), file3);
        assert.equal(getParentFile(tests, suite5), file3);
    });
    test('Get Parent Suite', () => {
        const file1 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        const file2 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        const file3 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        const file4 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        const suite1 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        const suite2 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        const suite3 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        const suite4 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        const suite5 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        const fn1 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        const fn2 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        const fn3 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        const fn4 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        const fn5 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        file1.suites.push(suite1);
        file1.suites.push(suite2);
        file3.suites.push(suite3);
        suite3.suites.push(suite4);
        suite4.suites.push(suite5);
        file1.functions.push(fn1);
        file1.functions.push(fn2);
        suite1.functions.push(fn3);
        suite1.functions.push(fn4);
        suite3.functions.push(fn5);
        const flattendSuite1: FlattenedTestSuite = {
            testSuite: suite1,
            xmlClassName: suite1.xmlName,
        } as any;
        const flattendSuite2: FlattenedTestSuite = {
            testSuite: suite2,
            xmlClassName: suite2.xmlName,
        } as any;
        const flattendSuite3: FlattenedTestSuite = {
            testSuite: suite3,
            xmlClassName: suite3.xmlName,
        } as any;
        const flattendSuite4: FlattenedTestSuite = {
            testSuite: suite4,
            xmlClassName: suite4.xmlName,
        } as any;
        const flattendSuite5: FlattenedTestSuite = {
            testSuite: suite5,
            xmlClassName: suite5.xmlName,
        } as any;
        const flattendFn1: FlattenedTestFunction = {
            testFunction: fn1,
            xmlClassName: fn1.name,
        } as any;
        const flattendFn2: FlattenedTestFunction = {
            testFunction: fn2,
            xmlClassName: fn2.name,
        } as any;
        const flattendFn3: FlattenedTestFunction = {
            testFunction: fn3,
            xmlClassName: fn3.name,
        } as any;
        const flattendFn4: FlattenedTestFunction = {
            testFunction: fn4,
            xmlClassName: fn4.name,
        } as any;
        const flattendFn5: FlattenedTestFunction = {
            testFunction: fn5,
            xmlClassName: fn5.name,
        } as any;
        const tests: Tests = {
            rootTestFolders: [],
            summary: { errors: 0, skipped: 0, passed: 0, failures: 0 },
            testFiles: [file1, file2, file3, file4],
            testFolders: [],
            testFunctions: [flattendFn1, flattendFn2, flattendFn3, flattendFn4, flattendFn5],
            testSuites: [flattendSuite1, flattendSuite2, flattendSuite3, flattendSuite4, flattendSuite5],
        };
        // Test parent file of functions (standalone and those in suites).
        assert.equal(getParentSuite(tests, fn1), undefined);
        assert.equal(getParentSuite(tests, fn2), undefined);
        assert.equal(getParentSuite(tests, fn3), suite1);
        assert.equal(getParentSuite(tests, fn4), suite1);
        assert.equal(getParentSuite(tests, fn5), suite3);

        // Test parent file of suites (standalone and nested suites).
        assert.equal(getParentSuite(tests, suite1), undefined);
        assert.equal(getParentSuite(tests, suite2), undefined);
        assert.equal(getParentSuite(tests, suite3), undefined);
        assert.equal(getParentSuite(tests, suite4), suite3);
        assert.equal(getParentSuite(tests, suite5), suite4);
    });
    test('Get Parent file throws an exception', () => {
        const file1 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        const suite1 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        const fn1 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        const flattendSuite1: FlattenedTestSuite = {
            testSuite: suite1,
            xmlClassName: suite1.xmlName,
        } as any;
        const flattendFn1: FlattenedTestFunction = {
            testFunction: fn1,
            xmlClassName: fn1.name,
        } as any;
        const tests: Tests = {
            rootTestFolders: [],
            summary: { errors: 0, skipped: 0, passed: 0, failures: 0 },
            testFiles: [file1],
            testFolders: [],
            testFunctions: [flattendFn1],
            testSuites: [flattendSuite1],
        };
        assert.throws(() => getParentFile(tests, fn1), new RegExp('No parent file for provided test item'));
        assert.throws(() => getParentFile(tests, suite1), new RegExp('No parent file for provided test item'));
    });
    test('Get parent of orphaned items', () => {
        const file1 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        const suite1 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        const fn1 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        const flattendSuite1: FlattenedTestSuite = {
            testSuite: suite1,
            xmlClassName: suite1.xmlName,
        } as any;
        const flattendFn1: FlattenedTestFunction = {
            testFunction: fn1,
            xmlClassName: fn1.name,
        } as any;
        const tests: Tests = {
            rootTestFolders: [],
            summary: { errors: 0, skipped: 0, passed: 0, failures: 0 },
            testFiles: [file1],
            testFolders: [],
            testFunctions: [flattendFn1],
            testSuites: [flattendSuite1],
        };
        assert.equal(getParent(tests, fn1), undefined);
        assert.equal(getParent(tests, suite1), undefined);
    });
    test('Get Parent of suite', () => {
        const file1 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        const file2 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        const file3 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        const file4 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        const suite1 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        const suite2 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        const suite3 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        const suite4 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        const suite5 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        file1.suites.push(suite1);
        file1.suites.push(suite2);
        file3.suites.push(suite3);
        suite3.suites.push(suite4);
        suite4.suites.push(suite5);
        const flattendSuite1: FlattenedTestSuite = {
            testSuite: suite1,
            xmlClassName: suite1.xmlName,
        } as any;
        const flattendSuite2: FlattenedTestSuite = {
            testSuite: suite2,
            xmlClassName: suite2.xmlName,
        } as any;
        const flattendSuite3: FlattenedTestSuite = {
            testSuite: suite3,
            xmlClassName: suite3.xmlName,
        } as any;
        const flattendSuite4: FlattenedTestSuite = {
            testSuite: suite4,
            xmlClassName: suite4.xmlName,
        } as any;
        const flattendSuite5: FlattenedTestSuite = {
            testSuite: suite5,
            xmlClassName: suite5.xmlName,
        } as any;
        const tests: Tests = {
            rootTestFolders: [],
            summary: { errors: 0, skipped: 0, passed: 0, failures: 0 },
            testFiles: [file1, file2, file3, file4],
            testFolders: [],
            testFunctions: [],
            testSuites: [flattendSuite1, flattendSuite2, flattendSuite3, flattendSuite4, flattendSuite5],
        };
        assert.equal(getParent(tests, suite1), file1);
        assert.equal(getParent(tests, suite2), file1);
        assert.equal(getParent(tests, suite3), file3);
        assert.equal(getParent(tests, suite4), suite3);
        assert.equal(getParent(tests, suite5), suite4);
    });
    test('Get Parent of function', () => {
        const file1 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        const file2 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        const file3 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        const file4 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        const suite1 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        const suite2 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        const suite3 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        const suite4 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        const suite5 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        const fn1 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        const fn2 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        const fn3 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        const fn4 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        const fn5 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        file1.suites.push(suite1);
        file1.suites.push(suite2);
        file3.suites.push(suite3);
        suite3.suites.push(suite4);
        suite4.suites.push(suite5);
        file1.functions.push(fn1);
        file1.functions.push(fn2);
        suite1.functions.push(fn3);
        suite1.functions.push(fn4);
        suite3.functions.push(fn5);
        const flattendSuite1: FlattenedTestSuite = {
            testSuite: suite1,
            xmlClassName: suite1.xmlName,
        } as any;
        const flattendSuite2: FlattenedTestSuite = {
            testSuite: suite2,
            xmlClassName: suite2.xmlName,
        } as any;
        const flattendSuite3: FlattenedTestSuite = {
            testSuite: suite3,
            xmlClassName: suite3.xmlName,
        } as any;
        const flattendSuite4: FlattenedTestSuite = {
            testSuite: suite4,
            xmlClassName: suite4.xmlName,
        } as any;
        const flattendSuite5: FlattenedTestSuite = {
            testSuite: suite5,
            xmlClassName: suite5.xmlName,
        } as any;
        const flattendFn1: FlattenedTestFunction = {
            testFunction: fn1,
            xmlClassName: fn1.name,
        } as any;
        const flattendFn2: FlattenedTestFunction = {
            testFunction: fn2,
            xmlClassName: fn2.name,
        } as any;
        const flattendFn3: FlattenedTestFunction = {
            testFunction: fn3,
            xmlClassName: fn3.name,
        } as any;
        const flattendFn4: FlattenedTestFunction = {
            testFunction: fn4,
            xmlClassName: fn4.name,
        } as any;
        const flattendFn5: FlattenedTestFunction = {
            testFunction: fn5,
            xmlClassName: fn5.name,
        } as any;
        const tests: Tests = {
            rootTestFolders: [],
            summary: { errors: 0, skipped: 0, passed: 0, failures: 0 },
            testFiles: [file1, file2, file3, file4],
            testFolders: [],
            testFunctions: [flattendFn1, flattendFn2, flattendFn3, flattendFn4, flattendFn5],
            testSuites: [flattendSuite1, flattendSuite2, flattendSuite3, flattendSuite4, flattendSuite5],
        };
        assert.equal(getParent(tests, fn1), file1);
        assert.equal(getParent(tests, fn2), file1);
        assert.equal(getParent(tests, fn3), suite1);
        assert.equal(getParent(tests, fn4), suite1);
        assert.equal(getParent(tests, fn5), suite3);
    });
    test('Get parent of parameterized function', () => {
        const folder = createMockTestDataItem<TestFolder>(TestDataItemType.folder);
        const file = createMockTestDataItem<TestFile>(TestDataItemType.file);
        const func1 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        const func2 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        const func3 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        const subParent1 = createSubtestParent([func2, func3]);
        const suite = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        const func4 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        const func5 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        const func6 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        const subParent2 = createSubtestParent([func5, func6]);
        folder.testFiles.push(file);
        file.functions.push(func1);
        file.functions.push(func2);
        file.functions.push(func3);
        file.suites.push(suite);
        suite.functions.push(func4);
        suite.functions.push(func5);
        suite.functions.push(func6);
        const tests = createTests([folder], [file], [suite], [func1, func2, func3, func4, func5, func6]);

        assert.equal(getParent(tests, folder), undefined);
        assert.equal(getParent(tests, file), folder);
        assert.equal(getParent(tests, func1), file);
        assert.equal(getParent(tests, subParent1.asSuite), file);
        assert.equal(getParent(tests, func2), subParent1.asSuite);
        assert.equal(getParent(tests, func3), subParent1.asSuite);
        assert.equal(getParent(tests, suite), file);
        assert.equal(getParent(tests, func4), suite);
        assert.equal(getParent(tests, subParent2.asSuite), suite);
        assert.equal(getParent(tests, func5), subParent2.asSuite);
        assert.equal(getParent(tests, func6), subParent2.asSuite);
    });
    test('Get children of parameterized function', () => {
        const filename = path.join('tests', 'test_spam.py');
        const folder = createMockTestDataItem<TestFolder>(TestDataItemType.folder, 'tests');
        const file = createMockTestDataItem<TestFile>(TestDataItemType.file, filename);
        const func1 = createMockTestDataItem<TestFunction>(TestDataItemType.function, 'test_x');
        const func2 = createMockTestDataItem<TestFunction>(TestDataItemType.function, 'test_y');
        const func3 = createMockTestDataItem<TestFunction>(TestDataItemType.function, 'test_z');
        const subParent1 = createSubtestParent([func2, func3]);
        const suite = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        const func4 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        const func5 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        const func6 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        const subParent2 = createSubtestParent([func5, func6]);
        folder.testFiles.push(file);
        file.functions.push(func1);
        file.functions.push(func2);
        file.functions.push(func3);
        file.suites.push(suite);
        suite.functions.push(func4);
        suite.functions.push(func5);
        suite.functions.push(func6);

        assert.deepEqual(getChildren(folder), [file]);
        assert.deepEqual(getChildren(file), [func1, suite, subParent1.asSuite]);
        assert.deepEqual(getChildren(func1), []);
        assert.deepEqual(getChildren(subParent1.asSuite), [func2, func3]);
        assert.deepEqual(getChildren(func2), []);
        assert.deepEqual(getChildren(func3), []);
        assert.deepEqual(getChildren(suite), [func4, subParent2.asSuite]);
        assert.deepEqual(getChildren(func4), []);
        assert.deepEqual(getChildren(subParent2.asSuite), [func5, func6]);
        assert.deepEqual(getChildren(func5), []);
        assert.deepEqual(getChildren(func6), []);
    });
});

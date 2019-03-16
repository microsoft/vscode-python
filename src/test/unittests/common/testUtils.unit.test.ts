// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import * as path from 'path';
import { Uri } from 'vscode';
import { getNamesAndValues } from '../../../client/common/utils/enum';
import {
    getChildren, getParent, getTestFile, getTestFolder, getTestFunction,
    getTestSuite, getTestType
} from '../../../client/unittests/common/testUtils';
import {
    FlattenedTestFunction, FlattenedTestSuite, SubtestParent, TestFile,
    TestFolder, TestFunction, Tests, TestSuite, TestType
} from '../../../client/unittests/common/types';
import {
    TestDataItem, TestWorkspaceFolder
} from '../../../client/unittests/types';

// tslint:disable:prefer-template

function longestCommonSubstring(strings: string[]): string {
    strings = strings.concat().sort();
    let substr = strings.shift() || '';
    strings.forEach(str => {
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
    type: TestType,
    nameSuffix: string = '',
    name?: string,
    nameToRun?: string
) {
    const folder: TestFolder = {
        resource: Uri.file(__filename),
        folders: [],
        name: name || 'Some Folder' + nameSuffix,
        nameToRun: nameToRun || name || ' Some Folder' + nameSuffix,
        testFiles: [],
        time: 0
    };
    const file: TestFile = {
        resource: Uri.file(__filename),
        name: name || 'Some File' + nameSuffix,
        nameToRun: nameToRun || name || ' Some File' + nameSuffix,
        fullPath: __filename,
        xmlName: name || 'some xml name' + nameSuffix,
        functions: [],
        suites: [],
        time: 0
    };
    const func: TestFunction = {
        resource: Uri.file(__filename),
        name: name || 'Some Function' + nameSuffix,
        nameToRun: nameToRun || name || ' Some Function' + nameSuffix,
        time: 0
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
        time: 0
    };

    switch (type) {
        case TestType.testFile:
            return file as T;
        case TestType.testFolder:
            return folder as T;
        case TestType.testFunction:
            return func as T;
        case TestType.testSuite:
            return suite as T;
        case TestType.testWorkspaceFolder:
            return (new TestWorkspaceFolder({ uri: Uri.file(''), name: 'a', index: 0 })) as T;
        default:
            throw new Error('Unknown type');
    }
}

export function createSubtestParent(funcs: TestFunction[]): SubtestParent {
    const name = longestCommonSubstring(funcs.map(func => func.name));
    const nameToRun = longestCommonSubstring(funcs.map(func => func.nameToRun));
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
            time: 0
        },
        time: 0
    };
    funcs.forEach(func => {
        func.subtestParent = subtestParent;
    });
    return subtestParent;
}

export function createTests(
    folders: TestFolder[],
    files: TestFile[],
    suites: TestSuite[],
    funcs: TestFunction[]
): Tests {
    // tslint:disable:no-any
    return {
        summary: { errors: 0, skipped: 0, passed: 0, failures: 0 },
        rootTestFolders: folders.length > 0 ? [folders[0]] : [],
        testFolders: folders,
        testFiles: files,
        testSuites: suites.map(suite => {
            return {
                testSuite: suite,
                xmlClassName: suite.xmlName
            } as any;
        }),
        testFunctions: funcs.map(func => {
            return {
                testFunction: func,
                xmlClassName: func.name
            } as any;
        })
    };
}

// tslint:disable:max-func-body-length no-any
suite('Unit Tests - TestUtils', () => {
    test('Get TestType for Folders', () => {
        const item = createMockTestDataItem(TestType.testFolder);
        assert.equal(getTestType(item), TestType.testFolder);
    });
    test('Get TestType for Files', () => {
        const item = createMockTestDataItem(TestType.testFile);
        assert.equal(getTestType(item), TestType.testFile);
    });
    test('Get TestType for Functions', () => {
        const item = createMockTestDataItem(TestType.testFunction);
        assert.equal(getTestType(item), TestType.testFunction);
    });
    test('Get TestType for Suites', () => {
        const item = createMockTestDataItem(TestType.testSuite);
        assert.equal(getTestType(item), TestType.testSuite);
    });
    test('Casting to a specific items', () => {
        for (const typeName of getNamesAndValues<TestType>(TestType)) {
            const item = createMockTestDataItem(typeName.value);
            const file = getTestFile(item);
            const folder = getTestFolder(item);
            const suite = getTestSuite(item);
            const func = getTestFunction(item);

            switch (typeName.value) {
                case TestType.testFile:
                    {
                        assert.equal(file, item);
                        assert.equal(folder, undefined);
                        assert.equal(suite, undefined);
                        assert.equal(func, undefined);
                        break;
                    }
                case TestType.testFolder:
                    {
                        assert.equal(file, undefined);
                        assert.equal(folder, item);
                        assert.equal(suite, undefined);
                        assert.equal(func, undefined);
                        break;
                    }
                case TestType.testFunction:
                    {
                        assert.equal(file, undefined);
                        assert.equal(folder, undefined);
                        assert.equal(suite, undefined);
                        assert.equal(func, item);
                        break;
                    }
                case TestType.testSuite:
                    {
                        assert.equal(file, undefined);
                        assert.equal(folder, undefined);
                        assert.equal(suite, item);
                        assert.equal(func, undefined);
                        break;
                    }
                case TestType.testWorkspaceFolder:
                    {
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
        const folder1 = createMockTestDataItem<TestFolder>(TestType.testFolder);
        const folder2 = createMockTestDataItem<TestFolder>(TestType.testFolder);
        const folder3 = createMockTestDataItem<TestFolder>(TestType.testFolder);
        const folder4 = createMockTestDataItem<TestFolder>(TestType.testFolder);
        const folder5 = createMockTestDataItem<TestFolder>(TestType.testFolder);
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
            testSuites: []
        };
        assert.equal(getParent(tests, folder1), undefined);
        assert.equal(getParent(tests, folder2), folder1);
        assert.equal(getParent(tests, folder3), folder1);
        assert.equal(getParent(tests, folder4), folder2);
        assert.equal(getParent(tests, folder5), folder3);
    });
    test('Get Parent of file', () => {
        const folder1 = createMockTestDataItem<TestFolder>(TestType.testFolder);
        const folder2 = createMockTestDataItem<TestFolder>(TestType.testFolder);
        const folder3 = createMockTestDataItem<TestFolder>(TestType.testFolder);
        const folder4 = createMockTestDataItem<TestFolder>(TestType.testFolder);
        const folder5 = createMockTestDataItem<TestFolder>(TestType.testFolder);
        folder1.folders.push(folder2);
        folder1.folders.push(folder3);
        folder2.folders.push(folder4);
        folder3.folders.push(folder5);

        const file1 = createMockTestDataItem<TestFile>(TestType.testFile);
        const file2 = createMockTestDataItem<TestFile>(TestType.testFile);
        const file3 = createMockTestDataItem<TestFile>(TestType.testFile);
        const file4 = createMockTestDataItem<TestFile>(TestType.testFile);
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
            testSuites: []
        };
        assert.equal(getParent(tests, file1), folder1);
        assert.equal(getParent(tests, file2), folder3);
        assert.equal(getParent(tests, file3), folder3);
        assert.equal(getParent(tests, file4), folder5);
    });
    test('Get Parent of suite', () => {
        const file1 = createMockTestDataItem<TestFile>(TestType.testFile);
        const file2 = createMockTestDataItem<TestFile>(TestType.testFile);
        const file3 = createMockTestDataItem<TestFile>(TestType.testFile);
        const file4 = createMockTestDataItem<TestFile>(TestType.testFile);
        const suite1 = createMockTestDataItem<TestSuite>(TestType.testSuite);
        const suite2 = createMockTestDataItem<TestSuite>(TestType.testSuite);
        const suite3 = createMockTestDataItem<TestSuite>(TestType.testSuite);
        const suite4 = createMockTestDataItem<TestSuite>(TestType.testSuite);
        const suite5 = createMockTestDataItem<TestSuite>(TestType.testSuite);
        file1.suites.push(suite1);
        file1.suites.push(suite2);
        file3.suites.push(suite3);
        suite3.suites.push(suite4);
        suite4.suites.push(suite5);
        const flattendSuite1: FlattenedTestSuite = {
            testSuite: suite1,
            xmlClassName: suite1.xmlName
        } as any;
        const flattendSuite2: FlattenedTestSuite = {
            testSuite: suite2,
            xmlClassName: suite2.xmlName
        } as any;
        const flattendSuite3: FlattenedTestSuite = {
            testSuite: suite3,
            xmlClassName: suite3.xmlName
        } as any;
        const flattendSuite4: FlattenedTestSuite = {
            testSuite: suite4,
            xmlClassName: suite4.xmlName
        } as any;
        const flattendSuite5: FlattenedTestSuite = {
            testSuite: suite5,
            xmlClassName: suite5.xmlName
        } as any;
        const tests: Tests = {
            rootTestFolders: [],
            summary: { errors: 0, skipped: 0, passed: 0, failures: 0 },
            testFiles: [file1, file2, file3, file4],
            testFolders: [],
            testFunctions: [],
            testSuites: [flattendSuite1, flattendSuite2, flattendSuite3, flattendSuite4, flattendSuite5]
        };
        assert.equal(getParent(tests, suite1), file1);
        assert.equal(getParent(tests, suite2), file1);
        assert.equal(getParent(tests, suite3), file3);
        assert.equal(getParent(tests, suite4), suite3);
        assert.equal(getParent(tests, suite5), suite4);
    });
    test('Get Parent of function', () => {
        const file1 = createMockTestDataItem<TestFile>(TestType.testFile);
        const file2 = createMockTestDataItem<TestFile>(TestType.testFile);
        const file3 = createMockTestDataItem<TestFile>(TestType.testFile);
        const file4 = createMockTestDataItem<TestFile>(TestType.testFile);
        const suite1 = createMockTestDataItem<TestSuite>(TestType.testSuite);
        const suite2 = createMockTestDataItem<TestSuite>(TestType.testSuite);
        const suite3 = createMockTestDataItem<TestSuite>(TestType.testSuite);
        const suite4 = createMockTestDataItem<TestSuite>(TestType.testSuite);
        const suite5 = createMockTestDataItem<TestSuite>(TestType.testSuite);
        const fn1 = createMockTestDataItem<TestFunction>(TestType.testFunction);
        const fn2 = createMockTestDataItem<TestFunction>(TestType.testFunction);
        const fn3 = createMockTestDataItem<TestFunction>(TestType.testFunction);
        const fn4 = createMockTestDataItem<TestFunction>(TestType.testFunction);
        const fn5 = createMockTestDataItem<TestFunction>(TestType.testFunction);
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
            xmlClassName: suite1.xmlName
        } as any;
        const flattendSuite2: FlattenedTestSuite = {
            testSuite: suite2,
            xmlClassName: suite2.xmlName
        } as any;
        const flattendSuite3: FlattenedTestSuite = {
            testSuite: suite3,
            xmlClassName: suite3.xmlName
        } as any;
        const flattendSuite4: FlattenedTestSuite = {
            testSuite: suite4,
            xmlClassName: suite4.xmlName
        } as any;
        const flattendSuite5: FlattenedTestSuite = {
            testSuite: suite5,
            xmlClassName: suite5.xmlName
        } as any;
        const flattendFn1: FlattenedTestFunction = {
            testFunction: fn1,
            xmlClassName: fn1.name
        } as any;
        const flattendFn2: FlattenedTestFunction = {
            testFunction: fn2,
            xmlClassName: fn2.name
        } as any;
        const flattendFn3: FlattenedTestFunction = {
            testFunction: fn3,
            xmlClassName: fn3.name
        } as any;
        const flattendFn4: FlattenedTestFunction = {
            testFunction: fn4,
            xmlClassName: fn4.name
        } as any;
        const flattendFn5: FlattenedTestFunction = {
            testFunction: fn5,
            xmlClassName: fn5.name
        } as any;
        const tests: Tests = {
            rootTestFolders: [],
            summary: { errors: 0, skipped: 0, passed: 0, failures: 0 },
            testFiles: [file1, file2, file3, file4],
            testFolders: [],
            testFunctions: [flattendFn1, flattendFn2, flattendFn3, flattendFn4, flattendFn5],
            testSuites: [flattendSuite1, flattendSuite2, flattendSuite3, flattendSuite4, flattendSuite5]
        };
        assert.equal(getParent(tests, fn1), file1);
        assert.equal(getParent(tests, fn2), file1);
        assert.equal(getParent(tests, fn3), suite1);
        assert.equal(getParent(tests, fn4), suite1);
        assert.equal(getParent(tests, fn5), suite3);
    });
    test('Get parent of parameterized function', () => {
        const folder = createMockTestDataItem<TestFolder>(TestType.testFolder);
        const file = createMockTestDataItem<TestFile>(TestType.testFile);
        const func1 = createMockTestDataItem<TestFunction>(TestType.testFunction);
        const func2 = createMockTestDataItem<TestFunction>(TestType.testFunction);
        const func3 = createMockTestDataItem<TestFunction>(TestType.testFunction);
        const subParent1 = createSubtestParent([func2, func3]);
        const suite = createMockTestDataItem<TestSuite>(TestType.testSuite);
        const func4 = createMockTestDataItem<TestFunction>(TestType.testFunction);
        const func5 = createMockTestDataItem<TestFunction>(TestType.testFunction);
        const func6 = createMockTestDataItem<TestFunction>(TestType.testFunction);
        const subParent2 = createSubtestParent([func5, func6]);
        folder.testFiles.push(file);
        file.functions.push(func1);
        file.functions.push(func2);
        file.functions.push(func3);
        file.suites.push(suite);
        suite.functions.push(func4);
        suite.functions.push(func5);
        suite.functions.push(func6);
        const tests = createTests(
            [folder],
            [file],
            [suite],
            [func1, func2, func3, func4, func5, func6]
        );

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
        const folder = createMockTestDataItem<TestFolder>(TestType.testFolder, 'tests');
        const file = createMockTestDataItem<TestFile>(TestType.testFile, filename);
        const func1 = createMockTestDataItem<TestFunction>(TestType.testFunction, 'test_x');
        const func2 = createMockTestDataItem<TestFunction>(TestType.testFunction, 'test_y');
        const func3 = createMockTestDataItem<TestFunction>(TestType.testFunction, 'test_z');
        const subParent1 = createSubtestParent([func2, func3]);
        const suite = createMockTestDataItem<TestSuite>(TestType.testSuite);
        const func4 = createMockTestDataItem<TestFunction>(TestType.testFunction);
        const func5 = createMockTestDataItem<TestFunction>(TestType.testFunction);
        const func6 = createMockTestDataItem<TestFunction>(TestType.testFunction);
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

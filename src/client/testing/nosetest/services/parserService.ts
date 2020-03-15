// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as os from 'os';
import * as path from 'path';
import { Uri } from 'vscode';
import { convertFileToPackage, extractBetweenDelimiters } from '../../common/testUtils';
import {
    ITestsHelper,
    ITestsParser,
    ParserOptions,
    TestFile,
    TestFunction,
    Tests,
    TestSuite
} from '../../common/types';

const NOSE_WANT_FILE_PREFIX = 'nose.selector: DEBUG: wantFile ';
const NOSE_WANT_FILE_SUFFIX = '.py? True';
const NOSE_WANT_FILE_SUFFIX_WITHOUT_EXT = '? True';

@injectable()
export class TestsParser implements ITestsParser {
    constructor(@inject(ITestsHelper) private testsHelper: ITestsHelper) {}
    public parse(content: string, options: ParserOptions): Tests {
        let testFiles = this.getTestFiles(content, options);
        // Exclude tests that don't have any functions or test suites.
        testFiles = testFiles.filter(testFile => testFile.suites.length > 0 || testFile.functions.length > 0);
        return this.testsHelper.flattenTestFiles(testFiles, options.cwd);
    }

    private getTestFiles(content: string, options: ParserOptions) {
        let logOutputLines: string[] = [''];
        const testFiles: TestFile[] = [];
        content.split(/\r?\n/g).forEach((line, index, lines) => {
            if (
                (line.startsWith(NOSE_WANT_FILE_PREFIX) && line.endsWith(NOSE_WANT_FILE_SUFFIX)) ||
                index === lines.length - 1
            ) {
                // process the previous lines.
                this.parseNoseTestModuleCollectionResult(options.cwd, logOutputLines, testFiles);
                logOutputLines = [''];
            }

            if (index === 0) {
                if (content.startsWith(os.EOL) || lines.length > 1) {
                    this.appendLine(line, logOutputLines);
                    return;
                }
                logOutputLines[logOutputLines.length - 1] += line;
                return;
            }
            if (index === lines.length - 1) {
                logOutputLines[logOutputLines.length - 1] += line;
                return;
            }
            this.appendLine(line, logOutputLines);
            return;
        });

        return testFiles;
    }
    private appendLine(line: string, logOutputLines: string[]) {
        const lastLineIndex = logOutputLines.length - 1;
        logOutputLines[lastLineIndex] += line;

        // Check whether the previous line is something that we need.
        // What we need is a line that ends with ? True,
        //  and starts with nose.selector: DEBUG: want.
        if (logOutputLines[lastLineIndex].endsWith('? True')) {
            logOutputLines.push('');
        } else {
            // We don't need this line
            logOutputLines[lastLineIndex] = '';
        }
    }

    private parseNoseTestModuleCollectionResult(rootDirectory: string, lines: string[], testFiles: TestFile[]) {
        let currentPackage: string = '';
        let fileName = '';
        let testFile: TestFile;
        const resource = Uri.file(rootDirectory);
        // tslint:disable-next-line: max-func-body-length
        lines.forEach(line => {
            if (line.startsWith(NOSE_WANT_FILE_PREFIX) && line.endsWith(NOSE_WANT_FILE_SUFFIX)) {
                fileName = line.substring(NOSE_WANT_FILE_PREFIX.length);
                fileName = fileName.substring(0, fileName.lastIndexOf(NOSE_WANT_FILE_SUFFIX_WITHOUT_EXT));

                // We need to display the path relative to the current directory.
                fileName = fileName.substring(rootDirectory.length + 1);
                // we don't care about the compiled file.
                if (path.extname(fileName) === '.pyc' || path.extname(fileName) === '.pyo') {
                    fileName = fileName.substring(0, fileName.length - 1);
                }
                currentPackage = convertFileToPackage(fileName);
                const fullyQualifiedName = path.isAbsolute(fileName) ? fileName : path.resolve(rootDirectory, fileName);
                testFile = {
                    resource,
                    functions: [],
                    suites: [],
                    name: fileName,
                    nameToRun: fileName,
                    xmlName: currentPackage,
                    time: 0,
                    functionsFailed: 0,
                    functionsPassed: 0,
                    fullPath: fullyQualifiedName
                };
                testFiles.push(testFile);
                return;
            }

            if (line.startsWith("nose.selector: DEBUG: wantClass <class '")) {
                const name = extractBetweenDelimiters(line, "nose.selector: DEBUG: wantClass <class '", "'>? True");
                const clsName = path.extname(name).substring(1);
                const testSuite: TestSuite = {
                    resource,
                    name: clsName,
                    nameToRun: `${fileName}:${clsName}`,
                    functions: [],
                    suites: [],
                    xmlName: name,
                    time: 0,
                    isUnitTest: false,
                    isInstance: false,
                    functionsFailed: 0,
                    functionsPassed: 0
                };
                testFile.suites.push(testSuite);
                return;
            }
            if (line.startsWith('nose.selector: DEBUG: wantClass ')) {
                const name = extractBetweenDelimiters(line, 'nose.selector: DEBUG: wantClass ', '? True');
                const testSuite: TestSuite = {
                    resource,
                    name: path.extname(name).substring(1),
                    nameToRun: `${fileName}:.${name}`,
                    functions: [],
                    suites: [],
                    xmlName: name,
                    time: 0,
                    isUnitTest: false,
                    isInstance: false,
                    functionsFailed: 0,
                    functionsPassed: 0
                };
                testFile.suites.push(testSuite);
                return;
            }
            if (line.startsWith('nose.selector: DEBUG: wantMethod <unbound method ')) {
                const name = extractBetweenDelimiters(
                    line,
                    'nose.selector: DEBUG: wantMethod <unbound method ',
                    '>? True'
                );
                const fnName = path.extname(name).substring(1);
                const clsName = path.basename(name, path.extname(name));
                const fn: TestFunction = {
                    resource,
                    name: fnName,
                    nameToRun: `${fileName}:${clsName}.${fnName}`,
                    time: 0,
                    functionsFailed: 0,
                    functionsPassed: 0
                };

                const cls = testFile.suites.find(suite => suite.name === clsName);
                if (cls) {
                    cls.functions.push(fn);
                }
                return;
            }
            if (line.startsWith('nose.selector: DEBUG: wantFunction <function ')) {
                const name = extractBetweenDelimiters(line, 'nose.selector: DEBUG: wantFunction <function ', ' at ');
                const fn: TestFunction = {
                    resource,
                    name: name,
                    nameToRun: `${fileName}:${name}`,
                    time: 0,
                    functionsFailed: 0,
                    functionsPassed: 0
                };
                testFile.functions.push(fn);
                return;
            }
        });
    }
}

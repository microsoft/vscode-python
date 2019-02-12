// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as os from 'os';
import * as path from 'path';
import '../../../common/extensions';
import { convertFileToPackage, extractBetweenDelimiters } from '../../common/testUtils';
import { ITestsHelper, ITestsParser, ParserOptions, TestFile, TestFunction, Tests, TestSuite } from '../../common/types';

@injectable()
export class TestsParser implements ITestsParser {

    constructor(@inject(ITestsHelper) private testsHelper: ITestsHelper) { }

    public parse(content: string, options: ParserOptions): Tests {
        const testFiles = this.getTestFiles(content, options);
        return this.testsHelper.flattenTestFiles(testFiles);
    }

    private getTestFiles(content: string, options: ParserOptions) {
        let logOutputLines: string[] = [''];
        const testFiles: TestFile[] = [];
        const parentNodes: { indent: number; item: TestFile | TestSuite }[] = [];

        const errorLine = /==*( *)ERRORS( *)=*/;
        const errorFileLine = /__*( *)ERROR collecting (.*)/;
        const lastLineWithErrors = /==*.*/;

        let haveErrors = false;

        let packagePrefix: string = '';
        content.split(/\r?\n/g).forEach((line, index, lines) => {
            if (options.token && options.token.isCancellationRequested) {
                return;
            }

            const trimmedLine: string = line.trim();

            if (trimmedLine.startsWith('<Package ')) {
                // Process the previous lines.
                this.parsePyTestModuleCollectionResult(options.cwd, logOutputLines, testFiles, parentNodes, packagePrefix);
                logOutputLines = [''];

                packagePrefix = this.extractPackageName(trimmedLine, options.cwd);
            }

            if (trimmedLine.startsWith('<Module ') || index === lines.length - 1) {
                // Process the previous lines.
                this.parsePyTestModuleCollectionResult(options.cwd, logOutputLines, testFiles, parentNodes, packagePrefix);
                logOutputLines = [''];
            }
            if (errorLine.test(line)) {
                haveErrors = true;
                logOutputLines = [''];
                return;
            }
            if (errorFileLine.test(line)) {
                haveErrors = true;
                if (logOutputLines.length !== 1 && logOutputLines[0].length !== 0) {
                    this.parsePyTestModuleCollectionError(options.cwd, logOutputLines, testFiles, parentNodes);
                    logOutputLines = [''];
                }
            }
            if (lastLineWithErrors.test(line) && haveErrors) {
                this.parsePyTestModuleCollectionError(options.cwd, logOutputLines, testFiles, parentNodes);
                logOutputLines = [''];
            }
            if (index === 0) {
                if (content.startsWith(os.EOL) || lines.length > 1) {
                    logOutputLines[logOutputLines.length - 1] += line;
                    logOutputLines.push('');
                    return;
                }
                logOutputLines[logOutputLines.length - 1] += line;
                return;
            }
            if (index === lines.length - 1) {
                logOutputLines[logOutputLines.length - 1] += line;
                return;
            }
            logOutputLines[logOutputLines.length - 1] += line;
            logOutputLines.push('');
            return;
        });

        return testFiles;
    }

    private parsePyTestModuleCollectionError(rootDirectory: string, lines: string[], testFiles: TestFile[],
        parentNodes: { indent: number; item: TestFile | TestSuite }[]) {

        lines = lines.filter(line => line.trim().length > 0);
        if (lines.length <= 1) {
            return;
        }

        const errorFileLine = lines[0];
        let fileName = errorFileLine.substring(errorFileLine.indexOf('ERROR collecting') + 'ERROR collecting'.length).trim();
        fileName = fileName.substr(0, fileName.lastIndexOf(' '));

        const currentPackage = convertFileToPackage(fileName);
        const fullyQualifiedName = path.isAbsolute(fileName) ? fileName : path.resolve(rootDirectory, fileName);
        const testFile = {
            functions: [], suites: [], name: fileName, fullPath: fullyQualifiedName,
            nameToRun: fileName, xmlName: currentPackage, time: 0, errorsWhenDiscovering: lines.join('\n')
        };
        testFiles.push(testFile);
        parentNodes.push({ indent: 0, item: testFile });

        return;

    }

    /**
     * Extract the 'package' name from a given PyTest (>= 3.7) output line.
     *
     * @param packageLine A single line of output from pytest that starts with `<Package` (may have leading white space).
     * @param rootDir Value is pytest's `--rootdir=` parameter.
     */
    private extractPackageName(packageLine: string, rootDir: string): string {
        const packagePath: string = extractBetweenDelimiters(packageLine, '<Package ', '>').trimQuotes();
        let packageName: string = path.normalize(packagePath);
        const tmpRoot: string = path.normalize(rootDir);

        if (packageName.indexOf(tmpRoot) === 0) {
            packageName = packageName.substring(tmpRoot.length);
            if (packageName.startsWith(path.sep)) {
                packageName = packageName.substring(1);
            }
            if (packageName.endsWith(path.sep)) {
                packageName = packageName.substring(0, packageName.length - 1);
            }
        }
        packageName = packageName.replace(/\\/g, '/');
        return packageName;
    }

    private parsePyTestModuleCollectionResult(
        rootDirectory: string,
        lines: string[],
        testFiles: TestFile[],
        parentNodes: { indent: number; item: TestFile | TestSuite }[],
        packagePrefix: string = ''
    ) {

        let currentPackage: string = '';

        lines.forEach(line => {
            const trimmedLine = line.trim();
            let name: string = '';
            const indent = line.indexOf('<');

            if (trimmedLine.startsWith('<Module ')) {
                name = extractBetweenDelimiters(trimmedLine, '<Module ', '>').trimQuotes();
                if (packagePrefix && packagePrefix.length > 0) {
                    name = packagePrefix.concat('/', name);
                }
                currentPackage = convertFileToPackage(name);
                const fullyQualifiedName = path.isAbsolute(name) ? name : path.resolve(rootDirectory, name);
                const testFile = {
                    functions: [], suites: [], name: name, fullPath: fullyQualifiedName,
                    nameToRun: name, xmlName: currentPackage, time: 0
                };
                testFiles.push(testFile);
                parentNodes.push({ indent: indent, item: testFile });
                return;
            }

            const parentNode = this.findParentOfCurrentItem(indent, parentNodes);

            if (parentNode && (trimmedLine.startsWith('<Class ') || trimmedLine.startsWith('<UnitTestCase '))) {
                const isUnitTest = trimmedLine.startsWith('<UnitTestCase ');
                if (isUnitTest) {
                    name = extractBetweenDelimiters(trimmedLine, '<UnitTestCase ', '>');
                } else {
                    name = extractBetweenDelimiters(trimmedLine, '<Class ', '>');
                }
                name = name.trimQuotes();

                const rawName = `${parentNode!.item.nameToRun}::${name}`;
                const xmlName = `${parentNode!.item.xmlName}.${name}`;
                const testSuite: TestSuite = { name: name, nameToRun: rawName, functions: [], suites: [], isUnitTest: isUnitTest, isInstance: false, xmlName: xmlName, time: 0 };
                parentNode!.item.suites.push(testSuite);
                parentNodes.push({ indent: indent, item: testSuite });
                return;
            }
            if (parentNode && trimmedLine.startsWith('<Instance ')) {
                name = extractBetweenDelimiters(trimmedLine, '<Instance ', '>').trimQuotes();
                // tslint:disable-next-line:prefer-type-cast
                const suite = (parentNode!.item as TestSuite);
                // suite.rawName = suite.rawName + '::()';
                // suite.xmlName = suite.xmlName + '.()';
                suite.isInstance = true;
                return;
            }
            if (parentNode && (trimmedLine.startsWith('<TestCaseFunction ') || trimmedLine.startsWith('<Function '))) {
                if (trimmedLine.startsWith('<Function ')) {
                    name = extractBetweenDelimiters(trimmedLine, '<Function ', '>');
                } else {
                    name = extractBetweenDelimiters(trimmedLine, '<TestCaseFunction ', '>');
                }
                name = name.trimQuotes();

                const rawName = `${parentNode!.item.nameToRun}::${name}`;
                const fn: TestFunction = { name: name, nameToRun: rawName, time: 0 };
                parentNode!.item.functions.push(fn);
                return;
            }
        });
    }

    private findParentOfCurrentItem(indentOfCurrentItem: number, parentNodes: { indent: number; item: TestFile | TestSuite }[]): { indent: number; item: TestFile | TestSuite } | undefined {
        while (parentNodes.length > 0) {
            const parentNode = parentNodes[parentNodes.length - 1];
            if (parentNode.indent < indentOfCurrentItem) {
                return parentNode;
            }
            parentNodes.pop();
            continue;
        }

        return;
    }
}

/* Sample output from pytest --collect-only
<Module 'test_another.py'>
  <Class 'Test_CheckMyApp'>
    <Instance '()'>
      <Function 'test_simple_check'>
      <Function 'test_complex_check'>
<Module 'test_one.py'>
  <UnitTestCase 'Test_test1'>
    <TestCaseFunction 'test_A'>
    <TestCaseFunction 'test_B'>
<Module 'test_two.py'>
  <UnitTestCase 'Test_test1'>
    <TestCaseFunction 'test_A2'>
    <TestCaseFunction 'test_B2'>
<Module 'testPasswords/test_Pwd.py'>
  <UnitTestCase 'Test_Pwd'>
    <TestCaseFunction 'test_APwd'>
    <TestCaseFunction 'test_BPwd'>
<Module 'testPasswords/test_multi.py'>
  <Class 'Test_CheckMyApp'>
    <Instance '()'>
      <Function 'test_simple_check'>
      <Function 'test_complex_check'>
      <Class 'Test_NestedClassA'>
        <Instance '()'>
          <Function 'test_nested_class_methodB'>
          <Class 'Test_nested_classB_Of_A'>
            <Instance '()'>
              <Function 'test_d'>
  <Function 'test_username'>
  <Function 'test_parametrized_username[one]'>
  <Function 'test_parametrized_username[two]'>
  <Function 'test_parametrized_username[three]'>
*/

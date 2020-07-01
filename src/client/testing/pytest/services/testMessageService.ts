// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Location, Position, Range, TextLine, Uri, workspace } from 'vscode';
import '../../../common/extensions';
import { ProductNames } from '../../../common/installer/productNames';
import { IFileSystem } from '../../../common/platform/types';
import { Product } from '../../../common/types';
import { IServiceContainer } from '../../../ioc/types';
import { FlattenedTestFunction, ITestMessageService, Tests, TestStatus } from '../../common/types';
import { ILocationStackFrameDetails, IPythonTestMessage, PythonTestMessageSeverity } from '../../types';

@injectable()
export class TestMessageService implements ITestMessageService {
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {}
    /**
     * Condense the test details down to just the potentially relevant information. Messages
     * should only be created for tests that were actually run.
     *
     * @param rootDirectory
     * @param testResults Details about all known tests.
     */
    public async getFilteredTestMessages(rootDirectory: string, testResults: Tests): Promise<IPythonTestMessage[]> {
        const testFuncs = testResults.testFunctions.reduce<FlattenedTestFunction[]>((filtered, test) => {
            if (test.testFunction.passed !== undefined || test.testFunction.status === TestStatus.Skipped) {
                filtered.push(test);
            }
            return filtered;
        }, []);
        const messages: IPythonTestMessage[] = [];
        for (const tf of testFuncs) {
            const nameToRun = tf.testFunction.nameToRun;
            const provider = ProductNames.get(Product.pytest)!;
            const status = tf.testFunction.status!;
            if (status === TestStatus.Pass) {
                // If the test passed, there's not much to do with it.
                const msg: IPythonTestMessage = {
                    code: nameToRun,
                    severity: PythonTestMessageSeverity.Pass,
                    provider: provider,
                    testTime: tf.testFunction.time,
                    status: status,
                    testFilePath: tf.parentTestFile.fullPath
                };
                messages.push(msg);
            } else {
                // If the test did not pass, we need to parse the traceback to find each line in
                // their respective files so they can be included as related information for the
                // diagnostic.
                const locationStack = await this.getLocationStack(rootDirectory, tf);
                const message = tf.testFunction.message;
                const testFilePath = tf.parentTestFile.fullPath;
                let severity = PythonTestMessageSeverity.Error;
                if (tf.testFunction.status === TestStatus.Skipped) {
                    severity = PythonTestMessageSeverity.Skip;
                }

                const msg: IPythonTestMessage = {
                    code: nameToRun,
                    message: message,
                    severity: severity,
                    provider: provider,
                    traceback: tf.testFunction.traceback,
                    testTime: tf.testFunction.time,
                    testFilePath: testFilePath,
                    status: status,
                    locationStack: locationStack
                };
                messages.push(msg);
            }
        }
        return messages;
    }
    /**
     * Given a FlattenedTestFunction, parse its traceback to piece together where each line in the
     * traceback was in its respective file and grab the entire text of each line so they can be
     * included in the Diagnostic as related information.
     *
     * @param testFunction The FlattenedTestFunction with the traceback that we need to parse.
     */
    private async getLocationStack(
        rootDirectory: string,
        testFunction: FlattenedTestFunction
    ): Promise<ILocationStackFrameDetails[]> {
        const locationStack: ILocationStackFrameDetails[] = [];
        if (testFunction.testFunction.traceback) {
            const fileMatches =
                testFunction.testFunction.traceback.match(/^((\.\.[\\\/])*.+\.py)\:(\d+)\:.*$/gim) || [];
            for (const fileDetailsMatch of fileMatches) {
                const fileDetails = fileDetailsMatch.split(':');
                let filePath = fileDetails[0];
                filePath = path.isAbsolute(filePath) ? filePath : path.resolve(rootDirectory, filePath);
                const fileUri = Uri.file(filePath);
                const file = await workspace.openTextDocument(fileUri);
                const fileLineNum = parseInt(fileDetails[1], 10);
                const line = file.lineAt(fileLineNum - 1);
                const location = new Location(
                    fileUri,
                    new Range(
                        new Position(fileLineNum - 1, line.firstNonWhitespaceCharacterIndex),
                        new Position(fileLineNum - 1, line.text.length)
                    )
                );
                const stackFrame: ILocationStackFrameDetails = {
                    location: location,
                    lineText: file.getText(location.range)
                };
                locationStack.push(stackFrame);
            }
        }
        // Find where the file the test was defined.
        let testSourceFilePath = testFunction.testFunction.file!;
        testSourceFilePath = path.isAbsolute(testSourceFilePath)
            ? testSourceFilePath
            : path.resolve(rootDirectory, testSourceFilePath);
        const testSourceFileUri = Uri.file(testSourceFilePath);
        const testSourceFile = await workspace.openTextDocument(testSourceFileUri);
        let testDefLine: TextLine | null = null;
        let lineNum = testFunction.testFunction.line!;
        let lineText: string = '';
        let trimmedLineText: string = '';
        const testDefPrefix = 'def ';
        const testAsyncDefPrefix = 'async def ';
        let prefix = '';

        while (testDefLine === null) {
            const possibleTestDefLine = testSourceFile.lineAt(lineNum);
            lineText = possibleTestDefLine.text;
            trimmedLineText = lineText.trimLeft()!;
            if (trimmedLineText.toLowerCase().startsWith(testDefPrefix)) {
                testDefLine = possibleTestDefLine;
                prefix = testDefPrefix;
            } else if (trimmedLineText.toLowerCase().startsWith(testAsyncDefPrefix)) {
                testDefLine = possibleTestDefLine;
                prefix = testAsyncDefPrefix;
            } else {
                // The test definition may have been decorated, and there may be multiple
                // decorations, so move to the next line and check it.
                lineNum += 1;
            }
        }
        const matches = trimmedLineText!.slice(prefix.length).match(/[^ \(:]+/);
        const testSimpleName = matches ? matches[0] : '';
        const testDefStartCharNum = lineText.length - trimmedLineText.length + prefix.length;
        const testDefEndCharNum = testDefStartCharNum + testSimpleName.length;
        const lineStart = new Position(testDefLine!.lineNumber, testDefStartCharNum);
        const lineEnd = new Position(testDefLine!.lineNumber, testDefEndCharNum);
        const lineRange = new Range(lineStart, lineEnd);
        const testDefLocation = new Location(testSourceFileUri, lineRange);
        const testSourceLocationDetails = { location: testDefLocation, lineText: testSourceFile.getText(lineRange) };
        locationStack.unshift(testSourceLocationDetails);

        // Put the class declaration at the top of the stack if the test was imported.
        if (testFunction.parentTestSuite !== undefined) {
            // This could be an imported test method
            const fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
            if (
                !fs.arePathsSame(
                    Uri.file(testFunction.parentTestFile.fullPath).fsPath,
                    locationStack[0].location.uri.fsPath
                )
            ) {
                // test method was imported, so reference class declaration line.
                // this should be the first thing in the stack to show where the failure/error originated.
                locationStack.unshift(await this.getParentSuiteLocation(testFunction));
            }
        }
        return locationStack;
    }
    /**
     * The test that's associated with the FlattenedtestFunction was imported from another file, as the file
     * location found in the traceback that shows what file the test was actually defined in is different than
     * the file that the test was executed in. This must also mean that the test was part of a class that was
     * imported and then inherited by the class that was actually run in the file.
     *
     * Test classes can be defined inside of other test classes, and even nested test classes of those that were
     * imported will be discovered and ran. Luckily, for pytest, the entire chain of classes is preserved in the
     * test's ID. However, in order to keep the Diagnostic as relevant as possible, it should point only at the
     * most-nested test class that exists in the file that the test was actually run in, in order to provide the
     * most context. This method attempts to go as far down the chain as it can, and resolves to the
     * LocationStackFrameDetails for that test class.
     *
     * @param testFunction The FlattenedTestFunction that was executed.
     */
    private async getParentSuiteLocation(testFunction: FlattenedTestFunction): Promise<ILocationStackFrameDetails> {
        const suiteStackWithFileAndTest = testFunction.testFunction.nameToRun.replace('::()', '').split('::');
        // Don't need the file location or the test's name.
        const suiteStack = suiteStackWithFileAndTest.slice(1, suiteStackWithFileAndTest.length - 1);
        const testFileUri = Uri.file(testFunction.parentTestFile.fullPath);
        const testFile = await workspace.openTextDocument(testFileUri);
        const testFileLines = testFile.getText().splitLines({ trim: false, removeEmptyEntries: false });
        const reversedTestFileLines = testFileLines.slice().reverse();
        // Track the end of the parent scope.
        let parentScopeEndIndex = 0;
        let parentScopeStartIndex = testFileLines.length;
        let parentIndentation: number | undefined;
        const suiteLocationStackFrameDetails: ILocationStackFrameDetails[] = [];

        const classPrefix = 'class ';
        while (suiteStack.length > 0) {
            let indentation: number = 0;
            let prevLowestIndentation: number | undefined;
            // Get the name of the suite on top of the stack so it can be located.
            const suiteName = suiteStack.shift()!;
            let suiteDefLineIndex: number | undefined;
            for (let index = parentScopeEndIndex; index < parentScopeStartIndex; index += 1) {
                const lineText = reversedTestFileLines[index];
                if (lineText.trim().length === 0) {
                    // This line is just whitespace.
                    continue;
                }
                const trimmedLineText = lineText.trimLeft()!;
                if (!trimmedLineText.toLowerCase().startsWith(classPrefix)) {
                    // line is not a class declaration
                    continue;
                }
                const matches = trimmedLineText.slice(classPrefix.length).match(/[^ \(:]+/);
                const lineClassName = matches ? matches[0] : undefined;

                // Check if the indentation is proper.
                if (parentIndentation === undefined) {
                    // The parentIndentation hasn't been set yet, so we are looking for a class that was
                    // defined in the global scope of the module.
                    if (trimmedLineText.length === lineText.length) {
                        // This line doesn't start with whitespace.
                        if (lineClassName === suiteName) {
                            // This is the line that we want.
                            suiteDefLineIndex = index;
                            indentation = 0;
                            // We have our line for the root suite declaration, so move on to processing the Location.
                            break;
                        } else {
                            // This is not the line we want, but may be the line that ends the scope of the class we want.
                            parentScopeEndIndex = index + 1;
                        }
                    }
                } else {
                    indentation = lineText.length - trimmedLineText.length;
                    if (indentation <= parentIndentation) {
                        // This is not the line we want, but may be the line that ends the scope of the parent class.
                        parentScopeEndIndex = index + 1;
                        continue;
                    }
                    if (prevLowestIndentation === undefined || indentation < prevLowestIndentation) {
                        if (lineClassName === suiteName) {
                            // This might be the line that we want.
                            suiteDefLineIndex = index;
                            prevLowestIndentation = indentation;
                        } else {
                            // This is not the line we want, but may be the line that ends the scope of the class we want.
                            parentScopeEndIndex = index + 1;
                        }
                    }
                }
            }
            if (suiteDefLineIndex === undefined) {
                // Could not find the suite declaration line, so give up and move on with the latest one that we found.
                break;
            }
            // Found the line to process.
            parentScopeStartIndex = suiteDefLineIndex;
            parentIndentation = indentation!;

            // Invert the index to get the unreversed equivalent.
            const realIndex = reversedTestFileLines.length - 1 - suiteDefLineIndex;
            const startChar = indentation! + classPrefix.length;
            const suiteStartPos = new Position(realIndex, startChar);
            const suiteEndPos = new Position(realIndex, startChar + suiteName!.length);
            const suiteRange = new Range(suiteStartPos, suiteEndPos);
            const suiteLocation = new Location(testFileUri, suiteRange);
            suiteLocationStackFrameDetails.push({ location: suiteLocation, lineText: testFile.getText(suiteRange) });
        }
        return suiteLocationStackFrameDetails[suiteLocationStackFrameDetails.length - 1];
    }
}

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ICommandManager } from '../../common/application/types';
import { Commands } from '../../common/constants';
import { traceDecorators } from '../../common/logger';
import { IDisposable } from '../../common/types';
import { swallowExceptions } from '../../common/utils/decorators';
import { CommandSource } from '../common/constants';
import { getTestDataItemType } from '../common/testUtils';
import { TestFile, TestFolder, TestFunction, TestsToRun, TestSuite } from '../common/types';
import { ITestExplorerCommandHandler } from '../navigation/types';
import { ITestDataItemResource, TestDataItem, TestDataItemType } from '../types';

type NavigationCommands =
    | typeof Commands.navigateToTestFile
    | typeof Commands.navigateToTestFunction
    | typeof Commands.navigateToTestSuite;
const testNavigationCommandMapping: { [key: string]: NavigationCommands } = {
    [TestDataItemType.file]: Commands.navigateToTestFile,
    [TestDataItemType.function]: Commands.navigateToTestFunction,
    [TestDataItemType.suite]: Commands.navigateToTestSuite,
};

@injectable()
export class TestExplorerCommandHandler implements ITestExplorerCommandHandler {
    private readonly disposables: IDisposable[] = [];
    constructor(
        @inject(ICommandManager) private readonly cmdManager: ICommandManager,
        @inject(ITestDataItemResource) private readonly testResource: ITestDataItemResource
    ) {}
    public register(): void {
        this.disposables.push(this.cmdManager.registerCommand(Commands.runTestNode, this.onRunTestNode, this));
        this.disposables.push(this.cmdManager.registerCommand(Commands.debugTestNode, this.onDebugTestNode, this));
        this.disposables.push(
            this.cmdManager.registerCommand(Commands.openTestNodeInEditor, this.onOpenTestNodeInEditor, this)
        );
    }
    public dispose(): void {
        this.disposables.forEach((item) => item.dispose());
    }
    @swallowExceptions('Run test node')
    @traceDecorators.error('Run test node failed')
    protected async onRunTestNode(item: TestDataItem): Promise<void> {
        await this.runDebugTestNode(item, 'run');
    }
    @swallowExceptions('Debug test node')
    @traceDecorators.error('Debug test node failed')
    protected async onDebugTestNode(item: TestDataItem): Promise<void> {
        await this.runDebugTestNode(item, 'debug');
    }
    @swallowExceptions('Open test node in Editor')
    @traceDecorators.error('Open test node in editor failed')
    protected async onOpenTestNodeInEditor(item: TestDataItem): Promise<void> {
        const testType = getTestDataItemType(item);
        if (testType === TestDataItemType.folder) {
            throw new Error('Unknown Test Type');
        }
        const command = testNavigationCommandMapping[testType];
        const testUri = this.testResource.getResource(item);
        if (!command) {
            throw new Error('Unknown Test Type');
        }
        this.cmdManager.executeCommand(command, testUri, item, true);
    }

    protected async runDebugTestNode(item: TestDataItem, runType: 'run' | 'debug'): Promise<void> {
        let testToRun: TestsToRun;

        switch (getTestDataItemType(item)) {
            case TestDataItemType.file: {
                testToRun = { testFile: [item as TestFile] };
                break;
            }
            case TestDataItemType.folder: {
                testToRun = { testFolder: [item as TestFolder] };
                break;
            }
            case TestDataItemType.suite: {
                testToRun = { testSuite: [item as TestSuite] };
                break;
            }
            case TestDataItemType.function: {
                testToRun = { testFunction: [item as TestFunction] };
                break;
            }
            default:
                throw new Error('Unknown Test Type');
        }
        const testUri = this.testResource.getResource(item);
        const cmd = runType === 'run' ? Commands.Tests_Run : Commands.Tests_Debug;
        this.cmdManager.executeCommand(cmd, undefined, CommandSource.testExplorer, testUri, testToRun);
    }
}

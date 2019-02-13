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
import { TestFile, TestFolder, TestFunction, TestsToRun, TestSuite, TestType } from '../common/types';
import { ITestExplorerCommandHandler } from '../navigation/types';
import { TestTreeItem } from './testTreeViewItem';

const testNavigationCommandMapping = {
    [TestType.testFile]: Commands.navigateToTestFile,
    [TestType.testFunction]: Commands.navigateToTestFunction,
    [TestType.testSuite]: Commands.navigateToTestSuite
};

@injectable()
export class TestExplorerCommandHandler implements ITestExplorerCommandHandler {
    private readonly disposables: IDisposable[] = [];
    constructor(@inject(ICommandManager) private readonly cmdManager: ICommandManager) { }
    public register(): void {
        this.disposables.push(this.cmdManager.registerCommand(Commands.runTestNode, this.onRunTestNode, this));
        this.disposables.push(this.cmdManager.registerCommand(Commands.debugTestNode, this.onDebugTestNode, this));
        this.disposables.push(this.cmdManager.registerCommand(Commands.openTestNodeInEditor, this.onOpenTestNodeInEditor, this));
    }
    public dispose(): void {
        this.disposables.forEach(item => item.dispose());
    }
    @swallowExceptions('Run test node')
    @traceDecorators.error('Run test node failed')
    protected async onRunTestNode(item: TestTreeItem): Promise<void> {
        await this.runDebugTestNode(item, 'run');
    }
    @swallowExceptions('Debug test node')
    @traceDecorators.error('Debug test node failed')
    protected async onDebugTestNode(item: TestTreeItem): Promise<void> {
        await this.runDebugTestNode(item, 'debug');
    }
    @swallowExceptions('Open test node in Editor')
    @traceDecorators.error('Open test node in editor failed')
    protected async onOpenTestNodeInEditor(item: TestTreeItem): Promise<void> {
        const command = testNavigationCommandMapping[item.testType];
        if (!command) {
            throw new Error('Unknown Test Type');
        }

        this.cmdManager.executeCommand(command, item.resource, item.data, true);
    }
    protected async runDebugTestNode(item: TestTreeItem, runType: 'run' | 'debug'): Promise<void> {
        let testToRun: TestsToRun;
        switch (item.testType) {
            case TestType.testFile: {
                testToRun = { testFile: [item.data as TestFile] };
                break;
            }
            case TestType.testFolder: {
                testToRun = { testFolder: [item.data as TestFolder] };
                break;
            }
            case TestType.testSuite: {
                testToRun = { testSuite: [item.data as TestSuite] };
                break;
            }
            case TestType.testFunction: {
                testToRun = { testFunction: [item.data as TestFunction] };
                break;
            }
            default:
                throw new Error('Unknown Test Type');
        }

        const args = [undefined, CommandSource.testExplorer, item.resource, testToRun];
        const cmd = runType === 'run' ? Commands.Tests_Run : Commands.Tests_Debug;
        this.cmdManager.executeCommand(cmd, ...args);
    }
}

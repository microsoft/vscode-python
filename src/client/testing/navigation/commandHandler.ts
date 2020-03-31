// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { ICommandManager } from '../../common/application/types';
import { Commands } from '../../common/constants';
import { IDisposable, IDisposableRegistry } from '../../common/types';
import { ITestCodeNavigator, ITestCodeNavigatorCommandHandler, NavigableItemType } from './types';

@injectable()
export class TestCodeNavigatorCommandHandler implements ITestCodeNavigatorCommandHandler {
    private disposables: IDisposable[] = [];
    constructor(
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(ITestCodeNavigator)
        @named(NavigableItemType.testFile)
        private readonly testFileNavigator: ITestCodeNavigator,
        @inject(ITestCodeNavigator)
        @named(NavigableItemType.testFunction)
        private readonly testFunctionNavigator: ITestCodeNavigator,
        @inject(ITestCodeNavigator)
        @named(NavigableItemType.testSuite)
        private readonly testSuiteNavigator: ITestCodeNavigator,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry
    ) {
        disposableRegistry.push(this);
    }
    public dispose() {
        this.disposables.forEach((item) => item.dispose());
    }
    public register(): void {
        if (this.disposables.length > 0) {
            return;
        }
        let disposable = this.commandManager.registerCommand(
            Commands.navigateToTestFile,
            this.testFileNavigator.navigateTo,
            this.testFileNavigator
        );
        this.disposables.push(disposable);
        disposable = this.commandManager.registerCommand(
            Commands.navigateToTestFunction,
            this.testFunctionNavigator.navigateTo,
            this.testFunctionNavigator
        );
        this.disposables.push(disposable);
        disposable = this.commandManager.registerCommand(
            Commands.navigateToTestSuite,
            this.testSuiteNavigator.navigateTo,
            this.testSuiteNavigator
        );
        this.disposables.push(disposable);
    }
}

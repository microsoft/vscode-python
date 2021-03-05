// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { ICommandManager } from '../../common/application/types';
import { Commands } from '../../common/constants';
import '../../common/extensions';
import { IDisposable, IDisposableRegistry } from '../../common/types';
import { debounceAsync } from '../../common/utils/decorators';
import { getTestDataItemType } from '../common/testUtils';
import { TestDataItem, TestDataItemType, ITestCollectionStorageService, TestStatus } from '../common/types';

@injectable()
export class FailedTestHandler implements IExtensionSingleActivationService, IDisposable {
    private readonly disposables: IDisposable[] = [];
    private readonly failedItems: TestDataItem[] = [];
    constructor(
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(ITestCollectionStorageService) private readonly storage: ITestCollectionStorageService,
    ) {
        disposableRegistry.push(this);
    }
    public dispose() {
        this.disposables.forEach((d) => d.dispose());
    }
    public async activate(): Promise<void> {
        this.storage.onDidChange(this.onDidChangeTestData, this, this.disposables);
    }
    public onDidChangeTestData(args: { uri: Uri; data?: TestDataItem }): void {
        if (
            args.data &&
            (args.data.status === TestStatus.Error || args.data.status === TestStatus.Fail) &&
            getTestDataItemType(args.data) === TestDataItemType.function
        ) {
            this.failedItems.push(args.data);
            this.revealFailedNodes().ignoreErrors();
        }
    }

    @debounceAsync(500)
    private async revealFailedNodes(): Promise<void> {
        while (this.failedItems.length > 0) {
            const item = this.failedItems.pop()!;
            await this.commandManager.executeCommand(Commands.Test_Reveal_Test_Item, item);
        }
    }
}

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ICommandManager } from '../../../common/application/types';
import { ContextKey } from '../../../common/contextKey';
import { IDisposable } from '../../../common/types';
import { swallowExceptions } from '../../../common/utils/decorators';
import { ITestManagementService, WorkspaceTestStatus } from '../../types';
import { ITestCollectionStorageService, ITestContextService, TestStatus } from '../types';

@injectable()
export class TestContextService implements ITestContextService {
    private readonly hasFailedTests: ContextKey;
    private readonly runningTests: ContextKey;
    private readonly discoveringTests: ContextKey;
    private readonly busyTests: ContextKey;
    private readonly disposables: IDisposable[] = [];
    constructor(
        @inject(ITestCollectionStorageService) private readonly storage: ITestCollectionStorageService,
        @inject(ITestManagementService) private readonly testManager: ITestManagementService,
        @inject(ICommandManager) cmdManager: ICommandManager
    ) {
        this.hasFailedTests = new ContextKey('hasFailedTests', cmdManager);
        this.runningTests = new ContextKey('runningTests', cmdManager);
        this.discoveringTests = new ContextKey('discoveringTests', cmdManager);
        this.busyTests = new ContextKey('busyTests', cmdManager);
    }
    public dispose(): void {
        this.disposables.forEach((d) => d.dispose());
    }
    public register(): void {
        this.testManager.onDidStatusChange(this.onStatusChange, this, this.disposables);
    }
    @swallowExceptions('Handle status change of tests')
    protected async onStatusChange(status: WorkspaceTestStatus): Promise<void> {
        const tests = this.storage.getTests(status.workspace);
        const promises: Promise<void>[] = [];
        if (tests && tests.summary) {
            promises.push(this.hasFailedTests.set(tests.summary.failures > 0));
        }
        promises.push(
            ...[
                this.runningTests.set(status.status === TestStatus.Running),
                this.discoveringTests.set(status.status === TestStatus.Discovering),
                this.busyTests.set(status.status === TestStatus.Running || status.status === TestStatus.Discovering),
            ]
        );

        await Promise.all(promises);
    }
}

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Disposable, Event, EventEmitter, FileSystemWatcher, RelativePattern, Uri } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { Logger, traceVerbose } from '../../../common/logger';
import { IPlatformService } from '../../../common/platform/types';
import { IDisposableRegistry } from '../../../common/types';
import { debounce } from '../../../common/utils/decorators';
import { IInterpreterWatcher } from '../../contracts';

@injectable()
export class WorkspaceVirtualEnvWatcherService implements IInterpreterWatcher, Disposable {
    private readonly didCreate;
    private timer?: NodeJS.Timer;
    private fsWatchers: FileSystemWatcher[] = [];
    constructor(@inject(IDisposableRegistry) private readonly disposableRegistry: Disposable[],
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IPlatformService) private readonly platformService: IPlatformService) {
        this.didCreate = new EventEmitter<void>();
        disposableRegistry.push(this);
    }
    public get onDidCreate(): Event<void> {
        return this.didCreate.event;
    }
    public dispose() {
        this.clearTimer();
    }
    @traceVerbose('Register Intepreter Watcher')
    public async register(resource: Uri | undefined): Promise<void> {
        if (this.fsWatchers.length > 0) {
            return;
        }

        const workspaceFolder = resource ? this.workspaceService.getWorkspaceFolder(resource) : undefined;
        const executable = this.platformService.isWindows ? 'python.exe' : 'python';
        const patterns = [path.join('*', executable), path.join('*', '*', executable)];

        for (const pattern of patterns) {
            const globPatern = workspaceFolder ? new RelativePattern(workspaceFolder.uri.fsPath, pattern) : pattern;
            Logger.verbose(`Create file systemwatcher with pattern ${pattern}`);

            const fsWatcher = this.workspaceService.createFileSystemWatcher(globPatern);
            fsWatcher.onDidCreate(e => this.createHandler(e), this, this.disposableRegistry);

            this.disposableRegistry.push(fsWatcher);
            this.fsWatchers.push(fsWatcher);
        }
    }
    @debounce(2000)
    @traceVerbose('Intepreter Watcher change handler')
    protected createHandler(e: Uri) {
        this.didCreate.fire();
        // On Windows, creation of environments are slow, hence lets notify again after 10 seconds.
        this.clearTimer();

        this.timer = setTimeout(() => {
            this.timer = undefined;
            this.didCreate.fire();
        }, 10000);
    }
    private clearTimer() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
    }
}

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Disposable, Event, EventEmitter, FileSystemWatcher, RelativePattern, Uri } from 'vscode';
import { IWorkspaceService } from '../../../../common/application/types';
import '../../../../common/extensions';
import { traceDecorators, traceVerbose } from '../../../../common/logger';
import { IPlatformService } from '../../../../common/platform/types';
import { IPythonExecutionFactory } from '../../../../common/process/types';
import { IDisposableRegistry, Resource } from '../../../../common/types';
import { IInterpreterWatcher } from '../../../../interpreter/contracts';

const maxTimeToWaitForEnvCreation = 60_000;
const timeToPollForEnvCreation = 2_000;

@injectable()
export class WorkspaceVirtualEnvWatcherService implements IInterpreterWatcher, Disposable {
    private readonly didCreate: EventEmitter<Resource>;
    private timers = new Map<string, { timer: NodeJS.Timer | number; counter: number }>();
    private fsWatchers: FileSystemWatcher[] = [];
    private resource: Resource;
    constructor(
        @inject(IDisposableRegistry) private readonly disposableRegistry: Disposable[],
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IPlatformService) private readonly platformService: IPlatformService,
        @inject(IPythonExecutionFactory) private readonly pythonExecFactory: IPythonExecutionFactory
    ) {
        this.didCreate = new EventEmitter<Resource>();
        disposableRegistry.push(this);
    }
    public get onDidCreate(): Event<Resource> {
        return this.didCreate.event;
    }
    public dispose() {
        this.clearTimers();
    }
    @traceDecorators.verbose('Register Interpreter Watcher')
    public async register(resource: Resource): Promise<void> {
        if (this.fsWatchers.length > 0) {
            return;
        }
        this.resource = resource;
        const workspaceFolder = resource ? this.workspaceService.getWorkspaceFolder(resource) : undefined;
        const executable = this.platformService.isWindows ? 'python.exe' : 'python';
        const patterns = [path.join('*', executable), path.join('*', '*', executable)];

        for (const pattern of patterns) {
            const globPatern = workspaceFolder ? new RelativePattern(workspaceFolder.uri.fsPath, pattern) : pattern;
            traceVerbose(`Create file systemwatcher with pattern ${pattern}`);

            const fsWatcher = this.workspaceService.createFileSystemWatcher(globPatern);
            fsWatcher.onDidCreate((e) => this.createHandler(e), this, this.disposableRegistry);

            this.disposableRegistry.push(fsWatcher);
            this.fsWatchers.push(fsWatcher);
        }
    }
    @traceDecorators.verbose('Interpreter Watcher change handler')
    public async createHandler(e: Uri) {
        this.didCreate.fire(this.resource);
        // On Windows, creation of environments are very slow, hence lets notify again after
        // the python executable is accessible (i.e. when we can launch the process).
        this.notifyCreationWhenReady(e.fsPath).ignoreErrors();
    }
    protected async notifyCreationWhenReady(pythonPath: string) {
        const counter = this.timers.has(pythonPath) ? this.timers.get(pythonPath)!.counter + 1 : 0;
        const isValid = await this.isValidExecutable(pythonPath);
        if (isValid) {
            if (counter > 0) {
                this.didCreate.fire(this.resource);
            }
            return this.timers.delete(pythonPath);
        }
        if (counter > maxTimeToWaitForEnvCreation / timeToPollForEnvCreation) {
            // Send notification before we give up trying.
            this.didCreate.fire(this.resource);
            this.timers.delete(pythonPath);
            return;
        }

        const timer = setTimeout(
            () => this.notifyCreationWhenReady(pythonPath).ignoreErrors(),
            timeToPollForEnvCreation
        );
        this.timers.set(pythonPath, { timer, counter });
    }
    private clearTimers() {
        // tslint:disable-next-line: no-any
        this.timers.forEach((item) => clearTimeout(item.timer as any));
        this.timers.clear();
    }
    private async isValidExecutable(pythonPath: string): Promise<boolean> {
        const execService = await this.pythonExecFactory.create({ pythonPath });
        const info = await execService.getInterpreterInformation().catch(() => undefined);
        return info !== undefined;
    }
}

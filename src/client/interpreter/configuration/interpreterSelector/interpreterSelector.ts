// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Disposable, EventEmitter, Uri, Event } from 'vscode';
import { IPathUtils, Resource } from '../../../common/types';
import { PythonEnvironment } from '../../../pythonEnvironments/info';
import { IInterpreterService } from '../../contracts';
import {
    IInterpreterComparer,
    IInterpreterQuickPickItem,
    IInterpreterSelector,
    PythonEnvSuggestionChangedEvent,
} from '../types';

@injectable()
export class InterpreterSelector implements IInterpreterSelector {
    private disposables: Disposable[] = [];

    private readonly changed = new EventEmitter<PythonEnvSuggestionChangedEvent>();

    constructor(
        @inject(IInterpreterService) private readonly interpreterManager: IInterpreterService,
        @inject(IInterpreterComparer) private readonly envTypeComparer: IInterpreterComparer,
        @inject(IPathUtils) private readonly pathUtils: IPathUtils,
    ) {
        this.interpreterManager.onDidChangeInterpreters(async (event) => {
            this.changed.fire({
                old: event.old ? await this.suggestionToQuickPickItem(event.old) : event.old,
                update: event.update ? await this.suggestionToQuickPickItem(event.update) : event.update,
            });
        });
    }

    public get onChanged(): Event<PythonEnvSuggestionChangedEvent> {
        return this.changed.event;
    }

    public dispose(): void {
        this.disposables.forEach((disposable) => disposable.dispose());
    }

    public async getSuggestions(resource: Resource, sortSuggestions: boolean): Promise<IInterpreterQuickPickItem[]> {
        const interpreters = await this.interpreterManager.getInterpreters(resource, {
            onSuggestion: true,
        });
        if (sortSuggestions) {
            interpreters.sort(this.envTypeComparer.compare.bind(this.envTypeComparer));
        }

        return Promise.all(interpreters.map((item) => this.suggestionToQuickPickItem(item, resource)));
    }

    public async getAllSuggestions(resource: Resource): Promise<IInterpreterQuickPickItem[]> {
        const interpreters = await this.interpreterManager.getAllInterpreters(resource, {
            onSuggestion: true,
        });

        return Promise.all(interpreters.map((item) => this.suggestionToQuickPickItem(item, resource)));
    }

    protected async suggestionToQuickPickItem(
        suggestion: PythonEnvironment,
        workspaceUri?: Uri,
    ): Promise<IInterpreterQuickPickItem> {
        const detail = this.pathUtils.getDisplayName(suggestion.path, workspaceUri ? workspaceUri.fsPath : undefined);
        const cachedPrefix = suggestion.cachedEntry ? '(cached) ' : '';
        return {
            label: suggestion.displayName!,
            detail: `${cachedPrefix}${detail}`,
            path: suggestion.path,
            interpreter: suggestion,
        };
    }
}

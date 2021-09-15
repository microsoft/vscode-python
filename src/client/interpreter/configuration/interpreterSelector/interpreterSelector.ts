// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Disposable, Uri } from 'vscode';
import { IPathUtils, Resource } from '../../../common/types';
import { PythonEnvironment } from '../../../pythonEnvironments/info';
import { IInterpreterService } from '../../contracts';
import { IInterpreterComparer, IInterpreterQuickPickItem, IInterpreterSelector } from '../types';

@injectable()
export class InterpreterSelector implements IInterpreterSelector {
    private disposables: Disposable[] = [];

    constructor(
        @inject(IInterpreterService) private readonly interpreterManager: IInterpreterService,
        @inject(IInterpreterComparer) private readonly envTypeComparer: IInterpreterComparer,
        @inject(IPathUtils) private readonly pathUtils: IPathUtils,
    ) {}

    public dispose(): void {
        this.disposables.forEach((disposable) => disposable.dispose());
    }

    public async getSuggestions(resource: Resource, ignoreCache?: boolean): Promise<IInterpreterQuickPickItem[]> {
        const interpreters = await this.interpreterManager.getAllInterpreters(resource, {
            onSuggestion: true,
            ignoreCache,
        });
        interpreters.sort(this.envTypeComparer.compare.bind(this.envTypeComparer));

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

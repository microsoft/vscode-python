// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Disposable, Uri } from 'vscode';
import { arePathsSame } from '../../../common/platform/fs-paths';
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

    public getSuggestions(resource: Resource, useFullDisplayName = false): IInterpreterQuickPickItem[] {
        const interpreters = this.interpreterManager.getInterpreters(resource);
        interpreters.sort(this.envTypeComparer.compare.bind(this.envTypeComparer));

        return interpreters.map((item) => this.suggestionToQuickPickItem(item, resource, useFullDisplayName));
    }

    public async getAllSuggestions(resource: Resource): Promise<IInterpreterQuickPickItem[]> {
        const interpreters = await this.interpreterManager.getAllInterpreters(resource);
        interpreters.sort(this.envTypeComparer.compare.bind(this.envTypeComparer));

        return Promise.all(interpreters.map((item) => this.suggestionToQuickPickItem(item, resource)));
    }

    public suggestionToQuickPickItem(
        suggestion: PythonEnvironment,
        workspaceUri?: Uri,
        useDetailedName = false,
    ): IInterpreterQuickPickItem {
        const detail = this.pathUtils.getDisplayName(suggestion.path, workspaceUri ? workspaceUri.fsPath : undefined);
        const cachedPrefix = suggestion.cachedEntry ? '(cached) ' : '';
        return {
            label: (useDetailedName ? suggestion.detailedDisplayName : suggestion.displayName) || 'Python',
            description: `${cachedPrefix}${detail}`,
            path: suggestion.path,
            interpreter: suggestion,
        };
    }

    public getRecommendedSuggestion(
        suggestions: IInterpreterQuickPickItem[],
        resource: Resource,
    ): IInterpreterQuickPickItem | undefined {
        const envs = this.interpreterManager.getInterpreters(resource);
        const recommendedEnv = this.envTypeComparer.getRecommended(envs, resource);
        if (!recommendedEnv) {
            return undefined;
        }
        return suggestions.find((item) => arePathsSame(item.interpreter.path, recommendedEnv.path));
    }
}

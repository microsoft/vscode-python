// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Disposable, Uri } from 'vscode';
import { DeprecatePythonPath } from '../../../common/experiments/groups';
import { IExperimentService, IPathUtils, Resource } from '../../../common/types';
import { PythonEnvironment } from '../../../pythonEnvironments/info';
import { IInterpreterSecurityService } from '../../autoSelection/types';
import { IInterpreterService } from '../../contracts';
import { IInterpreterComparer, IInterpreterQuickPickItem, IInterpreterSelector } from '../types';

@injectable()
export class InterpreterSelector implements IInterpreterSelector {
    private disposables: Disposable[] = [];

    constructor(
        @inject(IInterpreterService) private readonly interpreterManager: IInterpreterService,
        @inject(IInterpreterComparer) private readonly interpreterComparer: IInterpreterComparer,
        @inject(IExperimentService) private readonly experimentsManager: IExperimentService,
        @inject(IInterpreterSecurityService) private readonly interpreterSecurityService: IInterpreterSecurityService,
        @inject(IPathUtils) private readonly pathUtils: IPathUtils,
    ) {}
    public dispose() {
        this.disposables.forEach((disposable) => disposable.dispose());
    }

    public async getSuggestions(resource: Resource, ignoreCache?: boolean) {
        let interpreters = await this.interpreterManager.getInterpreters(resource, { onSuggestion: true, ignoreCache });
        if (this.experimentsManager.inExperimentSync(DeprecatePythonPath.experiment)) {
            interpreters = interpreters
                ? interpreters.filter((item) => this.interpreterSecurityService.isSafe(item) !== false)
                : [];
        }
        interpreters.sort(this.interpreterComparer.compare.bind(this.interpreterComparer));
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

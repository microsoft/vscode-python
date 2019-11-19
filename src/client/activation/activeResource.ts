// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { workspace } from 'vscode';
import { IDocumentManager, IWorkspaceService } from '../common/application/types';
import { Resource } from '../common/types';
import { IActiveResourceService } from './types';

@injectable()
export class ActiveResourceService implements IActiveResourceService {
    constructor(
        @inject(IDocumentManager) private readonly documentManager: IDocumentManager,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService
    ) { }

    public getActiveResource(): Resource {
        if (this.documentManager.activeTextEditor && !this.documentManager.activeTextEditor.document.isUntitled) {
            return this.documentManager.activeTextEditor.document.uri;
        }
        return Array.isArray(this.workspaceService.workspaceFolders) && workspace.workspaceFolders!.length > 0
            ? workspace.workspaceFolders![0].uri
            : undefined;
    }
}

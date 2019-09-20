// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable, named } from 'inversify';
import { Memento, Uri } from 'vscode';

import { IMemento, WORKSPACE_MEMENTO } from '../common/types';
import { INotebookContents, INotebookStorage } from './types';

@injectable()
export class NotebookStorage implements INotebookStorage {
    constructor(
        @inject(IMemento) @named(WORKSPACE_MEMENTO) private workspaceStorage: Memento
    ) {

    }

    public async retrieve(uri: Uri): Promise<INotebookContents | undefined> {
        const key = `notebookhot-${uri.toString()}`;
        const contents = this.workspaceStorage.get<string>(key);
        if (contents) {
            // Erase the current contents as retrieve deletes
            this.workspaceStorage.update(key, undefined);
            return { contents };
        }
    }

    public async store(uri: Uri, contents?: INotebookContents): Promise<void> {
        const key = `notebookhot-${uri.toString()}`;
        await this.workspaceStorage.update(key, contents ? contents.contents : undefined);
    }
}

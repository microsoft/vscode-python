// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri, WorkspaceFolder } from 'vscode';

export class MockWorkspaceFolder implements WorkspaceFolder {
    public uri: Uri;
    public name: string;
    public ownedResources = new Set<string>();

    constructor(folder: string, public index: number) {
        this.uri = Uri.file(folder);
        this.name = folder;
    }
}

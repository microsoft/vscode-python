// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { Uri } from 'vscode';
import { LegacyFileSystem } from '../serviceRegistry';

export class MockFileSystem extends LegacyFileSystem {
    private contentOverloads = new Map<string, string>();

    constructor() {
        super();
    }
    public async readFile(file: string | Uri): Promise<string> {
        const contents =
            typeof file === 'string' ? this.contentOverloads.get(file) : this.contentOverloads.get(file.fsPath);
        if (contents) {
            return contents;
        }
        return super.readFile(file);
    }
    public addFileContents(filePath: string, contents: string): void {
        this.contentOverloads.set(filePath, contents);
    }
}

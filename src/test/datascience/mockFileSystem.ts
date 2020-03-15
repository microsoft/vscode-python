// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { LegacyFileSystem } from '../serviceRegistry';

export class MockFileSystem extends LegacyFileSystem {
    private contentOverloads = new Map<string, string>();

    constructor() {
        super();
    }
    public async readFile(filePath: string): Promise<string> {
        const contents = this.contentOverloads.get(filePath);
        if (contents) {
            return contents;
        }
        return super.readFile(filePath);
    }
    public addFileContents(filePath: string, contents: string): void {
        this.contentOverloads.set(filePath, contents);
    }
}

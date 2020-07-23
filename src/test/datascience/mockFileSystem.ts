// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { DataScienceFileSystem } from '../../client/datascience/dataScienceFileSystem';

export class MockFileSystem extends DataScienceFileSystem {
    private contentOverloads = new Map<string, string>();

    constructor() {
        super();
    }
    public async readLocalFile(filePath: string): Promise<string> {
        const contents = this.contentOverloads.get(filePath);
        if (contents) {
            return contents;
        }
        return super.readLocalFile(filePath);
    }
    public addFileContents(filePath: string, contents: string): void {
        this.contentOverloads.set(filePath, contents);
    }
}

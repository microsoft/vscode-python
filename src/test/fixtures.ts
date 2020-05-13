// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-console

export type CleanupFunc = (() => void) | (() => Promise<void>);

export class CleanupFixture {
    private cleanups: CleanupFunc[];
    constructor() {
        this.cleanups = [];
    }

    public addCleanup(cleanup: CleanupFunc) {
        this.cleanups.push(cleanup);
    }

    public async cleanUp() {
        const cleanups = this.cleanups;
        this.cleanups = [];

        return Promise.all(
            cleanups.map(async (cleanup, i) => {
                try {
                    const res = cleanup();
                    if (res) {
                        await res;
                    }
                } catch (err) {
                    console.error(`cleanup ${i + 1} failed: ${err}`);
                    console.error('moving on...');
                }
            })
        );
    }
}

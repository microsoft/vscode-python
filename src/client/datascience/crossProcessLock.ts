import { open, unlink } from 'fs-extra';
import { tmpdir } from 'os';
import * as path from 'path';
import { sleep } from '../common/utils/async';

export class CrossProcessLock {
    private lockFilePath: string;
    private acquired: boolean = false;

    constructor(mutexName: string) {
        this.lockFilePath = path.join(tmpdir(), `${mutexName}.tmp`);
    }

    public async lock(): Promise<boolean> {
        const maxTries = 10;
        let tries = 0;
        while (!this.acquired && tries < maxTries) {
            try {
                await this.acquire();
                if (this.acquired) {
                    return true;
                }
                await sleep(100);
            } catch (err) {
                // Swallow the error and retry
            }
            tries += 1;
        }
        return false;
    }

    public async unlock() {
        // Does nothing if the lock is not currently held
        if (this.acquired) {
            // Delete the lockfile
            await unlink(this.lockFilePath);
            this.acquired = false;
        }
    }

    /*
    One of the few atomicity guarantees that the node fs module appears to provide
    is with fs.open(). With the 'wx' option flags, open() will error if the
    file already exists, which tells us if it was already created in another process.
    Hence we can use the existence of the file as a flag indicating whether we have
    successfully acquired the right to create the keyfile.
    */
    private async acquire() {
        try {
            await open(this.lockFilePath, 'wx');
            this.acquired = true;
        } catch (err) {
            if (err.code !== 'EEXIST') {
                throw err;
            }
        }
    }
}

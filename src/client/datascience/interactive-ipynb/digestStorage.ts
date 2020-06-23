import { createHash, randomBytes } from 'crypto';
import { promises, unlink } from 'fs';
import { inject, injectable } from 'inversify';
import { tmpdir } from 'os';
import * as path from 'path';
import { traceError, traceInfo } from '../../common/logger';
import { isFileNotFoundError } from '../../common/platform/errors';
import { IFileSystem } from '../../common/platform/types';
import { IExtensionContext } from '../../common/types';
import { IDigestStorage } from '../types';

interface ICrossProcessLock {
    lock(): Promise<boolean>;
    unlock(): Promise<void>;
}
class CrossProcessLock implements ICrossProcessLock {
    private lockFilePath: string;
    private acquired: boolean = false;

    constructor(mutexName: string) {
        this.lockFilePath = path.join(tmpdir(), `${mutexName}.tmp`);
    }

    public lock(): Promise<boolean> {
        return new Promise(async (resolve, _reject) => {
            const maxTries = 10;
            let tries = 0;
            while (!this.acquired && tries < maxTries) {
                try {
                    await this.acquire(); // (Re)attempt acquisition
                    setTimeout(() => {
                        // Wait for acquire to complete
                        if (this.acquired) {
                            resolve(true);
                        }
                    }, 100); // Retry every 100ms
                } catch (err) {
                    // Swallow the error and retry
                }
                tries += 1;
            }
            if (tries === maxTries) {
                resolve(false);
            }
        });
    }

    public unlock() {
        if (this.acquired) {
            // Does nothing if the lock is not currently held
            return new Promise<void>((resolve, _reject) => {
                // Delete the lockfile
                unlink(this.lockFilePath, (err) => {
                    if (err) {
                        traceError(err);
                    }
                });
                this.acquired = false;
                resolve();
            });
        } else {
            return new Promise<void>((resolve, _reject) => {
                resolve();
            });
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
            await promises.open(this.lockFilePath, 'wx');
            this.acquired = true;
        } catch (err) {
            if (err.code !== 'EEXIST') {
                throw err;
            }
        }
    }
}

// NB: still need to implement automatic culling of least recently used entries
@injectable()
export class DigestStorage implements IDigestStorage {
    public readonly key: Promise<string>;
    private digestDir: Promise<string>;

    constructor(
        @inject(IFileSystem) private fs: IFileSystem,
        @inject(IExtensionContext) private extensionContext: IExtensionContext
    ) {
        this.key = this.initKey();
        this.digestDir = this.initDir();
    }

    public async saveDigest(uri: string, signature: string) {
        const fileName = createHash('sha256').update(uri).digest('hex');
        const fileLocation = path.join(await this.digestDir, fileName);
        // Since the signature is a hex digest, the character 'z' is being used to delimit the start and end of a single digest
        await this.fs.appendFile(fileLocation, `z${signature}z\n`);
    }

    public async containsDigest(uri: string, signature: string) {
        const fileName = createHash('sha256').update(uri).digest('hex');
        const fileLocation = path.join(await this.digestDir, fileName);
        try {
            const digests = await this.fs.readFile(fileLocation);
            return digests.indexOf(`z${signature}z`) >= 0;
        } catch (err) {
            if (!isFileNotFoundError(err)) {
                traceError(err); // Don't log the error if the file simply doesn't exist
            }
            return false;
        }
    }

    private async initDir(): Promise<string> {
        const defaultDigestDirLocation = this.getDefaultLocation('nbsignatures');
        if (!(await this.fs.directoryExists(defaultDigestDirLocation))) {
            await this.fs.createDirectory(defaultDigestDirLocation);
        }
        return defaultDigestDirLocation;
    }

    /**
     * Get or create a local secret key, used in computing HMAC hashes of trusted
     * checkpoints in the notebook's execution history
     */
    private async initKey(): Promise<string> {
        const defaultKeyFileLocation = this.getDefaultLocation('nbsecret');

        const mutex = new CrossProcessLock('nbsecret');
        let key = randomBytes(1024).toString('hex');
        const success = await mutex.lock();
        if (success) {
            if (await this.fs.fileExists(defaultKeyFileLocation)) {
                // if the keyfile already exists, read it instead
                key = await this.fs.readFile(defaultKeyFileLocation);
            } else {
                // If it doesn't exist, create one
                // Key must be generated from a cryptographically secure pseudorandom function:
                // https://nodejs.org/api/crypto.html#crypto_crypto_randombytes_size_callback
                // No callback is provided so random bytes will be generated synchronously
                await this.fs.writeFile(defaultKeyFileLocation, key);
            }
        } else {
            traceInfo('Failed to initialize or locate key file.');
        }
        await mutex.unlock();
        return key; // If we were unable to acquire lock, use a temporary key held in memory
    }

    private getDefaultLocation(fileName: string) {
        const dir = this.extensionContext.globalStoragePath;
        if (dir) {
            return path.join(dir, fileName);
        }
        throw new Error('Unable to locate extension global storage path for trusted digest storage');
    }
}

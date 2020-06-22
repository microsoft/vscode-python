import { createHash, randomBytes } from 'crypto';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { IFileSystem } from '../../common/platform/types';
import { IExtensionContext } from '../../common/types';
import { traceError } from '../../logging';
import { IDigestStorage } from '../types';

// NB: still need to implement automatic culling of least recently used entries
@injectable()
export class DigestStorage implements IDigestStorage {
    public key: Promise<string>;
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
        try {
            if (!(await this.fs.fileExists(fileLocation))) {
                await this.fs.writeFile(fileLocation, `${signature}\n`);
            } else {
                await this.fs.appendFile(fileLocation, `${signature}\n`);
            }
        } catch (err) {
            traceError(err);
        }
    }

    public async containsDigest(uri: string, signature: string) {
        const fileName = createHash('sha256').update(uri).digest('hex');
        const fileLocation = path.join(await this.digestDir, fileName);
        try {
            if (!(await this.fs.fileExists(fileLocation))) {
                return false;
            } else {
                // // naive approach that works: read entire digest file contents, do regex match
                const digests = await this.fs.readFile(fileLocation);
                const match = digests.match(new RegExp(`/^${signature}/`, 'm'));
                return match !== null;
            }
        } catch (err) {
            traceError(err);
            return false;
        }
    }

    private initDir(): Promise<string> {
        return new Promise(async (resolve, reject) => {
            try {
                const defaultDigestDirLocation = this.getDefaultLocation('nbsignatures');
                if (!(await this.fs.directoryExists(defaultDigestDirLocation))) {
                    await this.fs.createDirectory(defaultDigestDirLocation);
                }
                resolve(defaultDigestDirLocation);
            } catch (err) {
                traceError(err);
                reject(err);
            }
        });
    }

    /**
     * Get or create a local secret key, used in computing HMAC hashes of trusted
     * checkpoints in the notebook's execution history
     */
    private initKey(): Promise<string> {
        return new Promise(async (resolve, reject) => {
            try {
                const defaultKeyFileLocation = this.getDefaultLocation('nbsecret');
                if (await this.fs.fileExists(defaultKeyFileLocation)) {
                    // if the keyfile already exists, bail out
                    resolve((await this.fs.readFile(defaultKeyFileLocation)) as string);
                } else {
                    // If it doesn't exist, create one
                    // Key must be generated from a cryptographically secure pseudorandom function:
                    // https://nodejs.org/api/crypto.html#crypto_crypto_randombytes_size_callback
                    // No callback is provided so random bytes will be generated synchronously
                    const key = randomBytes(1024).toString('hex');
                    await this.fs.writeFile(defaultKeyFileLocation, key);
                    resolve(key);
                }
            } catch (err) {
                traceError(err);
                reject(err);
            }
        });
    }

    private getDefaultLocation(fileName: string) {
        const dir = this.extensionContext.globalStoragePath;
        if (dir) {
            return path.join(dir, fileName);
        }
        throw new Error('Unable to locate extension global storage path for trusted digest storage');
    }
}

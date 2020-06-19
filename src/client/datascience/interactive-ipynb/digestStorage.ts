import { randomBytes } from 'crypto';
import { inject, injectable } from 'inversify';
import * as Lowdb from 'lowdb';
import * as FileAsync from 'lowdb/adapters/FileAsync';
import * as path from 'path';
import { IFileSystem } from '../../common/platform/types';
import { IExtensionContext } from '../../common/types';
import { IDigestStorage } from '../types';

type DigestEntry = {
    signature: string;
    algorithm: string;
    timestamp: string;
};
type Schema = {
    nbsignatures: DigestEntry[];
};

// NB: still need to implement automatic culling of least recently used entries
@injectable()
export class DigestStorage implements IDigestStorage {
    public key: Promise<string>;
    private defaultDatabaseLocation: string;
    private db: Lowdb.LowdbAsync<Schema> | undefined;

    constructor(
        @inject(IFileSystem) private fs: IFileSystem,
        @inject(IExtensionContext) private extensionContext: IExtensionContext
    ) {
        this.defaultDatabaseLocation = this.getDefaultDatabaseLocation();
        this.key = this.initKey();
    }

    public async saveDigest(signature: string, algorithm: string) {
        await this.initDb();
        this.db!.get('nbsignatures').push({ signature, algorithm, timestamp: Date.now().toString() }).write();
    }

    public async containsDigest(signature: string, algorithm: string) {
        await this.initDb();
        const val = this.db!.get('nbsignatures').find({ signature, algorithm }).value();
        return val !== undefined;
    }

    /**
     * Get or create a local secret key, used in computing HMAC hashes of trusted
     * checkpoints in the notebook's execution history
     */
    private initKey(): Promise<string> {
        if (this.key === undefined) {
            return new Promise(async (resolve, _reject) => {
                // Determine user's OS
                const defaultKeyFileLocation = this.getDefaultKeyFileLocation();

                // Attempt to read from standard keyfile location for that OS
                if (await this.fs.fileExists(defaultKeyFileLocation)) {
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
            });
        } else {
            return this.key;
        }
    }

    private async initDb() {
        if (this.db === undefined) {
            const adapter = new FileAsync<Schema>(this.defaultDatabaseLocation);
            this.db = await Lowdb(adapter);
            if (this.db.get('nbsignatures') === undefined) {
                this.db.defaults({ nbsignatures: [] }).write();
            }
        }
    }

    private getDefaultDatabaseLocation() {
        const dbName = 'nbsignatures.json';
        const dir = this.extensionContext.globalStoragePath;
        if (dir) {
            return path.join(dir, dbName);
        }
        throw new Error('Unable to locate database');
    }

    private getDefaultKeyFileLocation() {
        const keyfileName = 'nbsecret';
        const dir = this.extensionContext.globalStoragePath;
        if (dir) {
            return path.join(dir, keyfileName);
        }
        throw new Error('Unable to locate keyfile');
    }
}

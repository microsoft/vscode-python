import { randomBytes } from 'crypto';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Database, OPEN_CREATE, OPEN_READWRITE, RunResult } from 'sqlite3';
import { IFileSystem, IPlatformService } from '../../common/platform/types';
import { /*IExperimentsManager,*/ IPathUtils } from '../../common/types';
import { OSType } from '../../common/utils/platform';
import { IDigestStorage } from '../types';

// Our implementation of the IDigestStorage interface, which internally uses a SQLite database
// NB: still need to implement automatic culling of least recently used entries
@injectable()
export class DigestStorage implements IDigestStorage {
    private defaultDatabaseLocation: string;
    private db: Database | undefined;
    private _key: string | undefined;

    constructor(
        @inject(IFileSystem) private fs: IFileSystem,
        @inject(IPlatformService) private platformService: IPlatformService,
        @inject(IPathUtils) private readonly pathUtils: IPathUtils
    ) {
        this.defaultDatabaseLocation = this.getDefaultDatabaseLocation();
    }

    public get key() {
        return this._key!;
    }

    public async saveDigest(digest: string, algorithm: string): Promise<void> {
        await this.initDb();
        await this.initKey();
        return new Promise((resolve, reject) => {
            this.db!.run(
                `INSERT INTO nbsignatures (algorithm, signature, last_seen);
                VALUES (${algorithm}, '${digest}', ${Date.now().toString()});`,
                (_runResult: RunResult, err: Error) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    public async containsDigest(digest: string, algorithm: string): Promise<boolean> {
        await this.initDb();
        await this.initKey();
        return new Promise((resolve, reject) => {
            this.db!.get(
                `SELECT * FROM nbsignatures WHERE signature == ${digest} AND algorithm == ${algorithm}`,
                (err, rowData) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rowData === undefined);
                    }
                }
            );
        });
    }

    private async initDb() {
        if (this.db === undefined) {
            const db = new Database(
                this.defaultDatabaseLocation,
                (await this.fs.fileExists(this.defaultDatabaseLocation)) ? OPEN_READWRITE : OPEN_CREATE
            );
            db.serialize(() => {
                db.exec(`CREATE TABLE IF NOT EXISTS nbsignatures (
                    id integer PRIMARY KEY AUTOINCREMENT,
                    algorithm text,
                    signature text,
                    path text,
                    last_seen timestamp
                );`);
                db.exec(`CREATE INDEX IF NOT EXISTS algosig ON nbsignatures(algorithm, signature)`);
            });
            this.db = db;
        }
    }

    /**
     * Get or create a local secret key, used in computing HMAC hashes of trusted
     * checkpoints in the notebook's execution history
     */
    private async initKey() {
        // Determine user's OS
        const defaultKeyFileLocation = this.getDefaultKeyFileLocation();

        // Attempt to read from standard keyfile location for that OS
        if (await this.fs.fileExists(defaultKeyFileLocation)) {
            return (await this.fs.readData(defaultKeyFileLocation)).toString();
        }

        // If it doesn't exist, create one
        // Key must be generated from a cryptographically secure pseudorandom function:
        // https://nodejs.org/api/crypto.html#crypto_crypto_randombytes_size_callback
        // No callback is provided so random bytes will be generated synchronously
        const key = randomBytes(1024);
        await this.fs.writeFile(defaultKeyFileLocation, key);
        this._key = key.toString();
    }

    /**
     * Default Jupyter database locations:
     * Linux:   ~/.local/share/jupyter/nbsignatures.db
     * OS X:    ~/Library/Jupyter/nbsignatures.db
     * Windows: %APPDATA%/jupyter/nbsignatures.db
     */
    private getDefaultDatabaseLocation() {
        switch (this.platformService.osType) {
            case OSType.Windows:
                return path.join('%APPDATA%', 'jupyter', 'nbsignatures.db');
            case OSType.OSX:
                return path.join(this.pathUtils.home, 'Library', 'Jupyter', 'nbsignatures.db');
            case OSType.Linux:
                return path.join(this.pathUtils.home, '.local', 'share', 'jupyter', 'nbsignatures.db');
            default:
                throw new Error('Not Supported');
        }
    }

    /**
     * Default Jupyter secret key locations:
     * Linux:   ~/.local/share/jupyter/notebook_secret
     * OS X:    ~/Library/Jupyter/notebook_secret
     * Windows: %APPDATA%/jupyter/notebook_secret
     */
    private getDefaultKeyFileLocation() {
        switch (this.platformService.osType) {
            case OSType.Windows:
                return path.join('%APPDATA%', 'jupyter', 'notebook_secret');
            case OSType.OSX:
                return path.join(this.pathUtils.home, 'Library', 'Jupyter', 'notebook_secret');
            case OSType.Linux:
                return path.join(this.pathUtils.home, '.local', 'share', 'jupyter', 'notebook_secret');
            default:
                throw new Error('Not Supported');
        }
    }
}

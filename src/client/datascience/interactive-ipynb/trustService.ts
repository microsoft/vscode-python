import { randomBytes } from 'crypto';
import { enc, HmacSHA256 } from 'crypto-js';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Database, OPEN_CREATE, OPEN_READWRITE, RunResult } from 'sqlite3';
import { IFileSystem, IPlatformService } from '../../common/platform/types';
import { IExperimentsManager, IPathUtils } from '../../common/types';
import { OSType } from '../../common/utils/platform';
import { IDigestStorage, ITrustService } from '../types';

// Our implementation of the IDigestStorage interface, which internally uses a SQLite database
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

interface INotebookTrust {
    isNotebookTrusted(notebookContents: string): Promise<boolean>;
    trustNotebook(notebookContents: string): Promise<void>;
}

class NotebookTrust implements INotebookTrust {
    private digestStorage: IDigestStorage;
    private algorithm: 'sha256'; // Update this to be a union datatype over all supported algorithms

    constructor(digestStorage: IDigestStorage, algorithm?: 'sha256') {
        this.digestStorage = digestStorage;
        this.algorithm = algorithm ? algorithm : 'sha256';
    }

    public isNotebookTrusted(notebookContents: string): Promise<boolean> {
        const digest = this.computeDigest(notebookContents);
        return this.digestStorage.containsDigest(digest, this.algorithm);
    }

    public trustNotebook(notebookContents: string): Promise<void> {
        const digest = this.computeDigest(notebookContents);
        return this.digestStorage.saveDigest(digest, this.algorithm);
    }

    private computeDigest(notebookContents: string) {
        switch (this.algorithm) {
            case 'sha256':
                return HmacSHA256(notebookContents, this.digestStorage.key).toString(enc.Hex); // Switch this out for the MSR crypto lib implementation
            default:
                throw new Error('Not supported');
        }
    }
}

@injectable()
export class TrustService implements ITrustService {
    private notebookTrust: INotebookTrust | undefined;

    constructor(
        @inject(IExperimentsManager) private readonly experiment: IExperimentsManager,
        @inject(IDigestStorage) private readonly digestStorage: IDigestStorage
    ) {}

    /**
     * When a notebook is opened, we check the database to see if a trusted checkpoint
     * for this notebook exists by computing and looking up its digest.
     * If the digest does not exist, we mark all the cells untrusted.
     * Once a notebook is loaded in an untrusted state, no code will be executed and no
     * markdown will be rendered until notebook as a whole is marked trusted
     */
    public async isNotebookTrusted(notebookContents: string) {
        await this.initNotebookTrust();
        // Compute digest and see if notebook is trusted
        return this.notebookTrust!.isNotebookTrusted(notebookContents);
    }

    /**
     * Call this method on a notebook save
     * It will add a new trusted checkpoint to the local database if it's safe to do so
     * I.e. if the notebook has already been trusted by the user
     */
    public async updateTrust(notebookContents: string, notebookModelIsTrusted: boolean) {
        await this.initNotebookTrust();
        if (notebookModelIsTrusted) {
            await this.notebookTrust!.trustNotebook(notebookContents);
        }
        // Otherwise, do nothing
    }

    private async initNotebookTrust() {
        if (this.notebookTrust === undefined) {
            this.notebookTrust = new NotebookTrust(this.digestStorage, 'sha256');
        }
    }
}

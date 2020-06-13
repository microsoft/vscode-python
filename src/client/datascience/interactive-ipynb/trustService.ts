import { enc, HmacSHA256 } from 'crypto-js';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Database, OPEN_CREATE, OPEN_READWRITE, RunResult } from 'sqlite3';
import { IFileSystem, IPlatformService } from '../../common/platform/types';
import { IExperimentsManager, IPathUtils } from '../../common/types';
import { OSType } from '../../common/utils/platform';

interface IDigestStorage {
    saveDigest(digest: string, algorithm: string): Promise<void>;
    containsDigest(digest: string): Promise<boolean>;
}

// Our implementation of the IDigestStorage interface, which internally uses a SQLite database
@injectable()
export class DigestStorage implements IDigestStorage {
    private db: Database;

    constructor(
        @inject(IFileSystem) private fs: IFileSystem,
        @inject(IPlatformService) private platformService: IPlatformService,
        @inject(IPathUtils) private readonly pathUtils: IPathUtils
    ) {
        const defaultDatabaseLocation = this.getDefaultDatabaseLocation();
        const db = new Database(
            defaultDatabaseLocation,
            this.fs.fileExists(defaultDatabaseLocation) ? OPEN_READWRITE : OPEN_CREATE
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

    public saveDigest(digest: string, algorithm: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run(
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

    public containsDigest(digest: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.db.get(`SELECT * FROM nbsignatures WHERE signature == ${digest}`, (err, rowData) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rowData === undefined);
                }
            });
        });
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
}

interface INotebookTrust {
    isNotebookTrusted(notebookContents: string): Promise<boolean>;
    trustNotebook(notebookContents: string): Promise<void>;
}

class NotebookTrust implements INotebookTrust {
    private key: string;
    private digestStorage: IDigestStorage;
    private algorithm: 'sha256'; // Update this to be a union datatype over all supported algorithms

    constructor(secretKey: string, digestStorage: IDigestStorage, algorithm?: 'sha256') {
        this.key = secretKey;
        this.digestStorage = digestStorage;
        this.algorithm = algorithm ? algorithm : 'sha256';
    }

    public isNotebookTrusted(notebookContents: string): Promise<boolean> {
        const digest = this.computeDigest(notebookContents);
        return this.digestStorage.containsDigest(digest);
    }

    public trustNotebook(notebookContents: string): Promise<void> {
        const digest = this.computeDigest(notebookContents);
        return this.digestStorage.saveDigest(digest, this.algorithm);
    }

    private computeDigest(notebookContents: string) {
        switch (this.algorithm) {
            case 'sha256':
                return HmacSHA256(notebookContents, this.key).toString(enc.Hex); // Switch this out for the MSR crypto lib implementation
            default:
                throw new Error('Not supported');
        }
    }
}

@injectable()
export class TrustService {
    private notebookTrust: INotebookTrust;

    constructor(
        @inject(IExperimentsManager) private readonly experiment: IExperimentsManager,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IPathUtils) private readonly pathUtils: IPathUtils,
        @inject(IPlatformService) private readonly platformService: IPlatformService,
        @inject(IDigestStorage) private readonly digestStorage: IDigestStorage
    ) {
        this.notebookTrust = new NotebookTrust(this.getOrCreateSecretKey(), digestStorage, 'sha256');
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

    /**
     * Get or create a local secret key, used in computing HMAC hashes of trusted
     * checkpoints in the notebook's execution history
     */
    private async getOrCreateSecretKey(): string {
        // Determine user's OS
        const defaultKeyFileLocation = this.getDefaultKeyFileLocation();

        // Attempt to read from standard keyfile location for that OS
        if (this.fs.fileExists(defaultKeyFileLocation)) {
            return (await this.fs.readData(defaultKeyFileLocation)).toString();
        }

        // If it doesn't exist, create one.
        // Key must be generated from a cryptographically secure pseudorandom function
    }

    private async onNotebookCreated(filePath: string) {
        // Compute a digest for it and add to database
        await this.notebookTrust.trustNotebook(filePath);
    }

    /**
     * When a notebook is opened, we check the database to see if a trusted checkpoint
     * for this notebook exists by computing and looking up its digest.
     * If the digest does not exist, we mark all the cells untrusted.
     * Once a notebook is loaded in an untrusted state, no code will be executed and no
     * markdown will be rendered until notebook as a whole is marked trusted
     */
    private async onNotebookOpened(filePath: string) {
        // Compute digest and see if notebook is trusted
        return this.notebookTrust.isNotebookTrusted(filePath);
    }

    /**
     * Marks notebook trusted if all the cells in the notebook have been executed
     * in the current user's context
     */
    private async onNotebookSaved(notebookIsTrusted: boolean) {
        // If all cells in notebook are trusted, compute digest and add to database
        if (notebookIsTrusted) {
            await this.notebookTrust.trustNotebook();
        }
        // Otherwise, do nothing
    }
}

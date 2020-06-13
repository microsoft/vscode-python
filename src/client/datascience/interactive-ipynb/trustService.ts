import { enc, HmacSHA256 } from 'crypto-js';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Database, OPEN_CREATE, OPEN_READWRITE, RunResult } from 'sqlite3';
import { traceError } from '../../common/logger';
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
    private osType: 'OSX' | 'Linux' | 'Windows';
    private homeDir: string;

    constructor(fs: IFileSystem, osType: 'OSX' | 'Linux' | 'Windows', homeDir: string) {
        const defaultDatabaseLocation = this.getDefaultDatabaseLocation();
        const db = new Database(
            defaultDatabaseLocation,
            fs.fileExists(defaultDatabaseLocation) ? OPEN_READWRITE : OPEN_CREATE
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
        this.osType = osType;
        this.homeDir = homeDir;
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
        switch (this.osType) {
            case OSType.Windows:
                return path.join('%APPDATA%', 'jupyter', 'nbsignatures.db');
            case OSType.OSX:
                return path.join(this.homeDir, 'Library', 'Jupyter', 'nbsignatures.db');
            case OSType.Linux:
                return path.join(this.homeDir, '.local', 'share', 'jupyter', 'nbsignatures.db');
            default:
                throw new Error('Not Supported');
        }
    }
}

interface INotebookTrust {
    isNotebookTrusted(notebookContents: string): Promise<boolean>;
    trustNotebook(notebookContents: string): Promise<void>;
}

@injectable()
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
                return HmacSHA256(notebookContents, this.key).toString(enc.Hex);
            default:
                throw new Error('Not supported');
        }
    }
}

// @injectable()
// export class TrustService {
//     constructor(
//         @inject(IExperimentsManager) private readonly experiment: IExperimentsManager,
//         @inject(IFileSystem) private readonly fs: IFileSystem,
//         @inject(IPathUtils) private readonly pathUtils: IPathUtils,
//         @inject(IPlatformService) private readonly platformService: IPlatformService,
//         @inject(IDigestStorage) private readonly digestStorage: IDigestStorage
//     ) {}

//     /**
//      * Default Jupyter secret key locations:
//      * Linux:   ~/.local/share/jupyter/notebook_secret
//      * OS X:    ~/Library/Jupyter/notebook_secret
//      * Windows: %APPDATA%/jupyter/notebook_secret
//      */
//     private getDefaultKeyFileLocation() {
//         switch (this.platformService.osType) {
//             case OSType.Windows:
//                 return path.join('%APPDATA%', 'jupyter', 'notebook_secret');
//             case OSType.OSX:
//                 return path.join(this.pathUtils.home, 'Library', 'Jupyter', 'notebook_secret');
//             case OSType.Linux:
//                 return path.join(this.pathUtils.home, '.local', 'share', 'jupyter', 'notebook_secret');
//             default:
//                 throw new Error('Not Supported');
//         }
//     }

//     /**
//      * Get or create a local secret key, used in computing HMAC hashes of trusted
//      * checkpoints in the notebook's execution history
//      */
//     private getOrCreateKeyFile(): string {
//         // Determine user's OS
//         const defaultKeyFileLocation = this.getDefaultKeyFileLocation();

//         // Attempt to read from standard keyfile location for that OS
//         if (this.fs.fileExists(defaultKeyFileLocation)) {
//             return (await this.fs.readData(defaultKeyFileLocation)).toString();
//         }

//         // If it doesn't exist, create one
//     }

//     /**
//      * Given a newly opened notebook, determine if it is trusted
//      */
//     private isNotebookTrusted(filePath: string): boolean {
//         const digest = this.computeDigest(filePath);
//         return this.dbContains(digest);
//     }

//     /**
//      * Calculate and return digest for a trusted notebook
//      */
//     private computeDigest(fileContents: string): string {
//         return HmacSHA256(fileContents, this.key).toString(enc.Hex);
//     }

//     /**
//      * Update database with digest
//      */
//     private updateDb(digest: string) {
//         this.db.run(`INSERT INTO nbsignatures (algorithm, signature);
//                     VALUES (${digest}, 'sha256');`);
//     }

//     /**
//      * Given a digest, check to see if the database contains it
//      */
//     private dbContains(digest: string): boolean {
//         // Execute db query to see if this exact digest already exists

//         return false;
//     }

//     /**
//      * Computes and inserts a new digest representing a trusted checkpoint into database
//      */
//     private trustNotebook(filePath: string) {
//         const digest = this.computeDigest(filePath);
//         this.updateDb(digest);
//     }

//     private onNotebookCreated(filePath: string) {
//         // Compute a digest for it and add to database
//         this.trustNotebook(filePath);
//     }

//     /**
//      * When a notebook is opened, we check the database to see if a trusted checkpoint
//      * for this notebook exists by computing and looking up its digest.
//      * If the digest does not exist, we mark all the cells untrusted.
//      * Once a notebook is loaded in an untrusted state, all cells must be executed
//      * by the current user before the notebook as a whole can be marked trusted
//      */
//     private onNotebookOpened(filePath: string) {
//         // Compute digest and see if notebook is trusted
//         const cellInitialTrustState = this.isNotebookTrusted(filePath);
//         // Set all cell metadata flags accordingly
//     }

//     // /**
//     //  * Marks notebook trusted if all the cells in the notebook have been executed
//     //  * in the current user's context
//     //  */
//     // private onNotebookSaved() {
//     //     // If all cells in notebook are trusted, compute digest and add to database
//     //     if (this.notebookCanBeTrusted()) {
//     //         this.trustNotebook();
//     //     }
//     //     // Otherwise, do nothing
//     // }

//     // private onCellExecuted() {
//     //     // Set cell's trust flag to true
//     // }
// }

import { HmacSHA256 } from 'crypto-js';
import { injectable, inject } from 'inversify';
import { Database } from 'sqlite3';
import { IFileSystem, IPlatformService } from '../../common/platform/types';
import { IExperimentsManager, IPathUtils } from '../../common/types';
import { OSType } from '../../common/utils/platform';
import * as path from 'path';

@injectable()
export class TrustService {
    private key: string;
    private db: Database;

    constructor(
        @inject(IExperimentsManager) private readonly experiment: IExperimentsManager,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IPathUtils) private readonly pathUtils: IPathUtils,
        @inject(IPlatformService) private readonly platformService: IPlatformService
    ) {
        this.db = this.getOrCreateDatabase();
        this.key = this.getOrCreateKeyFile();
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

    /**
     * Get or create a local SQLite database for storing a history of trusted notebook digests
     */
    private getOrCreateDatabase() {
        // Determine user's OS
        const defaultDatabaseLocation = this.getDefaultDatabaseLocation();
        let db;

        // Attempt to read from standard database location for that OS
        if (this.fs.fileExists(defaultDatabaseLocation)) {
            db = new Database(defaultDatabaseLocation, (_err) => {
                // If database doesn't exist or reading from it fails, create our own
                const DB_PATH = ':memory:'; // TODO: replace this with real filepath in custom directory that AzNB will also read
                db = new Database(DB_PATH);

                // Create database schema; for now this is identical to Jupyter's in case we want compatibility
                const dbSchema = `CREATE TABLE IF NOT EXISTS nbsignatures (
                    id integer PRIMARY KEY AUTOINCREMENT,
                    algorithm text,
                    signature text,
                    path text,
                    last_seen timestamp
                );`;
                db.exec(dbSchema);
                db.exec(`CREATE INDEX IF NOT EXISTS algosig ON nbsignatures(algorithm, signature)`);
            })
        }
        return db;
    }

    /**
     * Get or create a local secret key, used in computing HMAC hashes of trusted
     * checkpoints in the notebook's execution history
     */
    private getOrCreateKeyFile(): string {
        // Determine user's OS
        const defaultKeyFileLocation = this.getDefaultKeyFileLocation();

        // Attempt to read from standard keyfile location for that OS
        if (this.fs.fileExists(defaultKeyFileLocation)) {
            return (await this.fs.readData(defaultKeyFileLocation)).toString();
        }

        // If it doesn't exist, create one
    }

    /**
     * Given a newly opened notebook, determine if it is trusted
     */
    private isNotebookTrusted(filePath: string): boolean {
        const digest = this.computeDigest(filePath);
        return this.dbContains(digest);
    }

    /**
     * Calculate and return digest for a trusted notebook
     */
    private computeDigest(filePath: string): string {
        // Get active notebook contents
        const notebookContents = ;
        // Get secret key
        const secretKey = this.key;
        // Compute and return digest
        return HmacSHA256(notebookContents, secretKey).toString();
    }

    /**
     * Update database with digest
     */
    private updateDb(digest: string) {
        this.db.run(`INSERT INTO nbsignatures (algorithm, signature);
                    VALUES (${digest}, 'sha256');`);
    }

    /**
     * Given a digest, check to see if the database contains it
     */
    private dbContains(digest: string): boolean {
        // Execute db query to see if this exact digest already exists

        return false;
    }

    /**
     * Computes and inserts a new digest representing a trusted checkpoint into database
     */
    private trustNotebook(filePath: string) {
        const digest = this.computeDigest(filePath);
        this.updateDb(digest);
    }

    private onNotebookCreated(filePath: string) {
        // Compute a digest for it and add to database
        this.trustNotebook(filePath);
    }

    /**
     * When a notebook is opened, we check the database to see if a trusted checkpoint
     * for this notebook exists by computing and looking up its digest.
     * If the digest does not exist, we mark all the cells untrusted.
     * Once a notebook is loaded in an untrusted state, all cells must be executed
     * by the current user before the notebook as a whole can be marked trusted
     */
    private onNotebookOpened(filePath: string) {
        // Compute digest and see if notebook is trusted
        const cellInitialTrustState = this.isNotebookTrusted(filePath);
        // Set all cell metadata flags accordingly

    }

    // /**
    //  * Marks notebook trusted if all the cells in the notebook have been executed
    //  * in the current user's context
    //  */
    // private onNotebookSaved() {
    //     // If all cells in notebook are trusted, compute digest and add to database
    //     if (this.notebookCanBeTrusted()) {
    //         this.trustNotebook();
    //     }
    //     // Otherwise, do nothing
    // }

    // private onCellExecuted() {
    //     // Set cell's trust flag to true
    // }
}

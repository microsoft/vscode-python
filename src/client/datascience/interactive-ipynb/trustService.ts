import { HmacSHA256 } from 'crypto-js';
import { injectable, inject } from 'inversify';
import { Database } from 'sqlite3';
import { IFileSystem } from '../../common/platform/types';
import { IExperimentsManager } from '../../common/types';

@injectable()
export class TrustService {
    private key: string;
    private db: Database;

    constructor(
        @inject(IExperimentsManager) private readonly experiment: IExperimentsManager,
        @inject(IFileSystem) private readonly fs: IFileSystem,
    ) {
        this.db = this.getOrCreateDb();
        this.key = this.getOrCreateKeyFile();
    }

    /**
     * Get or create a local SQLite database for storing a history of trusted notebook digests
     * Default Jupyter database locations:
     *      Linux:   ~/.local/share/jupyter/nbsignatures.db
     *      OS X:    ~/Library/Jupyter/nbsignatures.db
     *      Windows: %APPDATA%/jupyter/nbsignatures.db
     */
    private getOrCreateDb() {
        // Determine user's OS
        // Attempt to read from standard database location for that OS

        // If database doesn't exist, create our own
        const DB_PATH = ':memory:'; // TODO: replace this with real filepath in custom directory that AzNB will also read
        const db = new Database(DB_PATH);

        // Create database schema; for now this is identical to Jupyter's in case we want compatibility
        const dbSchema = `CREATE TABLE IF NOT EXISTS nbsignatures (
            id integer PRIMARY KEY AUTOINCREMENT,
            algorithm text,
            signature text,
            path text,
            last_seen timestamp
        );`;
        db.exec(dbSchema);
        return db;
    }

    /**
     * Get or create a local secret key, used in computing HMAC hashes of trusted
     * checkpoints in the notebook's execution history
     * Default Jupyter secret key locations:
     *      Linux:   ~/.local/share/jupyter/notebook_secret
     *      OS X:    ~/Library/Jupyter/notebook_secret
     *      Windows: %APPDATA%/jupyter/notebook_secret
     */
    private getOrCreateKeyFile(): string {
        // Determine user's OS
        // Attempt to read from standard keyfile location for that OS

        // If it doesn't exist, create one
    }

    /**
     * Given a notebook, determine if it is trusted
     */
    private isNotebookTrusted(): boolean {
        const digest = this.computeDigest();
        return this.dbContains(digest);
    }

    /**
     * Given a notebook that we have decided is untrusted,
     * determine if it can now be trusted. Note that we set a cell's
     * trusted state to true when it is executed
     */
    private notebookCanBeTrusted(): boolean {
        // Map over all cells and check that trusted flag is set to true for all
        
    }

    /**
     * Calculate and return digest for a trusted notebook
     */
    private computeDigest(): string {
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
    private trustNotebook() {
        const digest = this.computeDigest();
        this.updateDb(digest);
    }

    private onNotebookCreated() {
        // Compute a digest for it and add to database
        this.trustNotebook();
    }

    /**
     * When a notebook is opened, we check the database to see if a trusted checkpoint
     * for this notebook exists by computing and looking up its digest.
     * If the digest does not exist, we mark all the cells untrusted.
     * Once a notebook is loaded in an untrusted state, all cells must be executed
     * by the current user before the notebook as a whole can be marked trusted
     */
    private onNotebookOpened() {
        // Compute digest and see if notebook is trusted
        const cellInitialTrustState = this.isNotebookTrusted();
        // Set all cell metadata flags accordingly

    }

    /**
     * Marks notebook trusted if all the cells in the notebook have been executed
     * in the current user's context
     */
    private onNotebookSaved() {
        // If all cells in notebook are trusted, compute digest and add to database
        if (this.notebookCanBeTrusted()) {
            this.trustNotebook();
        }
        // Otherwise, do nothing
    }

    private onCellExecuted() {
        // Set cell's trust flag to true
    }
}

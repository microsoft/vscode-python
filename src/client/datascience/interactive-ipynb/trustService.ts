import { injectable } from 'inversify';
import { Database } from 'sqlite3';
import { Uri } from 'vscode';

@injectable()
export class TrustService {
    private keyFile: Uri;
    private db: Database;

    constructor() {
        this.db = this.getOrCreateDb();
        this.keyFile = this.getOrCreateKeyFile();
    }

    /**
     * Given a notebook, determine if it is trusted
     */
    private isNotebookTrusted(): boolean {
        // If all cells are trusted, return true
        // If not all cells are trusted, return false
        return false;
    }

    /**
     * Get or create a local SQLite database for storing a history of trusted notebook digests
     */
    private getOrCreateDb(): Database {
        // Attempt to locate db on user's filesystem
        // If it doesn't exist, create one
    }

    /**
     * Get or create a local secret key, used in computing HMAC hashes of trusted
     * checkpoints in the notebook's execution history
     */
    private getOrCreateKeyFile(): Uri {
        // Attempt to locate secret key on user's filesystem
        // If it doesn't exist, create one
    }

    /**
     * Calculate and return digest for a trusted notebook
     */
    private computeDigest(): string {
        // Get active notebook contents
        // Get secret key
        // Compute digest
    }

    /**
     * Update database with digest
     */
    private updateDb(digest: string) {
        // If notebook is already present in database, write digest to database
        // Otherwise create a new entry for it
    }

    private trustNotebook() {
        this.updateDb(this.computeDigest());
    }

    private onNotebookCreated() {
        // Create an entry for this notebook in the database
        // Compute a digest for it and add to database
    }

    private onNotebookSaved() {
        // If notebook is trusted, compute digest and add to database
        // Otherwise, do nothing
    }
}

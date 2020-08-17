import { createHmac } from 'crypto';
import { inject, injectable } from 'inversify';
import { EventEmitter, Uri } from 'vscode';
import { IConfigurationService } from '../../common/types';
import { IDigestStorage, ITrustService } from '../types';

@injectable()
export class TrustService implements ITrustService {
    public get onDidSetNotebookTrust() {
        return this._onDidSetNotebookTrust.event;
    }
    private get alwaysTrustNotebooks() {
        return this.configService.getSettings().datascience.alwaysTrustNotebooks;
    }
    protected readonly _onDidSetNotebookTrust = new EventEmitter<void>();
    constructor(
        @inject(IDigestStorage) private readonly digestStorage: IDigestStorage,
        @inject(IConfigurationService) private configService: IConfigurationService
    ) {}

    /**
     * When a notebook is opened, we check the database to see if a trusted checkpoint
     * for this notebook exists by computing and looking up its digest.
     * If the digest does not exist, the notebook is marked untrusted.
     * Once a notebook is loaded in an untrusted state, no code will be executed and no
     * markdown will be rendered until notebook as a whole is marked trusted
     */
    public async isNotebookTrusted(uri: Uri, notebookContents: string) {
        if (this.alwaysTrustNotebooks) {
            return true; // Skip check if user manually overrode our trust checking
        }
        // Compute digest and see if notebook is trusted
        const digest = await this.computeDigest(notebookContents);
        return this.digestStorage.containsDigest(uri, digest);
    }

    /**
     * Call this method on a notebook save
     * It will add a new trusted checkpoint to the local database if it's safe to do so
     * I.e. if the notebook has already been trusted by the user
     */
    public async trustNotebook(uri: Uri, notebookContents: string) {
        if (!this.alwaysTrustNotebooks) {
            // Only update digest store if the user wants us to check trust
            const digest = await this.computeDigest(notebookContents);
            await this.digestStorage.saveDigest(uri, digest);
            this._onDidSetNotebookTrust.fire();
        }
    }

    private async computeDigest(notebookContents: string) {
        const hmac = createHmac('sha256', await this.digestStorage.key);
        hmac.update(notebookContents);
        return hmac.digest('hex');
    }
}

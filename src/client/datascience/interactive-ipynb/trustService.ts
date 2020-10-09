import { createHmac } from 'crypto';
import { inject, injectable } from 'inversify';
import { EventEmitter, Uri } from 'vscode';
import { traceError } from '../../common/logger';
import { IConfigurationService } from '../../common/types';
import { sortObjectPropertiesRecursively } from '../notebookStorage/vscNotebookModel';
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
        // Compute digest and see if notebook is trusted.
        // Check formatted & unformatted notebook. Possible user saved nb using old extension & opening using new extension.
        const [digest1, digest2] = await Promise.all([
            this.computeDigest(notebookContents),
            this.computeDigest(this.getFormattedContents(notebookContents))
        ]);

        return this.digestStorage.containsDigest(uri, digest1) || this.digestStorage.containsDigest(uri, digest2);
    }

    /**
     * Call this method on a notebook save
     * It will add a new trusted checkpoint to the local database if it's safe to do so
     * I.e. if the notebook has already been trusted by the user
     */
    public async trustNotebook(uri: Uri, notebookContents: string) {
        if (!this.alwaysTrustNotebooks) {
            notebookContents = this.getFormattedContents(notebookContents);
            // Only update digest store if the user wants us to check trust
            const digest = await this.computeDigest(notebookContents);
            await this.digestStorage.saveDigest(uri, digest);
            this._onDidSetNotebookTrust.fire();
        }
    }
    /**
     * If a notebook is opened & saved in Jupyter, even without making any changes, the JSON in ipynb could be different from the format saved by VSC.
     * Similarly, the JSON saved by native notebooks could be different when compared to how they are saved by standard notebooks.
     * When trusting a notebook, we don't trust the raw bytes in ipynb, we trust the contents, & ipynb stores JSON,
     * Hence when computing a hash we need to ensure the hash is always the same regardless of indentation of JSON & the order of properties in json.
     * This method returns the contents of the ipynb in a manner thats solves formatting issues related to JSON.
     */
    private getFormattedContents(notebookContents: string) {
        try {
            return JSON.stringify(sortObjectPropertiesRecursively(JSON.parse(notebookContents)));
        } catch (ex) {
            traceError('Notebook cannot be parsed into JSON', ex);
            return notebookContents;
        }
    }
    private async computeDigest(notebookContents: string) {
        const hmac = createHmac('sha256', await this.digestStorage.key);
        hmac.update(notebookContents);
        return hmac.digest('hex');
    }
}

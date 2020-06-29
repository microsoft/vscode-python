import { createHmac } from 'crypto';
import { inject, injectable } from 'inversify';
import { IConfigurationService } from '../../common/types';
import { IDigestStorage, ITrustService } from '../types';

@injectable()
export class TrustService implements ITrustService {
    private get alwaysTrustNotebooks() {
        return this.configService.getSettings().datascience.alwaysTrustNotebooks;
    }
    constructor(
        // @inject(IExperimentsManager) private readonly experiment: IExperimentsManager,
        @inject(IDigestStorage) private readonly digestStorage: IDigestStorage,
        @inject(IConfigurationService) private configService: IConfigurationService
    ) {}

    /**
     * When a notebook is opened, we check the database to see if a trusted checkpoint
     * for this notebook exists by computing and looking up its digest.
     * If the digest does not exist, we mark all the cells untrusted.
     * Once a notebook is loaded in an untrusted state, no code will be executed and no
     * markdown will be rendered until notebook as a whole is marked trusted
     */
    public async isNotebookTrusted(uri: string, notebookContents: string) {
        if (this.alwaysTrustNotebooks) {
            return true; // User manually overrode our trust checking
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
    public async trustNotebook(uri: string, notebookContents: string) {
        if (!this.alwaysTrustNotebooks) {
            // Only update digest store if the user wants us to check trust
            const digest = await this.computeDigest(notebookContents);
            return this.digestStorage.saveDigest(uri, digest);
        }
    }

    private async computeDigest(notebookContents: string) {
        const hmac = createHmac('sha256', await this.digestStorage.key);
        hmac.update(notebookContents);
        return hmac.digest('hex');
    }
}

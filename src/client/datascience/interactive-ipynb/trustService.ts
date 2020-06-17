import { createHmac } from 'crypto';
import { inject, injectable } from 'inversify';
import { IDigestStorage, ITrustService } from '../types';

@injectable()
export class TrustService implements ITrustService {
    constructor(
        // @inject(IExperimentsManager) private readonly experiment: IExperimentsManager,
        @inject(IDigestStorage) private readonly digestStorage: IDigestStorage,
        private algorithm: string = 'sha256'
    ) {}

    /**
     * When a notebook is opened, we check the database to see if a trusted checkpoint
     * for this notebook exists by computing and looking up its digest.
     * If the digest does not exist, we mark all the cells untrusted.
     * Once a notebook is loaded in an untrusted state, no code will be executed and no
     * markdown will be rendered until notebook as a whole is marked trusted
     */
    public async isNotebookTrusted(notebookContents: string) {
        // Compute digest and see if notebook is trusted
        const digest = this.computeDigest(notebookContents);
        return this.digestStorage.containsDigest(digest, this.algorithm);
    }

    /**
     * Call this method on a notebook save
     * It will add a new trusted checkpoint to the local database if it's safe to do so
     * I.e. if the notebook has already been trusted by the user
     */
    public async updateTrust(notebookContents: string, notebookModelIsTrusted: boolean) {
        if (notebookModelIsTrusted) {
            const digest = this.computeDigest(notebookContents);
            return this.digestStorage.saveDigest(digest, this.algorithm);
        }
        // Otherwise, do nothing
    }

    private computeDigest(notebookContents: string) {
        const hmac = createHmac(this.algorithm, this.digestStorage.key);
        hmac.update(notebookContents);
        return hmac.digest('hex');
    }
}

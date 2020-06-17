import { inject, injectable } from 'inversify';
import { IDigestStorage, INotebookTrust, ITrustService } from '../types';
import { NotebookTrust } from './notebookTrust';

@injectable()
export class TrustService implements ITrustService {
    private notebookTrust: INotebookTrust | undefined;

    constructor(
        // @inject(IExperimentsManager) private readonly experiment: IExperimentsManager,
        @inject(IDigestStorage) private readonly digestStorage: IDigestStorage
    ) {
        this.notebookTrust = new NotebookTrust(this.digestStorage, 'sha256'); // Inject this if we end up not codesharing
    }

    /**
     * When a notebook is opened, we check the database to see if a trusted checkpoint
     * for this notebook exists by computing and looking up its digest.
     * If the digest does not exist, we mark all the cells untrusted.
     * Once a notebook is loaded in an untrusted state, no code will be executed and no
     * markdown will be rendered until notebook as a whole is marked trusted
     */
    public async isNotebookTrusted(notebookContents: string) {
        // Compute digest and see if notebook is trusted
        return this.notebookTrust!.isNotebookTrusted(notebookContents);
    }

    /**
     * Call this method on a notebook save
     * It will add a new trusted checkpoint to the local database if it's safe to do so
     * I.e. if the notebook has already been trusted by the user
     */
    public async updateTrust(notebookContents: string, notebookModelIsTrusted: boolean) {
        if (notebookModelIsTrusted) {
            await this.notebookTrust!.trustNotebook(notebookContents);
        }
        // Otherwise, do nothing
    }
}

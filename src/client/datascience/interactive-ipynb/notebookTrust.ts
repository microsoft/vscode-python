import { createHmac } from 'crypto';
import { IDigestStorage, INotebookTrust } from '../types';

export class NotebookTrust implements INotebookTrust {
    private digestStorage: IDigestStorage;
    private algorithm: 'sha256'; // Update this to be a union datatype over all supported algorithms

    constructor(digestStorage: IDigestStorage, algorithm?: 'sha256') {
        this.digestStorage = digestStorage;
        this.algorithm = algorithm ? algorithm : 'sha256';
    }

    public isNotebookTrusted(notebookContents: string): Promise<boolean> {
        const digest = this.computeDigest(notebookContents);
        return this.digestStorage.containsDigest(digest, this.algorithm);
    }

    public trustNotebook(notebookContents: string): Promise<void> {
        const digest = this.computeDigest(notebookContents);
        return this.digestStorage.saveDigest(digest, this.algorithm);
    }

    private computeDigest(notebookContents: string) {
        const hmac = createHmac(this.algorithm, this.digestStorage.key);
        hmac.update(notebookContents);
        return hmac.digest('hex');
    }
}

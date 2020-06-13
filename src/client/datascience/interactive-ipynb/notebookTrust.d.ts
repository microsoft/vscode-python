// We will provide the implementation of this
export class NotebookTrust {
    constructor(secretKey: string, digestStorage?: IDigestStorage, algorithm?: string);
    public isNotebookTrusted(notebookContents: string): Promise<boolean>;
    public trustNotebook(notebookContents: string): Promise<void>;
}

// AzNB will need to provide something that implements this interface
interface IDigestStorage {
    saveDigest(digest: string, algorithm?: string): Promise<void>;
    containsDigest(digest: string): Promise<boolean>;
}

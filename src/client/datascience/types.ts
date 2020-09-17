import { Event, NotebookCell, QuickPickItem } from 'vscode';

export interface IJupyterServerUri {
    baseUrl: string;
    token: string;
    // tslint:disable-next-line: no-any
    authorizationHeader: any; // JSON object for authorization header.
    expiration?: Date; // Date/time when header expires and should be refreshed.
    displayName: string;
}

export type JupyterServerUriHandle = string;

export interface IJupyterUriProvider {
    readonly id: string; // Should be a unique string (like a guid)
    getQuickPickEntryItems(): QuickPickItem[];
    handleQuickPick(item: QuickPickItem, backEnabled: boolean): Promise<JupyterServerUriHandle | 'back' | undefined>;
    getServerUri(handle: JupyterServerUriHandle): Promise<IJupyterServerUri>;
}

export const IJupyterUriProviderRegistration = Symbol('IJupyterUriProviderRegistration');

export interface IJupyterUriProviderRegistration {
    getProviders(): Promise<ReadonlyArray<IJupyterUriProvider>>;
    registerProvider(picker: IJupyterUriProvider): void;
    getJupyterServerUri(id: string, handle: JupyterServerUriHandle): Promise<IJupyterServerUri>;
}

export const INotebookExtensibility = Symbol('INotebookExtensibility');

export interface INotebookExtensibility {
    readonly onKernelPostExecute: Event<NotebookCell>;
    readonly onKernelRestart: Event<void>;
    fireKernelRestart(): void;
    fireKernelPostExecute(cell: NotebookCell): void;
}

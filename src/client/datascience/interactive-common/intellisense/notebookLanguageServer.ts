import { Disposable } from 'vscode';
import * as c2p from 'vscode-languageclient/lib/common/codeConverter';
import * as p2c from 'vscode-languageclient/lib/common/protocolConverter';
import * as vscodeprotocol from 'vscode-languageserver-protocol';
import { Resource } from '../../../common/types';
import { createDeferred } from '../../../common/utils/async';
import { PythonEnvironment } from '../../../pythonEnvironments/info';
import { JupyterExtensionIntegration, LanguageServerConnection } from '../../api/jupyterIntegration';

/**
 * Class that wraps a language server for use by webview based notebooks
 * */
export class NotebookLanguageServer implements Disposable {
    private code2p = c2p.createConverter();
    private prot2c = p2c.createConverter();
    private constructor(private connection: LanguageServerConnection) {
    }

    public static async create(
        jupyterApiProvider: JupyterExtensionIntegration,
        resource: Resource,
        interpreter: PythonEnvironment | undefined
    ): Promise<NotebookLanguageServer | undefined> {
        // Create a server wrapper if we can get a connection to a language server
        const deferred = createDeferred<NotebookLanguageServer | undefined>();
        jupyterApiProvider.registerApi({
            registerPythonApi: (api) => {
                api.getLanguageServerConnection(interpreter ? interpreter : resource)
                    .then((c) => {
                        if (c) {
                            deferred.resolve(new NotebookLanguageServer(c));
                        } else {
                            deferred.resolve(undefined);
                        }
                    })
                    .catch(deferred.reject);
            }
        });
        return deferred.promise;
    }

    public dispose() {
        this.connection.dispose();
    }

    public sendOpen() {}

    public sendChanged() {}

    public provideCompletionItems() {}

    public provideSignatureHelp() {}

    public provideHover() {}

    public resolveCompletionItem() {
        if (this.connection.capabilities.);
    }
}

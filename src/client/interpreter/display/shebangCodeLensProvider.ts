import { inject, injectable } from 'inversify';
import { CancellationToken, CodeLens, Command, Event, Position, Range, TextDocument, Uri, workspace } from 'vscode';
import * as settings from '../../common/configSettings';
import { IProcessServiceFactory } from '../../common/process/types';
import { IS_WINDOWS } from '../../common/utils';
import { IServiceContainer } from '../../ioc/types';
import { IShebangCodeLensProvider } from '../contracts';

@injectable()
export class ShebangCodeLensProvider implements IShebangCodeLensProvider {
    // tslint:disable-next-line:no-any
    public onDidChangeCodeLenses: Event<void> = workspace.onDidChangeConfiguration as any as Event<void>;
    private readonly processServiceFactory: IProcessServiceFactory;
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        this.processServiceFactory = serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory);
    }
    public async detectShebang(document: TextDocument): Promise<string | undefined> {
        const firstLine = document.lineAt(0);
        if (firstLine.isEmptyOrWhitespace) {
            return;
        }

        if (!firstLine.text.startsWith('#!')) {
            return;
        }

        const shebang = firstLine.text.substr(2).trim();
        const pythonPath = await this.getFullyQualifiedPathToInterpreter(shebang, document.uri);
        return typeof pythonPath === 'string' && pythonPath.length > 0 ? pythonPath : undefined;
    }
    public async provideCodeLenses(document: TextDocument, token: CancellationToken): Promise<CodeLens[]> {
        const codeLenses = await this.createShebangCodeLens(document);
        return Promise.resolve(codeLenses);
    }
    private async getFullyQualifiedPathToInterpreter(pythonPath: string, resource: Uri) {
        let cmdFile = pythonPath;
        let args = ['-c', 'import sys;print(sys.executable)'];
        if (pythonPath.indexOf('bin/env ') >= 0 && !IS_WINDOWS) {
            // In case we have pythonPath as '/usr/bin/env python'.
            const parts = pythonPath.split(' ').map(part => part.trim()).filter(part => part.length > 0);
            cmdFile = parts.shift()!;
            args = parts.concat(args);
        }
        const processService = await this.processServiceFactory.create(resource);
        return processService.exec(cmdFile, args)
            .then(output => output.stdout.trim())
            .catch(() => '');
    }
    private async createShebangCodeLens(document: TextDocument) {
        const shebang = await this.detectShebang(document);
        const pythonPath = settings.PythonSettings.getInstance(document.uri).pythonPath;
        const resolvedPythonPath = await this.getFullyQualifiedPathToInterpreter(pythonPath, document.uri);
        if (!shebang || shebang === resolvedPythonPath) {
            return [];
        }

        const firstLine = document.lineAt(0);
        const startOfShebang = new Position(0, 0);
        const endOfShebang = new Position(0, firstLine.text.length - 1);
        const shebangRange = new Range(startOfShebang, endOfShebang);

        const cmd: Command = {
            command: 'python.setShebangInterpreter',
            title: 'Set as interpreter'
        };

        return [(new CodeLens(shebangRange, cmd))];
    }
}

import * as path from 'path';
import { Disposable, OutputChannel, Uri } from 'vscode';
import { IApplicationShell } from '../common/application/types';
import { IFileSystem } from '../common/platform/types';
import { IProcessServiceFactory } from '../common/process/types';
import { IConfigurationService, IPythonSettings } from '../common/types';
import { EXTENSION_ROOT_DIR } from '../constants';
import { captureTelemetry } from '../telemetry';
import { EventName } from '../telemetry/constants';

export class Generator implements Disposable {
    private optionsFile: string;
    private disposables: Disposable[];
    private pythonSettings: IPythonSettings;
    public get tagFilePath(): string {
        return this.pythonSettings.workspaceSymbols.tagFilePath;
    }
    public get enabled(): boolean {
        return this.pythonSettings.workspaceSymbols.enabled;
    }
    constructor(
        public readonly workspaceFolder: Uri,
        private readonly output: OutputChannel,
        private readonly appShell: IApplicationShell,
        private readonly fs: IFileSystem,
        private readonly processServiceFactory: IProcessServiceFactory,
        configurationService: IConfigurationService,
    ) {
        this.disposables = [];
        this.optionsFile = path.join(EXTENSION_ROOT_DIR, 'resources', 'ctagOptions');
        this.pythonSettings = configurationService.getSettings(workspaceFolder);
    }

    public dispose() {
        this.disposables.forEach((d) => d.dispose());
    }
    public async generateWorkspaceTags(): Promise<void> {
        if (!this.pythonSettings.workspaceSymbols.enabled) {
            return;
        }
        return this.generateTags({ directory: this.workspaceFolder.fsPath });
    }
    private buildCmdArgs(): string[] {
        const exclusions = this.pythonSettings.workspaceSymbols.exclusionPatterns;
        const excludes = exclusions.length === 0 ? [] : exclusions.map((pattern) => `--exclude=${pattern}`);

        return [`--options=${this.optionsFile}`, '--languages=Python'].concat(excludes);
    }
    @captureTelemetry(EventName.WORKSPACE_SYMBOLS_BUILD)
    private async generateTags(source: { directory?: string; file?: string }): Promise<void> {
        const tagFile = path.normalize(this.pythonSettings.workspaceSymbols.tagFilePath);
        const cmd = this.pythonSettings.workspaceSymbols.ctagsPath;
        const args = this.buildCmdArgs();
        let outputFile = tagFile;
        if (source.file && source.file.length > 0) {
            source.directory = path.dirname(source.file);
        }

        if (path.dirname(outputFile) === source.directory) {
            outputFile = path.basename(outputFile);
        }
        const outputDir = path.dirname(outputFile);
        if (!(await this.fs.directoryExists(outputDir))) {
            await this.fs.createDirectory(outputDir);
        }
        args.push('-o', outputFile, '.');
        this.output.appendLine(`${'-'.repeat(10)}Generating Tags${'-'.repeat(10)}`);
        this.output.appendLine(`${cmd} ${args.join(' ')}`);
        const promise = new Promise<void>(async (resolve, reject) => {
            try {
                const processService = await this.processServiceFactory.create();
                const result = processService.execObservable(cmd, args, { cwd: source.directory });
                let errorMsg = '';
                result.out.subscribe(
                    (output) => {
                        if (output.source === 'stderr') {
                            errorMsg += output.out;
                        }
                        this.output.append(output.out);
                    },
                    reject,
                    () => {
                        if (errorMsg.length > 0) {
                            reject(new Error(errorMsg));
                        } else {
                            resolve();
                        }
                    },
                );
            } catch (ex) {
                reject(ex);
            }
        });

        this.appShell.setStatusBarMessage('Generating Tags', promise);

        await promise;
    }
}

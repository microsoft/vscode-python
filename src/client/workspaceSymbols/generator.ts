import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';
import { IPythonSettings, PythonSettings } from '../common/configSettings';

export class Generator implements vscode.Disposable {
    private optionsFile: string;
    private disposables: vscode.Disposable[];
    private pythonSettings: IPythonSettings;
    public get tagFilePath(): string {
        return this.pythonSettings.workspaceSymbols.tagFilePath;
    }
    public get enabled(): boolean {
        return this.pythonSettings.workspaceSymbols.enabled;
    }
    constructor(public readonly workspaceFolder: vscode.Uri, private output: vscode.OutputChannel) {
        this.disposables = [];
        this.optionsFile = path.join(__dirname, '..', '..', '..', 'resources', 'ctagOptions');
        this.pythonSettings = PythonSettings.getInstance(workspaceFolder);
    }

    dispose() {
        this.disposables.forEach(d => d.dispose());
    }

    private buildCmdArgs(): string[] {
        const optionsFile = this.optionsFile.indexOf(' ') > 0 ? `"${this.optionsFile}"` : this.optionsFile;
        const exclusions = this.pythonSettings.workspaceSymbols.exclusionPatterns;
        const excludes = exclusions.length === 0 ? [] : exclusions.map(pattern => `--exclude=${pattern}`);

        return [`--options=${optionsFile}`, '--languages=Python'].concat(excludes);
    }

    async generateWorkspaceTags(): Promise<void> {
        if (!this.pythonSettings.workspaceSymbols.enabled) {
            return;
        }
        return await this.generateTags({ directory: this.workspaceFolder.fsPath });
    }

    private generateTags(source: { directory?: string, file?: string }): Promise<void> {
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
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }
        outputFile = outputFile.indexOf(' ') > 0 ? `"${outputFile}"` : outputFile;
        args.push(`-o ${outputFile}`, '.');
        this.output.appendLine('-'.repeat(10) + 'Generating Tags' + '-'.repeat(10));
        this.output.appendLine(`${cmd} ${args.join(' ')}`);
        const promise = new Promise<void>((resolve, reject) => {
            let options: child_process.SpawnOptions = {
                cwd: source.directory
            };

            let hasErrors = false;
            let errorMsg = '';
            const proc = child_process.spawn(cmd, args, options);
            proc.stderr.setEncoding('utf8');
            proc.stdout.setEncoding('utf8');
            proc.on('error', (error: Error) => {
                reject(error);
            });
            proc.stderr.on('data', (data: string) => {
                errorMsg += data;
                this.output.append(data);
            });
            proc.stdout.on('data', (data: string) => {
                this.output.append(data);
            });
            proc.on('exit', () => {
                if (hasErrors) {
                    reject(errorMsg);
                }
                else {
                    resolve();
                }
            });
        });

        vscode.window.setStatusBarMessage('Generating Tags', promise);

        return promise;
    }
}
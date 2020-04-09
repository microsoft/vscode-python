// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { Uri } from 'vscode';
import { traceError } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import { IInterpreterService, PythonInterpreter } from '../../interpreter/contracts';
import { captureTelemetry } from '../../telemetry';
import { Telemetry } from '../constants';
import { ILocalResourceUriConverter, INotebook } from '../types';
import { IWidgetScriptSourceProvider, WidgetScriptSource } from './types';

/**
 * Widget scripts are found in <python folder>/share/jupyter/nbextensions.
 * Here's an example:
 * <python folder>/share/jupyter/nbextensions/k3d/index.js
 * <python folder>/share/jupyter/nbextensions/nglview/index.js
 * <python folder>/share/jupyter/nbextensions/bqplot/index.js
 */
export class LocalWidgetScriptSourceProvider implements IWidgetScriptSourceProvider {
    private cachedWidgetScripts?: Promise<WidgetScriptSource[]>;
    constructor(
        private readonly notebook: INotebook,
        private readonly localResourceUriConverter: ILocalResourceUriConverter,
        private readonly fs: IFileSystem,
        private readonly interpreterService: IInterpreterService
    ) {}
    public async getWidgetScriptSource(moduleName: string): Promise<Readonly<WidgetScriptSource>> {
        const sources = await this.getWidgetScriptSources();
        const found = sources.find((item) => item.moduleName.toLowerCase() === moduleName.toLowerCase());
        return found || { moduleName };
    }
    public dispose() {
        // Noop.
    }
    public async getWidgetScriptSources(ignoreCache?: boolean): Promise<Readonly<WidgetScriptSource[]>> {
        if (!ignoreCache && this.cachedWidgetScripts) {
            return this.cachedWidgetScripts;
        }
        return (this.cachedWidgetScripts = this.getWidgetScriptSourcesWithoutCache());
    }
    @captureTelemetry(Telemetry.DiscoverIPyWidgetNamesLocalPerf)
    private async getWidgetScriptSourcesWithoutCache(): Promise<WidgetScriptSource[]> {
        const sysPrefix = await this.getSysPrefixOfKernel();
        if (!sysPrefix) {
            return [];
        }

        const nbextensionsPath = path.join(sysPrefix, 'share', 'jupyter', 'nbextensions');
        // Search only one level deep, hence `*/index.js`.
        const files = await this.fs.search(`*${path.sep}index.js`, nbextensionsPath);

        const validFiles = files.filter((file) => {
            // Should be of the form `<widget module>/index.js`
            const parts = file.split(path.sep);
            if (parts.length !== 2) {
                traceError('Incorrect file found when searching for nnbextension entrypoints');
                return false;
            }
            return true;
        });

        const mappedFiles = validFiles.map(async (file) => {
            // Should be of the form `<widget module>/index.js`
            const parts = file.split(path.sep);
            const moduleName = parts[0];

            // Drop the `.js`.
            const fileUri = Uri.file(path.join(nbextensionsPath, moduleName, 'index'));
            const scriptUri = (await this.localResourceUriConverter.asWebviewUri(fileUri)).toString();
            // tslint:disable-next-line: no-unnecessary-local-variable
            const widgetScriptSource: WidgetScriptSource = { moduleName, scriptUri, source: 'local' };
            return widgetScriptSource;
        });
        // tslint:disable-next-line: no-any
        return Promise.all(mappedFiles as any);
    }
    private async getSysPrefixOfKernel() {
        const interpreter = this.getInterpreter();
        if (interpreter?.sysPrefix) {
            return interpreter?.sysPrefix;
        }
        if (!interpreter?.path) {
            return;
        }
        const interpreterInfo = await this.interpreterService
            .getInterpreterDetails(interpreter.path)
            .catch(traceError.bind(`Failed to get interpreter details for Kernel/Interpreter ${interpreter.path}`));

        if (interpreterInfo) {
            return interpreterInfo?.sysPrefix;
        }
    }
    private getInterpreter(): Partial<PythonInterpreter> | undefined {
        let interpreter: undefined | Partial<PythonInterpreter> = this.notebook.getMatchingInterpreter();
        const kernel = this.notebook.getKernelSpec();
        interpreter = kernel?.metadata?.interpreter?.path ? kernel?.metadata?.interpreter : interpreter;

        // If we still do not have the interpreter, then check if we have the path to the kernel.
        if (!interpreter && kernel?.path) {
            interpreter = { path: kernel.path };
        }

        if (!interpreter || !interpreter.path) {
            return;
        }
        const pythonPath = interpreter.path;
        return { ...interpreter, path: pythonPath };
    }
}

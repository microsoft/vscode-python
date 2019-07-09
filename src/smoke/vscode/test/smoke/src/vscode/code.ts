/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as cp from 'child_process';
import * as os from 'os';
import * as fs from 'fs';
import { tmpName } from 'tmp';
import { IDriver, connect as connectDriver, IDisposable, IElement, Thenable } from './driver';
import { Logger } from '../logger';
import { ncp } from 'ncp';
import * as util from 'util';

const repoPath = path.join(__dirname, '../../../..');

function getDevElectronPath(): string {
    const buildPath = path.join(repoPath, '.build');
    const product = require(path.join(repoPath, 'product.json'));

    switch (process.platform) {
        case 'darwin':
            return path.join(buildPath, 'electron', `${product.nameLong}.app`, 'Contents', 'MacOS', 'Electron');
        case 'linux':
            return path.join(buildPath, 'electron', `${product.applicationName}`);
        case 'win32':
            return path.join(buildPath, 'electron', `${product.nameShort}.exe`);
        default:
            throw new Error('Unsupported platform.');
    }
}

function getBuildElectronPath(root: string): string {
    switch (process.platform) {
        case 'darwin':
            return path.join(root, 'Contents', 'MacOS', 'Electron');
        case 'linux': {
            const product = require(path.join(root, 'resources', 'app', 'product.json'));
            return path.join(root, product.applicationName);
        }
        case 'win32': {
            const product = require(path.join(root, 'resources', 'app', 'product.json'));
            return path.join(root, `${product.nameShort}.exe`);
        }
        default:
            throw new Error('Unsupported platform.');
    }
}

function getDevOutPath(): string {
    return path.join(repoPath, 'out');
}

function getBuildOutPath(root: string): string {
    switch (process.platform) {
        case 'darwin':
            return path.join(root, 'Contents', 'Resources', 'app', 'out');
        default:
            return path.join(root, 'resources', 'app', 'out');
    }
}

async function connect(child: cp.ChildProcess, outPath: string, handlePath: string, logger: Logger): Promise<Code> {
    let errCount = 0;

    while (true) {
        try {
            const { client, driver } = await connectDriver(outPath, handlePath);
            return new Code(client, driver, logger, child);
        } catch (err) {
            if (++errCount > 50) {
                child.kill();
                throw err;
            }

            // retry
            await new Promise(c => setTimeout(c, 100));
        }
    }
}

// Kill all running instances, when dead
const instances = new Set<cp.ChildProcess>();
process.once('exit', () => instances.forEach(code => code.kill()));

export interface SpawnOptions {
    codePath?: string;
    workspacePath: string;
    userDataDir: string;
    extensionsPath: string;
    logger: Logger;
    verbose?: boolean;
    extraArgs?: string[];
    log?: string;
    remote?: boolean;
    tempPath?: string;
}

async function createDriverHandle(dir?: string): Promise<string> {
    if ('win32' === os.platform()) {
        const name = [...Array(15)].map(() => Math.random().toString(36)[3]).join('');
        return `\\\\.\\pipe\\${name}`;
    } else {
        // Found that sometimes, `tmpName` returns a file that does not exist!
        // Just run all UI Tests, eventually this function will return a temp name without creating in disc.
        // Lets try creating the file in a directory or our choice (when using ui tests).
        return await new Promise<string>((c, e) => tmpName((err, handlePath) => err ? e(err) : c(handlePath)));
        // let tmpFile = await new Promise<string>((c, e) => tmpName({ dir }, (err, handlePath) => err ? e(err) : c(handlePath)));
        // if (fs.existsSync) {
        //     return tmpFile;
        // }
        // tmpFile = path.join(dir || __dirname, new Date().getTime().toString());
        // fs.writeFileSync(tmpFile, '');
        // return tmpFile;
    }
}

export async function spawn(options: SpawnOptions): Promise<Code> {
    const codePath = options.codePath;
    const electronPath = codePath ? getBuildElectronPath(codePath) : getDevElectronPath();
    const outPath = codePath ? getBuildOutPath(codePath) : getDevOutPath();
    const handle = await createDriverHandle(options.tempPath);

    const args = [
        ...(options.workspacePath ? [options.workspacePath] : []),
        '--skip-getting-started',
        '--skip-release-notes',
        '--sticky-quickopen',
        '--disable-telemetry',
        '--disable-updates',
        '--disable-crash-reporter',
        `--extensions-dir=${options.extensionsPath}`,
        `--user-data-dir=${options.userDataDir}`,
        '--driver', handle
    ];

    if (options.remote) {
        // Replace workspace path with URI
        args.shift();
        args.push(
            `--${options.workspacePath.endsWith('.code-workspace') ? 'file' : 'folder'}-uri`,
            `vscode-remote://test+test${options.workspacePath}`,
        );
        if (codePath) {
            // running against a build: copy the test resolver extension
            const testResolverExtPath = path.join(options.extensionsPath, 'vscode-test-resolver');
            if (!fs.existsSync(testResolverExtPath)) {
                const orig = path.join(repoPath, 'extensions', 'vscode-test-resolver');
                await new Promise((c, e) => ncp(orig, testResolverExtPath, err => err ? e(err) : c()));
            }
        }
        args.push('--enable-proposed-api=vscode.vscode-test-resolver');
    }

    if (!codePath) {
        args.unshift(repoPath);
    }

    if (options.verbose) {
        args.push('--driver-verbose');
    }

    if (options.log) {
        args.push('--log', options.log);
    }

    if (options.extraArgs) {
        args.push(...options.extraArgs);
    }

    const spawnOptions: cp.SpawnOptions = {};

    const child = cp.spawn(electronPath, args, spawnOptions);

    instances.add(child);
    child.once('exit', () => instances.delete(child));

    return connect(child, outPath, handle, options.logger);
}

async function poll<T>(
    fn: () => Thenable<T>,
    acceptFn: (result: T) => boolean,
    timeoutMessage: string,
    retryCount: number = 200,
    retryInterval: number = 100 // millis
): Promise<T> {
    let trial = 1;
    let lastError: string = '';

    while (true) {
        if (trial > retryCount) {
            // console.error('** Timeout!');
            // console.error(lastError);

            throw new Error(`Timeout: ${timeoutMessage} after ${(retryCount * retryInterval) / 1000} seconds. Error: ${lastError}`);
        }

        let result;
        try {
            result = await fn();

            if (acceptFn(result)) {
                return result;
            } else {
                lastError = 'Did not pass accept function';
            }
        } catch (e) {
            lastError = util.format(e);
        }

        await new Promise(resolve => setTimeout(resolve, retryInterval));
        trial++;
    }
}

type WaitOptions = { retryCount?: number; retryInterval?: number };

export class Code {

    private _activeWindowId: number | undefined = undefined;
    private driver: IDriver;

    constructor(
        private client: IDisposable,
        driver: IDriver,
        readonly logger: Logger,
        private readonly proc: cp.ChildProcess
    ) {
        this.driver = new Proxy(driver, {
            get(target, prop, receiver) {
                if (typeof prop === 'symbol') {
                    throw new Error('Invalid usage');
                }

                if (typeof target[prop] !== 'function') {
                    return target[prop];
                }

                return function (...args) {
                    logger.log(`${prop}`, ...args.filter(a => typeof a === 'string'));
                    return target[prop].apply(this, args);
                };
            }
        });
    }

    async capturePage(): Promise<string> {
        const windowId = await this.getActiveWindowId();
        return await this.driver.capturePage(windowId);
    }

    async waitForWindowIds(fn: (windowIds: number[]) => boolean, options: WaitOptions = {}): Promise<void> {
        await poll(() => this.driver.getWindowIds(), fn, `get window ids`, options.retryCount, options.retryInterval);
    }

    async dispatchKeybinding(keybinding: string): Promise<void> {
        const windowId = await this.getActiveWindowId();
        await this.driver.dispatchKeybinding(windowId, keybinding);
    }

    async reload(): Promise<void> {
        const windowId = await this.getActiveWindowId();
        await this.driver.reloadWindow(windowId);
    }

    async exit(): Promise<void> {
        try {
            await this.driver.exitApplication();
        } finally {
            try {
                this.proc.kill();
            } catch {
                // We don't care.
            }
        }
    }

    async waitForTextContent(selector: string, textContent?: string, accept?: (result: string) => boolean, options: WaitOptions = {}): Promise<string> {
        const windowId = await this.getActiveWindowId();
        accept = accept || (result => textContent !== undefined ? textContent === result : !!result);

        return await poll(
            () => this.driver.getElements(windowId, selector).then(els => els.length > 0 ? Promise.resolve(els[0].textContent) : Promise.reject(new Error('Element not found for textContent'))),
            s => accept!(typeof s === 'string' ? s : ''),
            `get text content '${selector}'`,
            options.retryCount, options.retryInterval
        );
    }

    async waitAndClick(selector: string, xoffset?: number, yoffset?: number): Promise<void> {
        const windowId = await this.getActiveWindowId();
        await poll(() => this.driver.click(windowId, selector, xoffset, yoffset), () => true, `click '${selector}'`);
    }

    async waitAndDoubleClick(selector: string, options: WaitOptions = {}): Promise<void> {
        const windowId = await this.getActiveWindowId();
        await poll(() => this.driver.doubleClick(windowId, selector), () => true, `double click '${selector}'`, options.retryCount, options.retryInterval);
    }

    async waitForSetValue(selector: string, value: string, options: WaitOptions = {}): Promise<void> {
        const windowId = await this.getActiveWindowId();
        await poll(() => this.driver.setValue(windowId, selector, value), () => true, `set value '${selector}'`, options.retryCount, options.retryInterval);
    }

    async waitForElements(selector: string, recursive: boolean, accept: (result: IElement[]) => boolean = result => result.length > 0, options: WaitOptions = {}): Promise<IElement[]> {
        const windowId = await this.getActiveWindowId();
        return await poll(() => this.driver.getElements(windowId, selector, recursive), accept, `get elements '${selector}'`, options.retryCount, options.retryInterval);
    }

    async waitForElement(selector: string, accept: (result: IElement | undefined) => boolean = result => !!result, retryCount: number = 200, retryInterval?: number): Promise<IElement> {
        const windowId = await this.getActiveWindowId();
        return await poll<IElement>(() => this.driver.getElements(windowId, selector).then(els => els[0]), accept, `get element '${selector}'`, retryCount, retryInterval);
    }

    async waitForElementToBeHidden(selector: string, accept: (result: IElement[]) => boolean = result => result.length === 0, retryCount: number = 200, retryInterval?: number): Promise<void> {
        const windowId = await this.getActiveWindowId();
        await poll(() => this.driver.getElements(windowId, selector), accept, `get element '${selector}'`, retryCount, retryInterval);
    }

    async waitForActiveElement(selector: string, retryCount: number = 200, retryInterval?: number): Promise<void> {
        const windowId = await this.getActiveWindowId();
        await poll(() => this.driver.isActiveElement(windowId, selector), r => r, `is active element '${selector}'`, retryCount, retryInterval);
    }

    async waitForTitle(fn: (title: string) => boolean, options: WaitOptions = {}): Promise<void> {
        const windowId = await this.getActiveWindowId();
        await poll(() => this.driver.getTitle(windowId), fn, `get title`, options.retryCount, options.retryInterval);
    }

    async waitForTypeInEditor(selector: string, text: string, options: WaitOptions = {}): Promise<void> {
        const windowId = await this.getActiveWindowId();
        await poll(() => this.driver.typeInEditor(windowId, selector, text), () => true, `type in editor '${selector}'`, options.retryCount, options.retryInterval);
    }

    async waitForTerminalBuffer(selector: string, accept: (result: string[]) => boolean, options: WaitOptions = {}): Promise<void> {
        const windowId = await this.getActiveWindowId();
        await poll(() => this.driver.getTerminalBuffer(windowId, selector), accept, `get terminal buffer '${selector}'`, options.retryCount, options.retryInterval);
    }

    async writeInTerminal(selector: string, value: string, options: WaitOptions = {}): Promise<void> {
        const windowId = await this.getActiveWindowId();
        await poll(() => this.driver.writeInTerminal(windowId, selector, value), () => true, `writeInTerminal '${selector}'`, options.retryCount, options.retryInterval);
    }

    private async getActiveWindowId(): Promise<number> {
        if (typeof this._activeWindowId !== 'number') {
            const windows = await this.driver.getWindowIds();
            this._activeWindowId = windows[0];
        }

        return this._activeWindowId;
    }

    dispose(): void {
        this.client.dispose();
    }
}

export function findElement(element: IElement, fn: (element: IElement) => boolean): IElement | null {
    const queue = [element];

    while (queue.length > 0) {
        const element = queue.shift()!;

        if (fn(element)) {
            return element;
        }

        queue.push(...element.children);
    }

    return null;
}

export function findElements(element: IElement, fn: (element: IElement) => boolean): IElement[] {
    const result: IElement[] = [];
    const queue = [element];

    while (queue.length > 0) {
        const element = queue.shift()!;

        if (fn(element)) {
            result.push(element);
        }

        queue.push(...element.children);
    }

    return result;
}

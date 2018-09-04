'use strict';
// tslint:disable: no-any one-line no-suspicious-comment prefer-template prefer-const no-unnecessary-callback-wrapper no-function-expression no-string-literal no-control-regex no-shadowed-variable

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { IRandom } from './types';

export const IS_WINDOWS = /^win/.test(process.platform);
export const Is_64Bit = os.arch() === 'x64';
export const PATH_VARIABLE_NAME = IS_WINDOWS ? 'Path' : 'PATH';

export function fsExistsAsync(filePath: string): Promise<boolean> {
    return new Promise<boolean>(resolve => {
        fs.exists(filePath, exists => {
            return resolve(exists);
        });
    });
}
export function fsReaddirAsync(root: string): Promise<string[]> {
    return new Promise<string[]>(resolve => {
        // Now look for Interpreters in this directory
        fs.readdir(root, (err, subDirs) => {
            if (err) {
                return resolve([]);
            }
            resolve(subDirs.map(subDir => path.join(root, subDir)));
        });
    });
}

export function formatErrorForLogging(error: Error | string): string {
    let message: string = '';
    if (typeof error === 'string') {
        message = error;
    }
    else {
        if (error.message) {
            message = `Error Message: ${error.message}`;
        }
        if (error.name && error.message.indexOf(error.name) === -1) {
            message += `, (${error.name})`;
        }
        const innerException = (error as any).innerException;
        if (innerException && (innerException.message || innerException.name)) {
            if (innerException.message) {
                message += `, Inner Error Message: ${innerException.message}`;
            }
            if (innerException.name && innerException.message.indexOf(innerException.name) === -1) {
                message += `, (${innerException.name})`;
            }
        }
    }
    return message;
}

export function getSubDirectories(rootDir: string): Promise<string[]> {
    return new Promise<string[]>(resolve => {
        fs.readdir(rootDir, (error, files) => {
            if (error) {
                return resolve([]);
            }
            const subDirs: string[] = [];
            files.forEach(name => {
                const fullPath = path.join(rootDir, name);
                try {
                    if (fs.statSync(fullPath).isDirectory()) {
                        subDirs.push(fullPath);
                    }
                }
                // tslint:disable-next-line:no-empty
                catch (ex) { }
            });
            resolve(subDirs);
        });
    });
}

export function arePathsSame(path1: string, path2: string) {
    path1 = path.normalize(path1);
    path2 = path.normalize(path2);
    if (IS_WINDOWS) {
        return path1.toUpperCase() === path2.toUpperCase();
    } else {
        return path1 === path2;
    }
}

function getRandom(): number {
    let num: number = 0;

    const buf: Buffer = crypto.randomBytes(2);
    num = (buf.readUInt8(0) << 8) + buf.readUInt8(1);

    const maxValue: number = Math.pow(16, 4) - 1;
    return (num / maxValue);
}

export function getRandomBetween(min: number = 0, max: number = 10): number {
    const randomVal: number = getRandom();
    return min + (randomVal * (max - min));
}

export class Random implements IRandom {

    public getRandomInt(min: number = 0, max: number = 10): number {
        return getRandomBetween(min, max);
    }
}

/**
 * Return [parent name, name] for the given qualified (dotted) name.
 *
 * Examples:
 *  'x.y'   -> ['x', 'y']
 *  'x'     -> ['', 'x']
 *  'x.y.z' -> ['x.y', 'z']
 *  ''      -> ['', '']
 */
export function splitParent(fullName: string): [string, string] {
    if (fullName.length === 0) {
        return ['', ''];
    }
    const pos = fullName.lastIndexOf('.');
    if (pos < 0) {
        return ['', fullName];
    }
    const parentName = fullName.slice(0, pos);
    const name = fullName.slice(pos + 1);
    return [parentName, name];
}

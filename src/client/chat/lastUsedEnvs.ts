// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { EnvironmentPath, PythonExtension } from '../api/types';
import { Uri } from 'vscode';

const MAX_TRACKED_URIS = 100; // Maximum number of environments to track
const MAX_TRACKED_AGE = 15 * 60 * 1000; // Maximum age of tracked environments in milliseconds (15 minutes)

type LastUsedEnvEntry = { uri: Uri | undefined; env: EnvironmentPath; dateTime: number };
const lastUsedEnvs: LastUsedEnvEntry[] = [];

/**
 * Track the use of an environment for a given resource (uri).
 * Prunes items older than 60 minutes or if the list grows over 100.
 */
export function trackEnvUsedByTool(uri: Uri | undefined, env: EnvironmentPath) {
    const now = Date.now();
    // Remove any previous entry for this uri
    for (let i = lastUsedEnvs.length - 1; i >= 0; i--) {
        if (urisEqual(lastUsedEnvs[i].uri, uri)) {
            lastUsedEnvs.splice(i, 1);
        }
    }
    // Add the new entry
    lastUsedEnvs.push({ uri, env, dateTime: now });
    // Prune
    pruneLastUsedEnvs();
}

/**
 * Get the last used environment for a given resource (uri), or undefined if not found or expired.
 */
export function getLastEnvUsedByTool(
    uri: Uri | undefined,
    api: PythonExtension['environments'],
): EnvironmentPath | undefined {
    pruneLastUsedEnvs();
    // Find the most recent entry for this uri that is not expired
    const item = lastUsedEnvs.find((item) => urisEqual(item.uri, uri));
    if (item) {
        return item.env;
    }
    const envPath = api.getActiveEnvironmentPath(uri);
    if (lastUsedEnvs.some((item) => item.env.id === envPath.id)) {
        // If this env was already used, return it
        return envPath;
    }
    return undefined;
}

/**
 * Compare two uris (or undefined) for equality.
 */
function urisEqual(a: Uri | undefined, b: Uri | undefined): boolean {
    if (a === b) {
        return true;
    }
    if (!a || !b) {
        return false;
    }
    return a.toString() === b.toString();
}

/**
 * Remove items older than 60 minutes or if the list grows over 100.
 */
function pruneLastUsedEnvs() {
    const now = Date.now();
    // Remove items older than 60 minutes
    for (let i = lastUsedEnvs.length - 1; i >= 0; i--) {
        if (now - lastUsedEnvs[i].dateTime > MAX_TRACKED_AGE) {
            lastUsedEnvs.splice(i, 1);
        }
    }
    // If still over 100, remove oldest
    if (lastUsedEnvs.length > MAX_TRACKED_URIS) {
        lastUsedEnvs.sort((a, b) => b.dateTime - a.dateTime);
        lastUsedEnvs.length = MAX_TRACKED_URIS;
    }
}

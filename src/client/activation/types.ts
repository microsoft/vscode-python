// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Request as RequestResult } from 'request';
import { SemVer } from 'semver';
import { Event } from 'vscode';
import { LanguageClient, LanguageClientOptions } from 'vscode-languageclient';
import { NugetPackage } from '../common/nuget/types';
import { IDisposable, LanguageServerDownloadChannels, Resource } from '../common/types';

export const IExtensionActivationService = Symbol('IExtensionActivationService');
export interface IExtensionActivationService {
    activate(): Promise<void>;
}

export enum ExtensionActivators {
    Jedi = 'Jedi',
    DotNet = 'DotNet'
}

export const IExtensionActivator = Symbol('IExtensionActivator');
export interface IExtensionActivator extends IDisposable {
    activate(): Promise<void>;
}

export const IHttpClient = Symbol('IHttpClient');
export interface IHttpClient {
    downloadFile(uri: string): Promise<RequestResult>;
    getJSON<T>(uri: string): Promise<T>;
}

export type FolderVersionPair = { path: string; version: SemVer };
export const ILanguageServerFolderService = Symbol('ILanguageServerFolderService');

export interface ILanguageServerFolderService {
    getLanguageServerFolderName(): Promise<string>;
    getLatestLanguageServerVersion(): Promise<NugetPackage | undefined>;
    getCurrentLanguageServerDirectory(): Promise<FolderVersionPair | undefined>;
}

export const ILanguageServerDownloader = Symbol('ILanguageServerDownloader');

export interface ILanguageServerDownloader {
    getDownloadInfo(): Promise<NugetPackage>;
    downloadLanguageServer(destinationFolder: string): Promise<void>;
}

export const ILanguageServerPackageService = Symbol('ILanguageServerPackageService');
export interface ILanguageServerPackageService {
    getNugetPackageName(): string;
    getLatestNugetPackageVersion(): Promise<NugetPackage>;
    getLanguageServerDownloadChannel(): LanguageServerDownloadChannels;
}

export const MajorLanguageServerVersion = Symbol('MajorLanguageServerVersion');
export const IDownloadChannelRule = Symbol('IDownloadChannelRule');
export interface IDownloadChannelRule {
    shouldLookForNewLanguageServer(currentFolder?: FolderVersionPair): Promise<boolean>;
}
export const ILanguageServerCompatibilityService = Symbol('ILanguageServerCompatibilityService');
export interface ILanguageServerCompatibilityService {
    isSupported(): Promise<boolean>;
}
export enum LanguageClientFactory {
    base = 'base',
    simple = 'simple',
    downloaded = 'downloaded'
}
export const ILanguageClientFactory = Symbol('ILanguageClientFactory');
export interface ILanguageClientFactory {
    createLanguageClient(resource: Resource, clientOptions: LanguageClientOptions): Promise<LanguageClient>;
}
export const ILanguageServerAnalysisOptions = Symbol('ILanguageServerAnalysisOptions');
export interface ILanguageServerAnalysisOptions extends IDisposable {
    readonly onDidChange: Event<void>;
    initialize(resource: Resource): Promise<void>;
    getAnalysisOptions(): Promise<LanguageClientOptions>;
}
export const ILanguageServerManager = Symbol('ILanguageServerManager');
export interface ILanguageServerManager extends IDisposable {
    start(resource: Resource): Promise<void>;
}
export const ILanaguageServer = Symbol('ILanaguageServer');
export interface ILanaguageServer extends IDisposable {
    start(resource: Resource, options: LanguageClientOptions): Promise<void>;
    /**
     * Sends a request to LS so as to load other extensions.
     * This is used as a plugin loader mechanism.
     * Anyone (such as intellicode) wanting to interact with LS, needs to send this request to LS.
     * @param {{}} [args]
     * @memberof ILanaguageServer
     */
    loadExtension(args?: {}): void;
}
export type InterpreterData = {
    readonly dataVersion: number;
    readonly path: string;
    readonly version: string;
    readonly searchPaths: string;
    readonly hash: string;
};

export const IInterpreterDataService = Symbol('InterpreterDataService');
export interface IInterpreterDataService {
    getInterpreterData(resource: Resource): Promise<InterpreterData | undefined>;
}

export enum PlatformName {
    Windows32Bit = 'win-x86',
    Windows64Bit = 'win-x64',
    Mac64Bit = 'osx-x64',
    Linux64Bit = 'linux-x64'
}
export const IPlatformData = Symbol('IPlatformData');
export interface IPlatformData {
    readonly platformName: PlatformName;
    readonly engineDllName: string;
    readonly engineExecutableName: string;
}

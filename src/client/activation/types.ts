// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Request as RequestResult } from 'request';
import { SemVer } from 'semver';
import { NugetPackage } from '../common/nuget/types';
import { IExtensionContext } from '../common/types';

export const IExtensionActivationService = Symbol('IExtensionActivationService');
export interface IExtensionActivationService {
  activate(): Promise<void>;
}

export enum ExtensionActivators {
  Jedi = 'Jedi',
  DotNet = 'DotNet'
}

export const IExtensionActivator = Symbol('IExtensionActivator');
export interface IExtensionActivator {
  activate(): Promise<boolean>;
  deactivate(): Promise<void>;
}

export const IHttpClient = Symbol('IHttpClient');
export interface IHttpClient {
  downloadFile(uri: string): RequestResult;
  getJSON<T>(uri: string): Promise<T>;
}

export type FolderVersionPair = { path: string; version: SemVer };
export const ILanguageServerFolderService = Symbol('ILanguageServerFolderService');

export interface ILanguageServerFolderService {
  getLanguageServerFolderName(): Promise<string>;
  getLatestLanguageServerVersion(): Promise<NugetPackage | undefined>;
  getcurrentLanguageServerDirectory(): Promise<FolderVersionPair | undefined>;
}

export const ILanguageServerDownloader = Symbol('ILanguageServerDownloader');

export interface ILanguageServerDownloader {
  getDownloadInfo(): Promise<NugetPackage>;
  downloadLanguageServer(context: IExtensionContext): Promise<void>;
}

export const ILanguageServerPackageService = Symbol('ILanguageServerPackageService');
export interface ILanguageServerPackageService {
  getNugetPackageName(): string;
  getLatestNugetPackageVersion(): Promise<NugetPackage>;
}

export const MajorLanguageServerVersion = Symbol('MajorLanguageServerVersion');

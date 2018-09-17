// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Request as RequestResult } from 'request';
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

export interface IDownloadFileService {
  downloadFile(uri: string): RequestResult;
}

export const ILanguageServerFolderService = Symbol('ILanguageServerFolderService');

export interface ILanguageServerFolderService {
  getLanguageServerFolder(): Promise<string>;
}

export const ILanguageServerDownloader = Symbol('ILanguageServerDownloader');

export interface ILanguageServerDownloader {
  getDownloadUri(): string;
  downloadLanguageServer(context: IExtensionContext): Promise<void>;
}

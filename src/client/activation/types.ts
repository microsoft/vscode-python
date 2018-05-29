// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

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

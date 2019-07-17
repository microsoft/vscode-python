import { Event } from 'vscode';
import { IPersistentState } from '../types';

export const IExtensionChannelRule = Symbol('IExtensionChannelRule');
export interface IExtensionChannelRule {
    /**
     * Return `true` if insiders build is required to be installed for the channel
     * @param isChannelRuleNew Carries boolean `true` if insiders channel just changed to this channel rule
     */
    shouldLookForInsidersBuild(isChannelRuleNew?: boolean): Promise<boolean>;
}

export const IExtensionChannelService = Symbol('IExtensionChannelService');
export interface IExtensionChannelService {
    readonly onDidChannelChange: Event<ExtensionChannels>;
    readonly isChannelUsingDefaultConfiguration: boolean;
    getChannel(): Promise<ExtensionChannels>;
    updateChannel(value: ExtensionChannels): Promise<void>;
}

export const IInsiderExtensionPrompt = Symbol('IInsiderExtensionPrompt');
export interface IInsiderExtensionPrompt {
    /**
     * Carries boolean `false` for the first session when user has not been notified.
     * Gets updated to `true` once user has been prompted to install insiders.
     */
    readonly hasUserBeenNotified: IPersistentState<boolean>;
    notifyToInstallInsiders(): Promise<void>;
    promptToReload(): Promise<void>;
}

/**
 * Note the values in this enum must belong to `ExtensionChannels` type
 */
export enum ExtensionChannel {
    default = 'default',
    weekly = 'weekly',
    daily = 'daily'
}
export type ExtensionChannels = 'default' | 'weekly' | 'daily';

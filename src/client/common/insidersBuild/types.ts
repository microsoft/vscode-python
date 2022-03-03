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
    getChannel(): ExtensionChannels;
    updateChannel(value: ExtensionChannels): Promise<void>;
}

export const IInsiderExtensionPrompt = Symbol('IInsiderExtensionPrompt');
export interface IInsiderExtensionPrompt {
    /**
     * Carries boolean `false` for the first session when user has not been notified.
     * Gets updated to `true` once user has been prompted to install insiders.
     */
    readonly hasUserBeenNotified: IPersistentState<boolean>;
    promptToInstallInsiders(): Promise<void>;
    promptToReload(): Promise<void>;
}

/**
 * Note the values in this enum must belong to `ExtensionChannels` type
 */
export enum ExtensionChannel {
    /**
     * "off" setting is defined as a no op, which means user keeps using the extension they are using
     */
    off = 'off',
    weekly = 'weekly',
    daily = 'daily',
}
export type ExtensionChannels = 'off' | 'weekly' | 'daily';

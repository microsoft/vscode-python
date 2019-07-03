import { Event } from 'vscode';
import { IExtensionBuildInstaller } from '../installer/types';

export const IExtensionChannelRule = Symbol('IExtensionChannelRule');
export interface IExtensionChannelRule {
    /**
     * Returns the installer corresponding to an extension channel (`Stable`, `InsidersWeekly`, etc...).
     * Return value is `undefined` when no extension build is required to be installed for the channel.
     * @param isChannelRuleNew Carries boolean `true` if insiders channel just changed to this channel rule
     */
    getInstaller(isChannelRuleNew?: boolean): Promise<IExtensionBuildInstaller | undefined>;
}

export const IExtensionChannelService = Symbol('IExtensionChannelService');
export interface IExtensionChannelService {
    readonly onDidChannelChange: Event<ExtensionChannels>;
    readonly channel: ExtensionChannels;
    updateChannel(value: ExtensionChannels): Promise<void>;
}

export const IInsiderExtensionPrompt = Symbol('IInsiderExtensionPrompt');
export interface IInsiderExtensionPrompt {
    notifyToInstallInsider(): Promise<void>;
    promptToReload(): Promise<void>;
}

/**
 * Note the values in this enum must belong to `ExtensionChannels` type
 */
export enum ExtensionChannel {
    stable = 'Stable',
    weekly = 'InsidersWeekly',
    daily = 'InsidersDaily',
    defaultForInsiders = 'InsidersWeekly'
}
export type ExtensionChannels = 'Stable' | 'InsidersWeekly' | 'InsidersDaily';

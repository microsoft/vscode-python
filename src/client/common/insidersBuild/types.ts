import { Event } from 'vscode';
import { IExtensionBuildInstaller } from '../installer/types';
import { IPersistentState } from '../types';

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
    stable = 'Stable',
    weekly = 'InsidersWeekly',
    daily = 'InsidersDaily',
    /**
     * The default value for insiders for the first session. The default value is `Stable` from the second session onwards
     */
    insidersDefaultForTheFirstSession = 'InsidersWeekly'
}
export type ExtensionChannels = 'Stable' | 'InsidersWeekly' | 'InsidersDaily';

import { Event } from 'vscode';
import { IExtensionBuildInstaller } from '../installer/types';

export const IExtensionChannelRule = Symbol('IExtensionChannelRule');
export interface IExtensionChannelRule {
    /**
     * Returns the installer used to install the extension corresponding to a channel (`stableInstaller` for `Stable`, `insidersInstaller` for `InsidersWeekly`, etc...),
     * returns `undefined` when no installer is needed for the channel rule.
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

export enum ExtensionChannel {
    stable = 'Stable',
    weekly = 'InsidersWeekly',
    daily = 'InsidersDaily'
}
export type ExtensionChannels = 'Stable' | 'InsidersWeekly' | 'InsidersDaily';

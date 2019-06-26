export const IInsidersDownloadChannelRule = Symbol('IInsidersDownloadChannelRule');
export interface IInsidersDownloadChannelRule {
    shouldLookForInsidersBuild(): Promise<boolean>;
}

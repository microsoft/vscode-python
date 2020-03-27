import { OSType } from '../../client/common/utils/platform';

// Javascript keyCodes
export const KeyCodes = {
    LeftArrow: 37,
    UpArrow: 38,
    RightArrow: 39,
    DownArrow: 40,
    PageUp: 33,
    PageDown: 34,
    End: 35,
    Home: 36,
};

export function getOSType() {
    if (window.navigator.platform.startsWith('Mac')) {
        return OSType.OSX;
    } else if (window.navigator.platform.startsWith('Win')) {
        return OSType.Windows;
    } else if (window.navigator.userAgent.indexOf('Linux') > 0) {
        return OSType.Linux;
    } else {
        return OSType.Unknown;
    }
}

export const UseCustomEditor = { enabled: true };

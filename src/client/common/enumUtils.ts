// tslint:disable:no-any no-unnecessary-class
export class EnumEx {
    public static getNamesAndValues<T>(e: any): { name: string; value: T }[] {
        return EnumEx.getNames(e).map(n => ({ name: n, value: e[n] }));
    }

    public static getNames(e: any) {
        return EnumEx.getObjValues(e).filter(v => typeof v === 'string') as string[];
    }

    public static getValues<T>(e: any) {
        return EnumEx.getObjValues(e).filter(v => typeof v === 'number') as any as T[];
    }

    private static getObjValues(e: any): (number | string)[] {
        return Object.keys(e).map(k => e[k]);
    }
}

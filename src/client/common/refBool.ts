export class RefBool {
    constructor(private val: boolean) {}

    public get value(): boolean {
        return this.val;
    }

    public update(newVal: boolean) {
        this.val = newVal;
    }
}

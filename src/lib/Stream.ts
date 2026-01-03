export class Stream {
    /**
     * Stores code points (not UTF-16 code units) to correctly support
     * multi-byte characters such as emoji or non-Latin scripts.
     */
    private readonly buffer: number[];

    private position: number = -1;

    public constructor(str: string) {
        this.buffer = Array.from(str, (char) => char.codePointAt(0)!);
    }

    public peek(): number {
        return this.position;
    }

    public async next(): Promise<boolean> {
        if (this.buffer.length === 0) {
            this.position = -1;
            return false;
        }

        this.position = this.buffer.shift()!;
        return true;
    }
}

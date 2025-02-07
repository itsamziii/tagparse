import { Readable } from "node:stream";

export class Stream extends Readable {
    private buffer: string[] = [];

    private position: number = -1;

    public constructor(str: string) {
        super();
        this.push(str);
        this.push(null);
    }

    public override _read(size: number) {
        // No-op since we handle the push in the constructor
    }

    public peek(): number {
        return this.position;
    }

    public async next(): Promise<boolean> {
        if (this.buffer.length === 0) {
            const chunk = await this.readChunk();
            if (!chunk) {
                return false;
            }

            this.buffer.push(...chunk);
        }

        this.position = Number(this.buffer.shift()!);
        return true;
    }

    private async readChunk(): Promise<string | null> {
        return new Promise((resolve) => {
            const chunk = this.read();
            if (chunk === null) {
                this.once("readable", () => resolve(this.read()));
            } else {
                resolve(chunk);
            }
        });
    }
}

import type { Node } from "../../../types.js";

export abstract class TagParser {
    public abstract parse(...args: unknown[]): Promise<Node>;
}

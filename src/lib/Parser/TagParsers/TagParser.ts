import type { Node } from "../../../types.js";

/**
 * Base class for tag parsers.
 * Sync in v2.
 */
export abstract class TagParser {
    public abstract parse(...args: unknown[]): Node;
}

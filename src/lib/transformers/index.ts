import { NodeType, type Node, type TextNode } from "../../types.js";
import { createTransformer, type Transformer } from "../Transformer.js";

/**
 * Apply merge-adjacent-text logic to an array of nodes (post-processing)
 */
export function mergeAdjacentTextNodes(nodes: Node[]): Node[] {
    const result: Node[] = [];

    for (const node of nodes) {
        const lastNode = result.at(-1);

        if (
            node.type === NodeType.Text &&
            lastNode?.type === NodeType.Text
        ) {
            // Merge with previous text node
            (lastNode as TextNode).value += (node as TextNode).value;
        } else {
            result.push(node);
        }
    }

    return result;
}

/**
 * Remove empty text nodes (nodes with empty string value)
 */
export const removeEmptyText: Transformer = createTransformer(
    "removeEmptyText",
    (node) => {
        if (node.type === NodeType.Text) {
            const textNode = node as TextNode;
            if (textNode.value === "") {
                return null; // Remove
            }
        }
        return node;
    },
);

/**
 * Remove whitespace-only text nodes
 */
export const removeWhitespaceText: Transformer = createTransformer(
    "removeWhitespaceText",
    (node) => {
        if (node.type === NodeType.Text) {
            const textNode = node as TextNode;
            if (textNode.value.trim() === "") {
                return null; // Remove
            }
        }
        return node;
    },
);

/**
 * Trim whitespace from text nodes
 */
export const trimTextNodes: Transformer = createTransformer(
    "trimTextNodes",
    (node) => {
        if (node.type === NodeType.Text) {
            const textNode = node as TextNode;
            return {
                ...textNode,
                value: textNode.value.trim(),
            };
        }
        return node;
    },
);

/**
 * Normalize whitespace in text nodes (collapse multiple spaces to single space)
 */
export const normalizeWhitespace: Transformer = createTransformer(
    "normalizeWhitespace",
    (node) => {
        if (node.type === NodeType.Text) {
            const textNode = node as TextNode;
            return {
                ...textNode,
                value: textNode.value.replace(/\s+/g, " "),
            };
        }
        return node;
    },
);

/**
 * Convert variable nodes to text nodes using a resolver function
 */
export function createVariableResolver(
    resolver: (name: string) => string | undefined,
): Transformer {
    return createTransformer("variableResolver", (node) => {
        if (node.type === NodeType.Variable) {
            const value = resolver(node.raw);
            if (value !== undefined) {
                return {
                    type: NodeType.Text,
                    value,
                } as TextNode;
            }
        }
        return node;
    });
}

/**
 * Filter nodes by type (keep only specified types)
 */
export function filterByType(...types: string[]): Transformer {
    const typeSet = new Set(types);
    return createTransformer("filterByType", (node) => {
        return typeSet.has(node.type) ? node : null;
    });
}

/**
 * Map node values using a mapper function
 */
export function mapNodes(
    mapper: (node: Node) => Node | null,
): Transformer {
    return createTransformer("mapNodes", mapper);
}

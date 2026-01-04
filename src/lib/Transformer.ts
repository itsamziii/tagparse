import {
    NodeType,
    type ArgumentNode,
    type FunctionNode,
    type Node,
} from "../types.js";

/**
 * Context provided to transformers during transformation
 */
export type TransformContext = {
    /**
     * Ancestor nodes from root to parent
     */
    ancestors: Node[];

    /**
     * Depth in the tree (0 = root level)
     */
    depth: number;

    /**
     * Index of current node in parent's children
     */
    index: number;

    /**
     * Parent node (if any)
     */
    parent?: Node;
};

/**
 * Transformer interface for modifying AST nodes
 */
export type Transformer = {
    /**
     * Name of this transformer (for debugging)
     */
    name: string;

    /**
     * Transform a single node.
     *
     * @param node - The node to transform
     * @param context - Transformation context
     * @returns
     *   - The same node (unmodified)
     *   - A new/modified node
     *   - An array of nodes (to replace one node with many)
     *   - null to remove the node
     */
    transform(node: Node, context: TransformContext): Node | Node[] | null;
};

/**
 * Apply transformers to an array of nodes
 *
 * @param nodes - Input nodes
 * @param transformers - Array of transformers to apply in order
 * @returns Transformed nodes
 */
export function transform(nodes: Node[], transformers: Transformer[]): Node[] {
    let result = nodes;

    for (const transformer of transformers) {
        result = transformNodes(result, transformer, [], 0);
    }

    return result;
}

/**
 * Internal recursive transformation function
 */
function transformNodes(
    nodes: Node[],
    transformer: Transformer,
    ancestors: Node[],
    depth: number,
): Node[] {
    const result: Node[] = [];

    for (const [idx, node_] of nodes.entries()) {
        const node = node_!;
        const context: TransformContext = {
            parent: ancestors.at(-1),
            index: idx,
            ancestors: [...ancestors],
            depth,
        };

        // First, recursively transform children
        const transformedNode = transformChildren(
            node,
            transformer,
            ancestors,
            depth,
        );

        // Then apply the transformer to this node
        const transformed = transformer.transform(transformedNode, context);

        if (transformed === null) {
            // Node removed
            continue;
        } else if (Array.isArray(transformed)) {
            // Node replaced with multiple nodes
            result.push(...transformed);
        } else {
            // Node replaced or unchanged
            result.push(transformed);
        }
    }

    return result;
}

/**
 * Transform children of a node
 */
function transformChildren(
    node: Node,
    transformer: Transformer,
    ancestors: Node[],
    depth: number,
): Node {
    // Handle function nodes with arguments
    if (node.type === NodeType.Function) {
        const funcNode = node as FunctionNode;
        const newAncestors = [...ancestors, node];

        const transformedArgs = funcNode.args.map((arg) => {
            const transformedArgNodes = transformNodes(
                arg.nodes,
                transformer,
                newAncestors,
                depth + 1,
            );
            return {
                ...arg,
                nodes: transformedArgNodes,
            } as ArgumentNode;
        });

        return {
            ...funcNode,
            args: transformedArgs,
        };
    }

    // Handle argument nodes
    if (node.type === NodeType.Argument) {
        const argNode = node as ArgumentNode;
        const newAncestors = [...ancestors, node];

        const transformedNodes = transformNodes(
            argNode.nodes,
            transformer,
            newAncestors,
            depth + 1,
        );

        return {
            ...argNode,
            nodes: transformedNodes,
        };
    }

    return node;
}

/**
 * Create a transformer from a simple function
 */
export function createTransformer(
    name: string,
    fn: (node: Node, context: TransformContext) => Node | Node[] | null,
): Transformer {
    return { name, transform: fn };
}

/**
 * Compose multiple transformers into one
 */
export function composeTransformers(
    name: string,
    ...transformers: Transformer[]
): Transformer {
    return {
        name,
        transform(node, context) {
            let result: Node | Node[] | null = node;

            for (const transformer of transformers) {
                if (result === null) {
                    return null;
                }

                if (Array.isArray(result)) {
                    // Apply transformer to each node in array
                    const newResult: Node[] = [];
                    for (const [idx, element] of result.entries()) {
                        const transformed = transformer.transform(element!, {
                            ...context,
                            index: idx,
                        });
                        if (transformed === null) {
                            continue;
                        } else if (Array.isArray(transformed)) {
                            newResult.push(...transformed);
                        } else {
                            newResult.push(transformed);
                        }
                    }

                    result = newResult.length > 0 ? newResult : null;
                } else {
                    result = transformer.transform(result, context);
                }
            }

            return result;
        },
    };
}

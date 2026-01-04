import {
    NodeType,
    type ArgumentNode,
    type FunctionNode,
    type Node,
    type TextNode,
    type VariableNode,
} from "../types.js";

/**
 * Context provided to visitors during traversal
 */
export type VisitContext = {
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

    /**
     * Skip children of current node
     */
    skipChildren(): void;

    /**
     * Stop traversal of remaining siblings
     */
    stop(): void;
};

/**
 * Visitor interface for traversing AST nodes
 */
export type Visitor = {
    /**
     * Called when entering a node (before visiting)
     */
    enter?(node: Node, context: VisitContext): void;

    /**
     * Called when leaving a node (after visiting and children)
     */
    leave?(node: Node, context: VisitContext): void;

    /**
     * Called for any node type (fallback)
     */
    visit?(node: Node, context: VisitContext): void;

    /**
     * Called for Argument nodes
     */
    visitArgument?(node: ArgumentNode, context: VisitContext): void;

    /**
     * Called for Function nodes
     */
    visitFunction?(node: FunctionNode, context: VisitContext): void;

    /**
     * Called for Text nodes
     */
    visitText?(node: TextNode, context: VisitContext): void;

    /**
     * Called for Variable nodes
     */
    visitVariable?(node: VariableNode, context: VisitContext): void;
};

/**
 * Internal state for traversal control
 */
type TraversalState = {
    skipChildren: boolean;
    stopped: boolean;
};

/**
 * Walk through AST nodes, calling visitor methods.
 * Only visits top-level nodes (not children of function arguments).
 *
 * @param nodes - Nodes to visit
 * @param visitor - Visitor with callback methods
 */
export function walk(nodes: Node[], visitor: Visitor): void {
    const state: TraversalState = { stopped: false, skipChildren: false };
    walkNodes(nodes, visitor, [], 0, state);
}

/**
 * Walk through AST nodes deeply, including children of function arguments.
 *
 * @param nodes - Nodes to visit
 * @param visitor - Visitor with callback methods
 */
export function walkDeep(nodes: Node[], visitor: Visitor): void {
    const state: TraversalState = { stopped: false, skipChildren: false };
    walkNodesDeep(nodes, visitor, [], 0, state);
}

/**
 * Internal shallow walk function
 */
function walkNodes(
    nodes: Node[],
    visitor: Visitor,
    ancestors: Node[],
    depth: number,
    state: TraversalState,
): void {
    for (const [index, node_] of nodes.entries()) {
        if (state.stopped) break;

        const node = node_!;
        state.skipChildren = false;

        const context = createContext(ancestors, index, depth, state);

        // Call enter
        visitor.enter?.(node, context);
        if (state.stopped) break;

        // Call type-specific visitor
        visitNode(node, visitor, context);
        if (state.stopped) break;

        // Call leave
        visitor.leave?.(node, context);
    }
}

/**
 * Internal deep walk function
 */
function walkNodesDeep(
    nodes: Node[],
    visitor: Visitor,
    ancestors: Node[],
    depth: number,
    state: TraversalState,
): void {
    for (const [index, node_] of nodes.entries()) {
        if (state.stopped) break;

        const node = node_!;
        state.skipChildren = false;

        const context = createContext(ancestors, index, depth, state);

        // Call enter
        visitor.enter?.(node, context);
        if (state.stopped) break;

        // Call type-specific visitor
        visitNode(node, visitor, context);
        if (state.stopped) break;

        // Visit children if not skipped
        if (!state.skipChildren) {
            visitChildren(node, visitor, ancestors, depth, state);
        }

        // Call leave
        visitor.leave?.(node, context);
    }
}

/**
 * Create visit context
 */
function createContext(
    ancestors: Node[],
    index: number,
    depth: number,
    state: TraversalState,
): VisitContext {
    return {
        parent: ancestors.at(-1),
        index,
        ancestors: [...ancestors],
        depth,
        stop: () => {
            state.stopped = true;
        },
        skipChildren: () => {
            state.skipChildren = true;
        },
    };
}

/**
 * Call appropriate visitor method for node type
 */
function visitNode(node: Node, visitor: Visitor, context: VisitContext): void {
    switch (node.type) {
        case NodeType.Text:
            visitor.visitText?.(node as TextNode, context);
            break;
        case NodeType.Variable:
            visitor.visitVariable?.(node as VariableNode, context);
            break;
        case NodeType.Function:
            visitor.visitFunction?.(node as FunctionNode, context);
            break;
        case NodeType.Argument:
            visitor.visitArgument?.(node as ArgumentNode, context);
            break;
        default:
            // Custom node type - use generic visit
            visitor.visit?.(node, context);
    }
}

/**
 * Visit children of a node (for deep walk)
 */
function visitChildren(
    node: Node,
    visitor: Visitor,
    ancestors: Node[],
    depth: number,
    state: TraversalState,
): void {
    const newAncestors = [...ancestors, node];

    if (node.type === NodeType.Function) {
        const funcNode = node as FunctionNode;
        for (const arg of funcNode.args) {
            if (state.stopped) break;

            // Visit the argument node itself
            const argContext = createContext(newAncestors, 0, depth + 1, state);
            visitor.enter?.(arg, argContext);
            if (state.stopped) break;

            visitor.visitArgument?.(arg, argContext);
            if (state.stopped) break;

            // Visit argument's children
            if (!state.skipChildren) {
                walkNodesDeep(
                    arg.nodes,
                    visitor,
                    [...newAncestors, arg],
                    depth + 2,
                    state,
                );
            }

            visitor.leave?.(arg, argContext);
        }
    }
}

/**
 * Create a visitor from callback functions
 */
export function createVisitor(callbacks: Partial<Visitor>): Visitor {
    return { ...callbacks };
}

/**
 * Count nodes in an AST
 */
export function countNodes(nodes: Node[]): number {
    let count = 0;
    walkDeep(nodes, {
        enter() {
            count++;
        },
    });
    return count;
}

/**
 * Find all nodes matching a predicate
 */
export function findNodes(
    nodes: Node[],
    predicate: (node: Node) => boolean,
): Node[] {
    const result: Node[] = [];
    walkDeep(nodes, {
        enter(node) {
            if (predicate(node)) {
                result.push(node);
            }
        },
    });
    return result;
}

/**
 * Find first node matching a predicate
 */
export function findNode(
    nodes: Node[],
    predicate: (node: Node) => boolean,
): Node | undefined {
    let found: Node | undefined;
    walkDeep(nodes, {
        enter(node, context) {
            if (predicate(node)) {
                found = node;
                context.stop();
            }
        },
    });
    return found;
}

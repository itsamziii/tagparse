import type {
    ArgumentNode,
    TagNode,
    TemplateNode,
    TextNode,
    VariableNode,
} from "../../types.js";
import { NodeKind } from "../../types.js";

export interface VisitContext {
    readonly parent: TemplateNode | ArgumentNode | null;
    readonly depth: number;
    readonly index: number;
}

export interface Visitor {
    enter?(
        node: TemplateNode | ArgumentNode,
        ctx: VisitContext,
    ): undefined | "skip" | "stop";
    leave?(node: TemplateNode | ArgumentNode, ctx: VisitContext): void;
    visitText?(node: TextNode, ctx: VisitContext): void;
    visitVariable?(node: VariableNode, ctx: VisitContext): void;
    visitTag?(node: TagNode, ctx: VisitContext): void;
    visitArgument?(node: ArgumentNode, ctx: VisitContext): void;
}

/**
 * Walk a node tree depth-first, calling visitor methods. Returning "skip"
 * from `enter` skips children; "stop" aborts the entire traversal.
 */
export function walk(nodes: readonly TemplateNode[], visitor: Visitor): void {
    const state = { stopped: false };
    walkInner(nodes, visitor, null, 0, state);
}

function walkInner(
    nodes: readonly TemplateNode[],
    visitor: Visitor,
    parent: TemplateNode | ArgumentNode | null,
    depth: number,
    state: { stopped: boolean },
): void {
    for (let i = 0; i < nodes.length; i++) {
        if (state.stopped) return;
        const node = nodes[i];
        if (!node) continue;
        const ctx: VisitContext = { parent, depth, index: i };
        const enterResult = visitor.enter?.(node, ctx);
        if (enterResult === "stop") {
            state.stopped = true;
            return;
        }
        if (enterResult !== "skip") {
            switch (node.kind) {
                case NodeKind.Text:
                    visitor.visitText?.(node, ctx);
                    break;
                case NodeKind.Variable:
                    visitor.visitVariable?.(node, ctx);
                    break;
                case NodeKind.Tag:
                    visitor.visitTag?.(node, ctx);
                    for (let j = 0; j < node.args.length; j++) {
                        if (state.stopped) return;
                        const arg = node.args[j];
                        if (!arg) continue;
                        const argCtx: VisitContext = {
                            parent: node,
                            depth: depth + 1,
                            index: j,
                        };
                        const argEnter = visitor.enter?.(arg, argCtx);
                        if (argEnter === "stop") {
                            state.stopped = true;
                            return;
                        }
                        if (argEnter !== "skip") {
                            visitor.visitArgument?.(arg, argCtx);
                            walkInner(
                                arg.nodes,
                                visitor,
                                arg,
                                depth + 2,
                                state,
                            );
                        }
                        visitor.leave?.(arg, argCtx);
                    }
                    break;
            }
        }
        visitor.leave?.(node, ctx);
    }
}

export function findNodes(
    nodes: readonly TemplateNode[],
    predicate: (n: TemplateNode) => boolean,
): TemplateNode[] {
    const found: TemplateNode[] = [];
    walk(nodes, {
        enter(node) {
            if ("kind" in node && node.kind !== NodeKind.Argument) {
                if (predicate(node as TemplateNode))
                    found.push(node as TemplateNode);
            }
            return undefined;
        },
    });
    return found;
}

/**
 * Collect the set of variable names referenced anywhere in the template.
 * Useful for pre-flight validation: "is this template using a variable I
 * haven't provided?"
 */
export function collectVariableNames(
    nodes: readonly TemplateNode[],
): Set<string> {
    const names = new Set<string>();
    walk(nodes, {
        visitVariable(n) {
            names.add(n.name);
        },
    });
    return names;
}

/**
 * Collect tag names. Useful for: "does this template only use the tags I've registered?"
 */
export function collectTagNames(nodes: readonly TemplateNode[]): Set<string> {
    const names = new Set<string>();
    walk(nodes, {
        visitTag(n) {
            names.add(n.name);
        },
    });
    return names;
}

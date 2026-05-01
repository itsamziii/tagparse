import type {
    ArgumentNode,
    AsyncTagHandler,
    AsyncVariableResolver,
    CompiledTemplate,
    RenderContext,
    TagHandler,
    TagNode,
    TemplateNode,
    VariableResolver,
} from "../../types.js";
import { type Awaitable, NodeKind } from "../../types.js";
import { RenderError } from "../errors/Errors.js";
import {
    type AnyTagHandler,
    isStructural,
    type StructuralTagHandler,
    stringify,
    withLocals,
} from "./Render.js";

const MAX_RENDER_DEPTH = 64;

export interface AsyncStructuralTagHandler<Ctx = unknown> {
    readonly structural: true;
    handle(
        args: readonly ArgumentNode[],
        ctx: RenderContext<Ctx>,
        render: (
            arg: ArgumentNode,
            withLocals?: Record<string, unknown>,
        ) => Promise<string>,
    ): Awaitable<string | number | boolean | null | undefined>;
}

export type AnyAsyncTagHandler<Ctx = unknown> =
    | AsyncTagHandler<Ctx>
    | AsyncStructuralTagHandler<Ctx>
    | StructuralTagHandler<Ctx>
    | TagHandler<Ctx>;

function isAsyncStructural<Ctx>(
    h: AnyAsyncTagHandler<Ctx>,
): h is AsyncStructuralTagHandler<Ctx> {
    return (
        typeof h === "object" &&
        h !== null &&
        (h as AsyncStructuralTagHandler<Ctx>).structural === true
    );
}

export interface RenderAsyncOptions<Ctx = unknown> {
    readonly data?: Ctx;
    readonly variables?:
        | AsyncVariableResolver<Ctx>
        | VariableResolver<Ctx>
        | Record<string, unknown>;
    readonly tags?: Readonly<
        Record<string, AnyAsyncTagHandler<Ctx> | AnyTagHandler<Ctx>>
    >;
    readonly onMissingVariable?: (
        name: string,
        ctx: RenderContext<Ctx>,
    ) => string | undefined;
    readonly onMissingTag?: (
        name: string,
        args: readonly string[],
        ctx: RenderContext<Ctx>,
    ) => string | undefined;
}

export async function renderAsync<Ctx = unknown>(
    template: CompiledTemplate,
    options: RenderAsyncOptions<Ctx> = {},
): Promise<string> {
    const data = (options.data ?? ({} as Ctx)) as Ctx;
    const resolver = normalizeResolverAsync(options.variables);
    const tags = options.tags ?? {};
    const ctx: RenderContext<Ctx> = { data, locals: new Map(), depth: 0 };
    return renderNodesAsync(template.nodes, ctx, resolver, tags, options);
}

async function renderNodesAsync<Ctx>(
    nodes: readonly TemplateNode[],
    ctx: RenderContext<Ctx>,
    resolver: AsyncVariableResolver<Ctx> | undefined,
    tags: Readonly<
        Record<string, AnyAsyncTagHandler<Ctx> | AnyTagHandler<Ctx>>
    >,
    options: RenderAsyncOptions<Ctx>,
): Promise<string> {
    if (ctx.depth > MAX_RENDER_DEPTH) {
        throw new RenderError(`Render depth exceeded ${MAX_RENDER_DEPTH}`);
    }
    // Sequential by design: tags may share state (e.g. assignment patterns) and
    // ordering matters for side effects. Users who want parallelism should
    // structure their work above the renderer.
    const parts: string[] = [];
    for (const node of nodes) {
        parts.push(await renderNodeAsync(node, ctx, resolver, tags, options));
    }
    return parts.join("");
}

async function renderNodeAsync<Ctx>(
    node: TemplateNode,
    ctx: RenderContext<Ctx>,
    resolver: AsyncVariableResolver<Ctx> | undefined,
    tags: Readonly<
        Record<string, AnyAsyncTagHandler<Ctx> | AnyTagHandler<Ctx>>
    >,
    options: RenderAsyncOptions<Ctx>,
): Promise<string> {
    switch (node.kind) {
        case NodeKind.Text:
            return node.value;
        case NodeKind.Variable: {
            const fromLocals = ctx.locals.get(node.name);
            if (fromLocals !== undefined) return stringify(fromLocals);
            if (resolver) {
                const v = await resolver(node.name, ctx);
                if (v !== undefined && v !== null) return stringify(v);
            }
            return options.onMissingVariable?.(node.name, ctx) ?? "";
        }
        case NodeKind.Tag:
            return renderTagAsync(node, ctx, resolver, tags, options);
    }
}

async function renderTagAsync<Ctx>(
    node: TagNode,
    ctx: RenderContext<Ctx>,
    resolver: AsyncVariableResolver<Ctx> | undefined,
    tags: Readonly<
        Record<string, AnyAsyncTagHandler<Ctx> | AnyTagHandler<Ctx>>
    >,
    options: RenderAsyncOptions<Ctx>,
): Promise<string> {
    const handler = tags[node.name];
    if (!handler) {
        const evaledArgs: string[] = [];
        for (const a of node.args)
            evaledArgs.push(
                await renderArgAsync(a, ctx, resolver, tags, options),
            );
        return options.onMissingTag?.(node.name, evaledArgs, ctx) ?? "";
    }

    try {
        if (
            isAsyncStructural(handler) ||
            isStructural(handler as AnyTagHandler<Ctx>)
        ) {
            const renderArgFn = async (
                arg: ArgumentNode,
                locals?: Record<string, unknown>,
            ): Promise<string> => {
                const childCtx = locals
                    ? withLocals(ctx, locals)
                    : { ...ctx, depth: ctx.depth + 1 };
                return renderNodesAsync(
                    arg.nodes,
                    childCtx,
                    resolver,
                    tags,
                    options,
                );
            };
            const result = await (
                handler as AsyncStructuralTagHandler<Ctx>
            ).handle(node.args, ctx, renderArgFn);
            return stringify(result);
        }

        const eagerArgs: string[] = [];
        for (const a of node.args)
            eagerArgs.push(
                await renderArgAsync(a, ctx, resolver, tags, options),
            );
        const result = await (handler as AsyncTagHandler<Ctx>)(eagerArgs, ctx);
        return stringify(result);
    } catch (err) {
        if (err instanceof RenderError) throw err;
        throw new RenderError(
            `Tag '${node.name}' threw during render: ${(err as Error).message}`,
            {
                tagName: node.name,
                span: node.span,
                cause: err,
            },
        );
    }
}

async function renderArgAsync<Ctx>(
    arg: ArgumentNode,
    ctx: RenderContext<Ctx>,
    resolver: AsyncVariableResolver<Ctx> | undefined,
    tags: Readonly<
        Record<string, AnyAsyncTagHandler<Ctx> | AnyTagHandler<Ctx>>
    >,
    options: RenderAsyncOptions<Ctx>,
): Promise<string> {
    return renderNodesAsync(
        arg.nodes,
        { ...ctx, depth: ctx.depth + 1 },
        resolver,
        tags,
        options,
    );
}

/**
 * Normalize an async resolver. Mirrors normalizeResolver in Render.ts:
 * own props only, zero-arg function auto-invocation, args-taking functions
 * skipped to avoid accidental method calls.
 */
function normalizeResolverAsync<Ctx>(
    v:
        | AsyncVariableResolver<Ctx>
        | VariableResolver<Ctx>
        | Record<string, unknown>
        | undefined,
): AsyncVariableResolver<Ctx> | undefined {
    if (!v) return undefined;
    if (typeof v === "function") return v as AsyncVariableResolver<Ctx>;
    return (name: string) => {
        if (!Object.hasOwn(v, name)) return undefined;
        const value = v[name];
        if (value === undefined) return undefined;
        if (typeof value === "function") {
            if ((value as (...a: unknown[]) => unknown).length === 0) {
                try {
                    return (value as () => unknown)() as ReturnType<
                        AsyncVariableResolver<Ctx>
                    >;
                } catch {
                    return undefined;
                }
            }
            return undefined;
        }
        return value as ReturnType<AsyncVariableResolver<Ctx>>;
    };
}

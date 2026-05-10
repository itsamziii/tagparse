import type {
    ArgumentNode,
    CompiledTemplate,
    RenderContext,
    TagHandler,
    TagNode,
    TemplateNode,
    VariableResolver,
} from "../../types.js";
import { type Awaitable, NodeKind } from "../../types.js";
import { RenderError } from "../errors/Errors.js";

export const MAX_RENDER_DEPTH = 64;

/**
 * Structural tag handler — receives the raw argument AST nodes plus a
 * `render` callback to evaluate any subset on demand. Use for {if}, {each},
 * {switch} and other tags where some args should not always be rendered.
 *
 * Return value may be a promise, in which case the async renderer awaits it.
 * The sync renderer rejects promise returns with a clear error.
 */
export interface StructuralTagHandler<Ctx = unknown> {
    readonly structural: true;
    handle(
        args: readonly ArgumentNode[],
        ctx: RenderContext<Ctx>,
        render: (
            arg: ArgumentNode,
            withLocals?: Record<string, unknown>,
        ) => Awaitable<string>,
    ): Awaitable<string | number | boolean | null | undefined>;
}

export type AnyTagHandler<Ctx = unknown> =
    | TagHandler<Ctx>
    | StructuralTagHandler<Ctx>;

export function isStructural<Ctx>(
    h: AnyTagHandler<Ctx>,
): h is StructuralTagHandler<Ctx> {
    return (
        typeof h === "object" &&
        h !== null &&
        (h as StructuralTagHandler<Ctx>).structural === true
    );
}

export function defineStructuralTag<Ctx = unknown>(
    handle: StructuralTagHandler<Ctx>["handle"],
): StructuralTagHandler<Ctx> {
    return { structural: true, handle };
}

export interface RenderOptions<Ctx = unknown> {
    readonly data?: Ctx;
    readonly variables?: VariableResolver<Ctx> | Record<string, unknown>;
    readonly tags?: Readonly<Record<string, AnyTagHandler<Ctx>>>;
    /**
     * Called when a variable is referenced but not found. Defaults to "" (empty).
     * Return undefined to use default; return a string to substitute.
     */
    readonly onMissingVariable?: (
        name: string,
        ctx: RenderContext<Ctx>,
    ) => string | undefined;
    /**
     * Called when a tag is referenced but no handler is registered. Defaults to "".
     */
    readonly onMissingTag?: (
        name: string,
        args: readonly string[],
        ctx: RenderContext<Ctx>,
    ) => string | undefined;
}

/**
 * Render a parsed template against data. Synchronous.
 */
export function render<Ctx = unknown>(
    template: CompiledTemplate,
    options: RenderOptions<Ctx> = {},
): string {
    const data = (options.data ?? ({} as Ctx)) as Ctx;
    const resolver = normalizeResolver(options.variables);
    const tags = options.tags ?? {};

    const ctx: RenderContext<Ctx> = {
        data,
        locals: new Map(),
        depth: 0,
    };

    return renderNodes(template.nodes, ctx, resolver, tags, options);
}

function renderNodes<Ctx>(
    nodes: readonly TemplateNode[],
    ctx: RenderContext<Ctx>,
    resolver: VariableResolver<Ctx> | undefined,
    tags: Readonly<Record<string, AnyTagHandler<Ctx>>>,
    options: RenderOptions<Ctx>,
): string {
    if (ctx.depth > MAX_RENDER_DEPTH) {
        throw new RenderError(`Render depth exceeded ${MAX_RENDER_DEPTH}`);
    }

    let out = "";
    for (const node of nodes) {
        out += renderNode(node, ctx, resolver, tags, options);
    }
    return out;
}

function renderNode<Ctx>(
    node: TemplateNode,
    ctx: RenderContext<Ctx>,
    resolver: VariableResolver<Ctx> | undefined,
    tags: Readonly<Record<string, AnyTagHandler<Ctx>>>,
    options: RenderOptions<Ctx>,
): string {
    switch (node.kind) {
        case NodeKind.Text:
            return node.value;
        case NodeKind.Variable: {
            const fromLocals = ctx.locals.get(node.name);
            if (fromLocals !== undefined) return stringify(fromLocals);
            if (resolver) {
                const v = resolver(node.name, ctx);
                if (v !== undefined && v !== null) return stringify(v);
            }
            const fallback = options.onMissingVariable?.(node.name, ctx);
            return fallback ?? "";
        }
        case NodeKind.Tag: {
            return renderTag(node, ctx, resolver, tags, options);
        }
    }
}

function renderTag<Ctx>(
    node: TagNode,
    ctx: RenderContext<Ctx>,
    resolver: VariableResolver<Ctx> | undefined,
    tags: Readonly<Record<string, AnyTagHandler<Ctx>>>,
    options: RenderOptions<Ctx>,
): string {
    const handler = tags[node.name];
    if (!handler) {
        const evaledArgs = node.args.map((a) =>
            renderArg(a, ctx, resolver, tags, options),
        );
        const fallback = options.onMissingTag?.(node.name, evaledArgs, ctx);
        return fallback ?? "";
    }

    try {
        if (isStructural(handler)) {
            const renderArgFn = (
                arg: ArgumentNode,
                locals?: Record<string, unknown>,
            ): string => {
                const argCtx = locals
                    ? withLocals(ctx, locals)
                    : { ...ctx, depth: ctx.depth + 1 };
                return renderNodes(arg.nodes, argCtx, resolver, tags, options);
            };
            const result = handler.handle(node.args, ctx, renderArgFn);
            if (
                result &&
                typeof (result as unknown as Promise<unknown>).then ===
                    "function"
            ) {
                throw new RenderError(
                    `Tag '${node.name}' returned a Promise; use renderAsync() for async tags.`,
                    { tagName: node.name, span: node.span },
                );
            }
            return stringify(result);
        }

        const eagerArgs = node.args.map((a) =>
            renderArg(a, ctx, resolver, tags, options),
        );
        const result = handler(eagerArgs, ctx);
        if (
            result &&
            typeof (result as unknown as Promise<unknown>).then === "function"
        ) {
            throw new RenderError(
                `Tag '${node.name}' returned a Promise; use renderAsync() for async tags.`,
                { tagName: node.name, span: node.span },
            );
        }
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

function renderArg<Ctx>(
    arg: ArgumentNode,
    ctx: RenderContext<Ctx>,
    resolver: VariableResolver<Ctx> | undefined,
    tags: Readonly<Record<string, AnyTagHandler<Ctx>>>,
    options: RenderOptions<Ctx>,
): string {
    return renderNodes(
        arg.nodes,
        { ...ctx, depth: ctx.depth + 1 },
        resolver,
        tags,
        options,
    );
}

/**
 * Normalize a record-shaped `variables` option into a function resolver.
 *
 * Behaviour:
 *   - Only own properties are considered (no prototype walks).
 *   - Zero-arg functions are auto-invoked, so `{ user: () => fetchUser() }` works.
 *     If the function throws, the lookup falls through to onMissingVariable.
 *   - Functions that take arguments are returned as undefined to avoid
 *     accidentally invoking object methods like toString or hasOwnProperty.
 */
export function normalizeResolver<Ctx>(
    v: VariableResolver<Ctx> | Record<string, unknown> | undefined,
): VariableResolver<Ctx> | undefined {
    if (!v) return undefined;
    if (typeof v === "function") return v;
    return (name: string) => {
        if (!Object.hasOwn(v, name)) return undefined;
        const value = v[name];
        if (value === undefined) return undefined;
        if (typeof value === "function") {
            if ((value as (...a: unknown[]) => unknown).length === 0) {
                try {
                    return (value as () => unknown)() as ReturnType<
                        VariableResolver<Ctx>
                    >;
                } catch {
                    return undefined;
                }
            }
            return undefined;
        }
        return value as ReturnType<VariableResolver<Ctx>>;
    };
}

/**
 * Convert a tag/variable result into a string for splicing into output.
 *
 * Rules:
 *   - null/undefined → ""
 *   - string → as-is
 *   - number/boolean/bigint → String(v)
 *   - Date → ISO string
 *   - plain object/array → JSON.stringify, with a circular-safe fallback to ""
 *   - everything else (functions, symbols) → ""
 *
 * The previous behaviour of String(v) for objects produced "[object Object]",
 * which is almost never what users want in a rendered chat message.
 */
export function stringify(v: unknown): string {
    if (v === null || v === undefined) return "";
    const t = typeof v;
    if (t === "string") return v as string;
    if (t === "number" || t === "boolean") return String(v);
    if (t === "bigint") return (v as bigint).toString();
    if (t === "function" || t === "symbol") return "";
    if (t !== "object") return "";

    if (v instanceof Date) return v.toISOString();

    try {
        const out = JSON.stringify(v);
        return out ?? "";
    } catch {
        // Circular references or non-serializable contents.
        return "";
    }
}

/**
 * Produce a new context with additional locals merged on top of the existing
 * ones. Bumps depth by 1. Used by both the sync and async renderers and by
 * structural tag handlers.
 */
export function withLocals<Ctx>(
    ctx: RenderContext<Ctx>,
    locals: Record<string, unknown>,
): RenderContext<Ctx> {
    const merged = new Map(ctx.locals);
    for (const [k, val] of Object.entries(locals)) merged.set(k, val);
    return { ...ctx, locals: merged, depth: ctx.depth + 1 };
}

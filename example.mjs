import { Parser } from "./dist/index.mjs";

(async () => {
    const input = "Hello, {world}!";
    const parser = new Parser(input);

    const res = await parser.parse();

    console.dir(res, { depth: null });
})();

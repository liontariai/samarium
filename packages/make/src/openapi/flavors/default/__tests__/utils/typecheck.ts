import path from "node:path";
import ts from "typescript";

const MAKE_ROOT = path.resolve(import.meta.dir, "../../../../../..");

/**
 * Parse / name-resolution failures that mean the generated SDK is not usable.
 * Assignment-strictness noise from the generator is ignored.
 */
const CRITICAL_CODES = new Set([
    // syntax / parse
    1002, 1003, 1005, 1009, 1109, 1110, 1127, 1128, 1131, 1160, 1161, 1180, 1434,
    // cannot find name / module / namespace
    2304, 2305, 2306, 2307, 2552, 2580, 2581, 2582, 2583, 2584, 2503, 2688, 2693, 2694,
    2708, 2709,
]);

export function collectCriticalTypeErrors(generatedFileAbs: string): string[] {
    const options: ts.CompilerOptions = {
        lib: ["lib.esnext.d.ts"],
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        target: ts.ScriptTarget.ESNext,
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        allowImportingTsExtensions: true,
        allowSyntheticDefaultImports: true,
        verbatimModuleSyntax: true,
        baseUrl: MAKE_ROOT,
        paths: {
            "@/*": [path.join(MAKE_ROOT, "src/*")],
        },
        types: ["bun-types"],
    };

    const host = ts.createCompilerHost(options);
    const program = ts.createProgram([generatedFileAbs], options, host);
    const abs = path.resolve(generatedFileAbs);

    return ts
        .getPreEmitDiagnostics(program)
        .filter((d) => d.category === ts.DiagnosticCategory.Error)
        .filter((d) => !d.file || path.resolve(d.file.fileName) === abs)
        .filter((d) => CRITICAL_CODES.has(d.code))
        .map((d) => {
            const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
            if (!d.file || d.start === undefined) {
                return `TS${d.code}: ${msg}`;
            }
            const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
            return `${path.relative(MAKE_ROOT, d.file.fileName)}:${line + 1}:${character + 1} TS${d.code}: ${msg}`;
        });
}

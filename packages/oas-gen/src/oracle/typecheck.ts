import path from "node:path";
import ts from "typescript";

/**
 * Parse / name-resolution failures that mean the generated SDK is not usable.
 * Assignment-strictness noise from the generator is ignored.
 */
const CRITICAL_CODES = new Set([
    1002, 1003, 1005, 1009, 1109, 1110, 1127, 1128, 1131, 1160, 1161, 1180, 1434, 2304, 2305, 2306, 2307, 2552, 2580,
    2581, 2582, 2583, 2584, 2503, 2688, 2693, 2694, 2708, 2709,
]);

/**
 * Typecheck an in-memory generated SDK. Returns critical diagnostic strings only.
 */
export function typecheckSdk(code: string): string[] {
    const fileName = path.join("/virtual", "sdk.ts");
    const options: ts.CompilerOptions = {
        lib: ["lib.esnext.d.ts", "lib.dom.d.ts"],
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        target: ts.ScriptTarget.ESNext,
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        allowSyntheticDefaultImports: true,
    };

    const host = ts.createCompilerHost(options);
    const origGet = host.getSourceFile.bind(host);
    const origExists = host.fileExists.bind(host);
    const origRead = host.readFile.bind(host);

    host.getSourceFile = (name, languageVersion, onError, shouldCreateNewSourceFile) => {
        if (path.resolve(name) === path.resolve(fileName) || name.endsWith("/sdk.ts") || name === fileName) {
            return ts.createSourceFile(fileName, code, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
        }
        return origGet(name, languageVersion, onError, shouldCreateNewSourceFile);
    };
    host.fileExists = (n) => n === fileName || n.endsWith("/sdk.ts") || origExists(n);
    host.readFile = (n) => (n === fileName || n.endsWith("/sdk.ts") ? code : origRead(n));

    const program = ts.createProgram([fileName], options, host);
    return ts
        .getPreEmitDiagnostics(program)
        .filter((d) => d.category === ts.DiagnosticCategory.Error)
        .filter((d) => !d.file || d.file.fileName === fileName)
        .filter((d) => CRITICAL_CODES.has(d.code))
        .map((d) => {
            const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
            if (!d.file || d.start === undefined) return `TS${d.code}: ${msg}`;
            const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
            return `${line + 1}:${character + 1} TS${d.code}: ${msg}`;
        });
}

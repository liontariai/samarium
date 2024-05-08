import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import excludeDependenciesFromBundle from "rollup-plugin-exclude-dependencies-from-bundle";

export default {
    input: "src/index.ts",
    output: {
        dir: "bin",
        format: "esm",
        entryFileNames: "[name].js",
    },
    plugins: [
        json(),
        commonjs(),
        nodeResolve({
            exportConditions: ["node"],
        }),
        typescript(),
        terser({
            format: {
                comments: "some",
                beautify: true,
                ecma: "2022",
            },
            compress: false,
            mangle: false,
            module: true,
        }),
        excludeDependenciesFromBundle(),
    ],
};

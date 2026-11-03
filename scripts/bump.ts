import fs from "fs";
import path from "path";
import * as semver from "semver";
import { Command } from "commander";
import inquirer from "inquirer";
import { execFile, spawn } from "child_process";

function bumpVersion(
    version: string,
    position: "major" | "minor" | "patch",
): string {
    const parsed = semver.parse(version);
    if (!parsed) return version;
    switch (position) {
        case "major":
            parsed.major++;
            parsed.minor = 0;
            parsed.patch = 0;
            break;
        case "minor":
            parsed.minor++;
            parsed.patch = 0;
            break;
        case "patch":
            parsed.patch++;
            break;
    }
    return `${parsed.major}.${parsed.minor}.${parsed.patch}`;
}

function getBaseDir(): string {
    let dir = process.cwd();
    while (dir !== path.dirname(dir)) {
        if (fs.existsSync(path.join(dir, "package.json"))) {
            return dir;
        }
        dir = path.dirname(dir);
    }
    return process.cwd();
}

function findPackageJsonFiles(dir: string): string[] {
    const files: string[] = [];
    if (fs.existsSync(path.join(dir, "package.json"))) {
        files.push(path.join(dir, "package.json"));
    }
    const packagesDir = path.join(dir, "packages");
    if (fs.existsSync(packagesDir)) {
        const entries = fs.readdirSync(packagesDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const subDir = path.join(packagesDir, entry.name);
                if (fs.existsSync(path.join(subDir, "package.json"))) {
                    files.push(path.join(subDir, "package.json"));
                }
            }
        }
    }
    return files;
}

function run(
    command: string,
    args: string[],
    cwd: string,
    inherit = false,
): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile(
            command,
            args,
            {
                cwd,
                encoding: "utf-8",
                ...(inherit ? { stdio: "inherit" as const } : {}),
            },
            (error, stdout, stderr) => {
                if (error) {
                    if (!inherit && stdout) console.log(stdout);
                    if (!inherit && stderr) console.error(stderr);
                    reject(error);
                    return;
                }
                resolve(stdout ?? "");
            },
        );
    });
}

async function confirm(message: string): Promise<boolean> {
    const answer = await inquirer.prompt([
        {
            type: "confirm",
            name: "yes",
            message,
            default: false,
        },
    ]);
    return Boolean(answer.yes);
}

async function ran(
    label: string,
    command: string,
    args: string[],
    cwd: string,
    inherit = false,
): Promise<boolean> {
    try {
        const stdout = await run(command, args, cwd, inherit);
        if (stdout) console.log(stdout);
        return true;
    } catch (error) {
        console.error(`Error running ${label}:`, error);
        return false;
    }
}

// bun publish reports "missing authentication (run `bunx npm login`)".
function needsNpmLogin(output: string): boolean {
    return /npm login/i.test(output) || /missing authentication/i.test(output);
}

function runObserved(
    command: string,
    args: string[],
    cwd: string,
): Promise<{ ok: boolean; output: string }> {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (result: { ok: boolean; output: string }) => {
            if (settled) return;
            settled = true;
            resolve(result);
        };
        const child = spawn(command, args, {
            cwd,
            stdio: ["inherit", "pipe", "pipe"],
        });
        let output = "";
        const forward = (chunk: Buffer, stream: NodeJS.WriteStream) => {
            const text = chunk.toString();
            output += text;
            stream.write(text);
        };
        child.stdout?.on("data", (chunk: Buffer) =>
            forward(chunk, process.stdout),
        );
        child.stderr?.on("data", (chunk: Buffer) =>
            forward(chunk, process.stderr),
        );
        child.on("error", (error) => {
            output += error.message;
            finish({ ok: false, output });
        });
        child.on("close", (code) => {
            finish({ ok: code === 0, output });
        });
    });
}

async function publishAll(cwd: string): Promise<boolean> {
    const publish = () => runObserved("bun", ["run", "publish:all"], cwd);
    const first = await publish();
    if (first.ok) return true;
    if (!needsNpmLogin(first.output)) {
        console.error("Error running publish:all.");
        return false;
    }

    console.log("\npublish:all failed because it requires 'npm login'.");
    if (!(await confirm("Run 'npm login'? (default: No)"))) return false;

    const loggedIn = await ran("npm login", "npm", ["login"], cwd, true);
    if (!loggedIn) return false;

    console.log("\nRunning 'publish:all' again.");
    const second = await publish();
    if (!second.ok) {
        console.error("Error running publish:all.");
        return false;
    }
    return true;
}

async function main(): Promise<void> {
    const program = new Command();
    program
        .name("bump")
        .description("Bump package version")
        .option("-m, --major", "bump major version")
        .option("-n, --minor", "bump minor version")
        .option("-p, --patch", "bump patch version")
        .option("-u, --ui", "interactive selection menu")
        .parse(process.argv);

    const options = program.opts();
    let position: "major" | "minor" | "patch" | undefined;

    if (options.major) {
        position = "major";
    } else if (options.minor) {
        position = "minor";
    } else if (options.patch) {
        position = "patch";
    } else {
        const answer = await inquirer.prompt([
            {
                type: "select",
                name: "position",
                message: "Select version bump position:",
                choices: ["major", "minor", "patch"],
            },
        ]);
        position = answer.position;
    }

    const pkgBaseDir = getBaseDir();
    const files = findPackageJsonFiles(pkgBaseDir);
    console.log(`\nFound ${files.length} package.json to update:\n`);

    let allSuccess = true;
    let firstNewVersion: string | undefined;
    const bumpedPaths: string[] = [];
    for (const pkgPath of files) {
        const content = fs.readFileSync(pkgPath, "utf-8");
        const pkg = JSON.parse(content);
        const currentVersion = pkg.version;

        // Root package.json has no version. Skip it so it is not recorded as the bump.
        if (
            typeof currentVersion !== "string" ||
            !semver.valid(currentVersion)
        ) {
            console.warn(`  ${pkgPath}: skipped (no valid version).`);
            continue;
        }

        const newVersion = bumpVersion(currentVersion, position!);

        if (newVersion === currentVersion) {
            console.warn(
                `  ${pkgPath}: version ${currentVersion} is already at the next ${position}-bumped state (no change).`,
            );
            allSuccess = false;
            continue;
        }

        pkg.version = newVersion;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
        console.log(`  ${pkgPath}: ${currentVersion} -> ${newVersion}`);
        bumpedPaths.push(pkgPath);

        if (!firstNewVersion) {
            firstNewVersion = newVersion;
        }
    }

    if (allSuccess && firstNewVersion) {
        console.log(
            `\nBumped ${position}-position for ${bumpedPaths.length} package(s).`,
        );

        // Ask to run bun install. Wait for it so its output does not cover the next prompt.
        const installAnswers = await inquirer.prompt([
            {
                type: "confirm",
                name: "install",
                message: `Run 'bun install' to update the lock file? (default: No)`,
                default: false,
            },
        ]);
        let installed = false;
        if (installAnswers.install) {
            try {
                const stdout = await run("bun", ["install"], pkgBaseDir);
                if (stdout) console.log(stdout);
                installed = true;
            } catch (error) {
                console.error("Error running bun install:", error);
            }
        }

        const commitMessage = `v${firstNewVersion}`;
        const commitAnswers = await inquirer.prompt([
            {
                type: "confirm",
                name: "commit",
                message: `Add a new commit with commit message "${commitMessage}"? (default: No)`,
                default: false,
            },
        ]);
        if (commitAnswers.commit) {
            const paths = [...bumpedPaths];
            const lockfile = path.join(pkgBaseDir, "bun.lock");
            if (installed && fs.existsSync(lockfile)) {
                paths.push(lockfile);
            }
            const added = await ran(
                "git add",
                "git",
                ["add", "--", ...paths],
                pkgBaseDir,
            );
            let ready =
                added &&
                (await ran(
                    "git commit",
                    "git",
                    ["commit", "-m", commitMessage],
                    pkgBaseDir,
                ));

            if (
                ready &&
                (await confirm("Run 'bun bundle:all'? (default: No)"))
            ) {
                ready = await ran(
                    "bun bundle:all",
                    "bun",
                    ["run", "bundle:all"],
                    pkgBaseDir,
                    true,
                );
            } else {
                ready = false;
            }

            if (ready && (await confirm("Run 'publish:all'? (default: No)"))) {
                ready = await publishAll(pkgBaseDir);
            } else {
                ready = false;
            }

            if (
                ready &&
                (await confirm(`Run 'git tag ${commitMessage}'? (default: No)`))
            ) {
                ready = await ran(
                    "git tag",
                    "git",
                    ["tag", commitMessage],
                    pkgBaseDir,
                );
            } else {
                ready = false;
            }

            if (
                ready &&
                (await confirm(
                    "Push with 'git push' and 'git push --tags'? (default: No)",
                ))
            ) {
                const pushed = await ran(
                    "git push",
                    "git",
                    ["push"],
                    pkgBaseDir,
                    true,
                );
                if (pushed) {
                    await ran(
                        "git push --tags",
                        "git",
                        ["push", "--tags"],
                        pkgBaseDir,
                        true,
                    );
                }
            }
        }
    }
}

main();

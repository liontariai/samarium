import packageJson from "../../../package.json";

export const printLogo = (mode: "GraphQL" | "OpenAPI") => {
    process.stdout.write("\x1Bc");
    process.stdout.write(`
 _____                                 _                   
/  ___|                               (_)                  
\\ \`--.   __ _  _ __ ___    __ _  _ __  _  _   _  _ __ ___  
 \\\`--. \\ / _\` || '_ \` _ \\  / _\` || '__|| || | | || '_ \` _ \\ 
/\\__/ /| (_| || | | | | || (_| || |   | || |_| || | | | | |
\\____/  \\__,_||_| |_| |_| \\__,_||_|   |_| \\__,_||_| |_| |_|
`);
    console.log(" ");
    console.log(`v${packageJson.version}`);
    console.log(" ");
    console.log("Welcome to the Samarium CLI Assistant");
    console.log(" ");
    console.log(
        `This assistant will help you compile an ${mode} API into a samarium typescript sdk.`,
    );
    console.log(" ");
};

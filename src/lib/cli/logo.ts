import packageJson from "../../../package.json";

export const printLogo = () => {
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
        "This assistant will help you generate a Samarium client from a GraphQL endpoint and use it in your project.",
    );
    console.log(" ");
};

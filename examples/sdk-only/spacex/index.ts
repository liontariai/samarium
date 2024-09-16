import { confirm, input } from "@inquirer/prompts";
import spacex from "./spacex";

// Retrieve some basic information first

const { info, getRockets, getRocket } = await spacex((op) =>
    op.query((s) => ({
        info: s.company(({ name, ceo, cto, coo, summary }) => ({
            name,
            ceo,
            cto,
            coo,
            summary,
        })),

        getRockets: s.rockets({ limit: 10 })(({ id, name, type }) => ({
            id,
            name,
            type,
        })).$lazy,

        getRocket: s.rocket({ id: "" })(({ name, type, description }) => ({
            name,
            type,
            description,
        })).$lazy,
    })),
);

// Print out the company info
console.log("Welcome to the SpaceX Samarium SDK!");
console.log("========================");
console.log("Let's start by retrieving some basic information about SpaceX.");
console.log("========================");
console.log(`Name: ${info.name}`);
console.log(`CEO: ${info.ceo}`);
console.log(`CTO: ${info.cto}`);
console.log(`COO: ${info.coo}`);
console.log(`Summary: ${info.summary}`);
console.log("========================");
console.log("Now, let's retrieve some rockets!");
console.log("========================");

let limit = undefined;
while (!limit) {
    limit = await input({
        message: "Enter the limit of rockets to retrieve:",
    });
    if (isNaN(Number(limit))) {
        console.log("Please enter a valid number.");
        limit = undefined;
    }
}
const rockets = await getRockets({ limit: Number(limit) });
for (const rocket of rockets) {
    console.log(rocket);
}

console.log("========================");
console.log("Now, let's retrieve some more information about a rocket.");
console.log("========================");

let continuePrompt = true;
while (continuePrompt) {
    let rocketId = "";
    while (!rocketId) {
        rocketId = await input({
            message:
                "Enter the id of the rocket to retrieve more information about:",
        });
        if (!rockets.find((r) => r.id === rocketId)) {
            console.log(
                "Please enter a valid rocket id. Here are the available ids:",
            );
            for (const rocket of rockets) {
                console.log(rocket.id, rocket.name);
            }
            rocketId = "";
        }
    }

    const rocket = await getRocket({ id: rocketId });
    console.log(
        `Name: ${rocket.name}\nType: ${rocket.type}\nDescription: ${rocket.description}`,
    );

    continuePrompt = await confirm({
        message:
            "Do you want to retrieve more information about another rocket?",
    });
}

console.log("Thank you for using the SpaceX Samarium SDK!");

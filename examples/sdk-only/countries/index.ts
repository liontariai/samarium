import countries from "./countries";

const {
    EU_NA: { continents },
} = await countries((op) => ({
    EU_NA: op.query(({ continents }) => ({
        continents: continents({
            filter: {
                code: { in: ["EU", "NA"] },
            },
        })(({ countries }) => ({
            countries: countries(({ name }) => ({
                name: name({ lang: "en" }),
            })),
        })),
    })),
}));

console.log(
    continents?.flatMap((continent) =>
        continent.countries.map((country) => country.name),
    ),
);
// [ "Andorra", "Albania", "Austria", ...]

import countries from "./countries";

const continents = await countries.query.continents({
    filter: {
        code: { in: ["EU", "NA"] },
    },
})(({ countries }) => ({
    countries: countries(),
}));

console.log(continents[0].countries.map((c) => c));
console.log(
    continents?.flatMap((continent) =>
        continent.countries.map((country) => country.capital),
    ),
);
// [ "Andorra", "Albania", "Austria", ...]

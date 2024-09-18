import starwars from "./starwars";

const { op1, op2 } = await starwars((op) => ({
    op1: op.query((s) => ({
        last10: s.allSpecies({
            last: 10,
        })(({ species }) => ({
            species: species((s) => ({
                name: s.name,
                skinColors: s.skinColors,
            })),
        })),
    })),
    op2: op.query((s) => ({
        last10: s.allFilms({
            last: 10,
        })(({ films }) => ({
            films: films((s) => ({
                release: s.releaseDate,
            })),
        })),
    })),
}));

console.log(op1.last10.species.map((species) => species.name));
// [ "Geonosian", "Mirialan", "Clawdite", "Besalisk", ... ]
console.log(op2.last10.films.map((film) => film.release));
// [ "1977-05-25", "1980-05-17", "1983-05-25", "1999-05-19", ... ]

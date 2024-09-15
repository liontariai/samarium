# Custom Scalars

Custom scalars allow you to define specific serialization and deserialization logic for certain types in your GraphQL schema. The SDK provides a way to handle custom scalars by specifying transformation functions.

## Usage

You can define custom scalar transformations when initializing the SDK:

```typescript
import sdk from "./sdks/timeslots";

sdk.init({
    scalars: {
        DateTime: (v) => new Date(v), // this is the default implementation
    },
});

const { timeslots } = await sdk((op) =>
    op.query((q) => ({
        timeslots: q.availableSlots(({ start, end, isBooked }) => ({
            start,
            end,
            isBooked,
        })),
    })),
);

console.log(
    timeslots
        .filter((slot) => !slot.isBooked)
        .filter((slot) => {
            return slot.start >= new Date()
        });
    // ----------- 👆 no need to parse, it's already a Date object!
);

// [
//      { start: Date('2022-01-01T00:00:00.000Z'), end: Date('2022-01-01T01:00:00.000Z'), isBooked: false },
//      { start: Date('2022-01-01T02:00:00.000Z'), end: Date('2022-01-01T03:00:00.000Z'), isBooked: false }
// ]
```

## Custom Scalar Types with Custom Deserialization

You can also provide a custom deserialization function for custom scalar types:

```typescript
import sdk from "./sdks/timeslots";

sdk.init({
    scalars: {
        DateTime: (v: string) => new Date(+v * 1000),
        // ---- 👆 typesafe function: (v: string) => Date
        // for example, convert a Unix timestamp to a Date object
    },
});

const { timeslots } = await sdk((op) =>
    op.query((q) => ({
        timeslots: q.availableSlots(({ start, end, isBooked }) => ({
            start,
            end,
            isBooked,
        })),
    })),
);

console.log(timeslots);

// [
//      { start: Date('2022-01-01T00:00:00.000Z'), end: Date('2022-01-01T01:00:00.000Z'), isBooked: false },
//      { start: Date('2022-01-01T02:00:00.000Z'), end: Date('2022-01-01T03:00:00.000Z'), isBooked: false }
// ]
```

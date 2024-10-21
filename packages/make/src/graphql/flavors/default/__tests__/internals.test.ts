import { describe, expect, it } from "bun:test";
import {
    ROOT_OP_COLLECTOR,
    SLW_COLLECTOR,
    SLW_FIELD_ARR_DEPTH,
    SLW_FIELD_NAME,
    SLW_FIELD_TYPENAME,
    SLW_IS_ROOT_TYPE,
    SLW_PARENT_COLLECTOR,
    SLW_PARENT_SLW,
} from "@/graphql/flavors/default/wrapper";
import { rootSLWFactory } from "./utils";
import * as examplesBooksSimple from "./examples/books.simple";

describe("Internal structure and functionality of the SelectionWrapper and OperationSelectionCollector", () => {
    it("the hierarchical structure of the selection wrappers should be correct", () => {
        // example query based on available selection functions
        const slw1 = rootSLWFactory(
            examplesBooksSimple._makeRootOperationInput,
            (op) => ({
                operation1: op.query((q) => ({
                    bookTitles: q.books(({ title }) => ({
                        title,
                    })),
                })),
                operation2: op.query((q) => ({
                    bookAuthors: q.books(({ author }) => ({
                        author,
                    })),
                })),
            }),
        );

        // slw1 is the root selection wrapper and thus has no parent selection wrapper
        expect(slw1[SLW_PARENT_SLW]).toBeUndefined();
        expect(slw1[SLW_PARENT_COLLECTOR]).toBeUndefined();
        // it's parent slw and parent operation selection collector (i.e. collector) is undefined
        // because there are no parents further up the chain
        // the assigned collector is the the collector which links the RootOperation and at the
        // same time is the root operation collector for all slws down the chain
        expect(slw1[ROOT_OP_COLLECTOR]).toBeDefined();
        expect(slw1[SLW_COLLECTOR]).toEqual(slw1[ROOT_OP_COLLECTOR]!.ref);

        // the 'selections' in the root collector are the operations 'operation1' and 'operation2'
        // this is the 'normal' case which reassembles the graphql language the closest
        // you can see the similarity of the object from line 18 to 29 compared to a graphql
        // file where you put two operations like this:
        // 'query operation1 { ... } \n query operation2 { ... }'
        expect(slw1[ROOT_OP_COLLECTOR]!.ref.selections.size).toBe(2);
        expect(
            slw1[ROOT_OP_COLLECTOR]!.ref.selections.has("operation1"),
        ).toBeTrue();
        expect(
            slw1[ROOT_OP_COLLECTOR]!.ref.selections.has("operation2"),
        ).toBeTrue();

        // each entry in 'collector.selections' is a slw itself which in turn has a collector
        // and this collector has '.selections'. This holds true until one reaches a leaf in
        // the selection and thus a scalar type (primitive or custom scalar)
        // a leaf is special case as it has a collector but the parent collector is set undefined

        // this is the indicator that the field is a leaf in the selection, I consider this not
        // the optimal solution but for now it's the easiest way to determine if a field is a leaf

        const slw1Op1slwQuery =
            slw1[SLW_COLLECTOR]?.selections.get("operation1");
        expect(slw1Op1slwQuery?.[SLW_COLLECTOR]).toBeDefined();

        // again, here also the root collector is linked
        expect(slw1Op1slwQuery?.[ROOT_OP_COLLECTOR]?.ref).toEqual(
            slw1[SLW_COLLECTOR]!,
        );

        // in the operation1 only one field from the Query type is selected, namely 'books'
        // (which is aliased to bookTitles)
        expect(slw1Op1slwQuery?.[SLW_COLLECTOR]?.selections.size).toBe(1);
        expect(
            slw1Op1slwQuery?.[SLW_COLLECTOR]?.selections.has("bookTitles"),
        ).toBeTrue();

        const op1BookTitlesSlw =
            slw1Op1slwQuery?.[SLW_COLLECTOR]?.selections.get("bookTitles");

        // the field name is 'books', as it's the Query.books field
        // the alias soley lies defined in the Map 'collector.selections' key => slw mapping
        expect(op1BookTitlesSlw?.[SLW_FIELD_NAME]).toBe("books");

        // the field's typename is also available
        // and the field's pure typename (without any array brackets or non-null indicators)
        expect(op1BookTitlesSlw?.[SLW_FIELD_TYPENAME]).toBe("Book");
        // the depth of array brackets is available as number
        expect(op1BookTitlesSlw?.[SLW_FIELD_ARR_DEPTH]).toBe(1);

        // the collectors selections are the fields selected on the 'books' field
        // in this case only the 'title' field is selected
        expect(op1BookTitlesSlw?.[SLW_COLLECTOR]?.selections.size).toBe(1);
        expect(
            op1BookTitlesSlw?.[SLW_COLLECTOR]?.selections.has("title"),
        ).toBeTrue();

        // the 'title' field is a leaf in the selection and thus has no collector
        // the field's typename is 'String' and the field's name is 'title'
        const op1BookTitlesTitleSlw =
            op1BookTitlesSlw?.[SLW_COLLECTOR]?.selections.get("title");
        expect(op1BookTitlesTitleSlw?.[SLW_FIELD_NAME]).toBe("title");
        expect(op1BookTitlesTitleSlw?.[SLW_FIELD_TYPENAME]).toBe("String");
        expect(op1BookTitlesTitleSlw?.[SLW_FIELD_ARR_DEPTH]).toBe(0);
        expect(op1BookTitlesTitleSlw?.[SLW_COLLECTOR]).toBeDefined();
        expect(op1BookTitlesTitleSlw?.[SLW_PARENT_COLLECTOR]).toBeUndefined();

        // the same goes for the second operation
        const slw1Op2slwQuery =
            slw1[SLW_COLLECTOR]?.selections.get("operation2");
        expect(slw1Op2slwQuery?.[SLW_COLLECTOR]).toBeDefined();
        expect(slw1Op2slwQuery?.[ROOT_OP_COLLECTOR]?.ref).toEqual(
            slw1[SLW_COLLECTOR]!,
        );
        expect(slw1Op2slwQuery?.[SLW_COLLECTOR]?.selections.size).toBe(1);
        expect(
            slw1Op2slwQuery?.[SLW_COLLECTOR]?.selections.has("bookAuthors"),
        ).toBeTrue();

        const op2BookAuthorsSlw =
            slw1Op2slwQuery?.[SLW_COLLECTOR]?.selections.get("bookAuthors");
        expect(op2BookAuthorsSlw?.[SLW_FIELD_NAME]).toBe("books");
        expect(op2BookAuthorsSlw?.[SLW_FIELD_TYPENAME]).toBe("Book");
        expect(op2BookAuthorsSlw?.[SLW_FIELD_ARR_DEPTH]).toBe(1);
        expect(op2BookAuthorsSlw?.[SLW_COLLECTOR]?.selections.size).toBe(1);
        expect(
            op2BookAuthorsSlw?.[SLW_COLLECTOR]?.selections.has("author"),
        ).toBeTrue();

        const op2BookAuthorsAuthorSlw =
            op2BookAuthorsSlw?.[SLW_COLLECTOR]?.selections.get("author");
        expect(op2BookAuthorsAuthorSlw?.[SLW_FIELD_NAME]).toBe("author");
        expect(op2BookAuthorsAuthorSlw?.[SLW_FIELD_TYPENAME]).toBe("String");
        expect(op2BookAuthorsAuthorSlw?.[SLW_FIELD_ARR_DEPTH]).toBe(0);
        expect(op2BookAuthorsAuthorSlw?.[SLW_COLLECTOR]).toBeDefined();
        expect(op2BookAuthorsAuthorSlw?.[SLW_PARENT_COLLECTOR]).toBeUndefined();
    });

    it("It should render valid selections", () => {
        // example query based on available selection functions
        const slw1 = rootSLWFactory(
            examplesBooksSimple._makeRootOperationInput,
            (op) => ({
                operation1: op.query((q) => ({
                    bookTitles: q.books(({ title }) => ({
                        title,
                    })),
                })),
                operation2: op.query((q) => ({
                    bookAuthors: q.books(({ author }) => ({
                        author,
                    })),
                })),

                mutation1: op.mutation((m) => ({
                    createBook: m.createBooks({
                        titles: ["book1", "book2"],
                        authors: ["author1", "author2"],
                    })(({ title }) => ({
                        title,
                    })),
                })),
            }),
        );

        expect(slw1[ROOT_OP_COLLECTOR]).toBeDefined();

        // get operation1 and render it's selection
        // 'operation1' will be the operation name in the graphql query
        // but the mechanism for it is the same as alias for fields in the selection
        // which means, the key in the 'collector.selections' map is the operation name
        // but collector is the root collector in this case

        const op1 = slw1[ROOT_OP_COLLECTOR]!.ref.selections.get("operation1")!;
        expect(op1).toBeDefined();
        expect(op1[SLW_COLLECTOR]).toBeDefined();

        // the selection is then rendered by the collector of the selection's slw
        const renderedOp1 = op1[SLW_COLLECTOR]!.renderSelections([
            "operation1",
        ]);
        expect(renderedOp1).toBeDefined();

        // so the selection of operation1 is the 'bookTitles' alias for the 'books' field
        expect(renderedOp1.selection).toEqual(
            "{ bookTitles: books { title } }",
        );

        // same goes for operation2
        const op2 = slw1[ROOT_OP_COLLECTOR]!.ref.selections.get("operation2")!;
        expect(op2).toBeDefined();
        expect(op2[SLW_COLLECTOR]).toBeDefined();

        const renderedOp2 = op2[SLW_COLLECTOR]!.renderSelections([
            "operation2",
        ]);

        expect(renderedOp2).toBeDefined();
        expect(renderedOp2.selection).toEqual(
            "{ bookAuthors: books { author } }",
        );

        // the mutation is also rendered correctly
        const mutation1 =
            slw1[ROOT_OP_COLLECTOR]!.ref.selections.get("mutation1")!;
        expect(mutation1).toBeDefined();
        expect(mutation1[SLW_COLLECTOR]).toBeDefined();

        const renderedMutation1 = mutation1[SLW_COLLECTOR]!.renderSelections([
            "mutation1",
        ]);
        expect(renderedMutation1).toBeDefined();
        expect(renderedMutation1.selection).toEqual(
            "{ createBook: createBooks(titles: $titles, authors: $authors) { title } }",
        );
        expect(renderedMutation1.variables).toEqual({
            titles: ["book1", "book2"],
            authors: ["author1", "author2"],
        });
        expect(renderedMutation1.variableDefinitions).toEqual([
            "$titles: [String]!",
            "$authors: [String]!",
        ]);
    });

    it("should correctly assign the operation types Query and Mutation to the operations", () => {
        const slw1 = rootSLWFactory(
            examplesBooksSimple._makeRootOperationInput,
            (op) => ({
                operation1: op.query((q) => ({
                    bookTitles: q.books(({ title }) => ({
                        title,
                    })),
                })),
                operation2: op.query((q) => ({
                    bookAuthors: q.books(({ author }) => ({
                        author,
                    })),
                })),

                mutation1: op.mutation((m) => ({
                    createBook: m.createBooks({
                        titles: ["book1", "book2"],
                        authors: ["author1", "author2"],
                    })(({ title }) => ({
                        title,
                    })),
                })),
            }),
        );

        const op1 = slw1[ROOT_OP_COLLECTOR]!.ref.selections.get("operation1")!;
        expect(op1).toBeDefined();
        expect(op1[SLW_IS_ROOT_TYPE]).toBe("Query");

        const op2 = slw1[ROOT_OP_COLLECTOR]!.ref.selections.get("operation2")!;
        expect(op2).toBeDefined();
        expect(op2[SLW_IS_ROOT_TYPE]).toBe("Query");

        const mutation1 =
            slw1[ROOT_OP_COLLECTOR]!.ref.selections.get("mutation1")!;
        expect(mutation1).toBeDefined();
        expect(mutation1[SLW_IS_ROOT_TYPE]).toBe("Mutation");
    });
});

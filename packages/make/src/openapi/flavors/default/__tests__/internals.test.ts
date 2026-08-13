import { describe, expect, it } from "bun:test";
import {
    ROOT_OP_COLLECTOR,
    ROOT_OP_META,
    SLW_COLLECTOR,
    SLW_FIELD_ARR_DEPTH,
    SLW_FIELD_NAME,
    SLW_FIELD_TYPENAME,
    SLW_PARENT_COLLECTOR,
    SLW_PARENT_SLW,
} from "@/openapi/flavors/default/wrapper";
import { rootSLWFactory } from "./utils";
import * as examplesBooks from "./examples/books.generated";
import * as examplesEvents from "./examples/events.generated";

describe("Internal structure and functionality of the SelectionWrapper and OperationSelectionCollector", () => {
    it("the hierarchical structure of the selection wrappers should be correct", () => {
        const slw1 = rootSLWFactory(examplesBooks._makeRootOperationInput, (op) => ({
            operation1: op.listBooks({})(({ title }) => ({
                title,
            })),
            operation2: op.listBooks({})(({ author }) => ({
                author,
            })),
        }));

        // slw1 is the root selection wrapper and thus has no parent selection wrapper
        expect(slw1[SLW_PARENT_SLW]).toBeUndefined();
        expect(slw1[SLW_PARENT_COLLECTOR]).toBeUndefined();
        expect(slw1[ROOT_OP_COLLECTOR]).toBeDefined();
        expect(slw1[SLW_COLLECTOR]).toEqual(slw1[ROOT_OP_COLLECTOR]!.ref);

        // the 'selections' in the root collector are the operations 'operation1' and 'operation2'
        expect(slw1[ROOT_OP_COLLECTOR]!.ref.selections.size).toBe(2);
        expect(slw1[ROOT_OP_COLLECTOR]!.ref.selections.has("operation1")).toBeTrue();
        expect(slw1[ROOT_OP_COLLECTOR]!.ref.selections.has("operation2")).toBeTrue();

        const slw1Op1 = slw1[SLW_COLLECTOR]?.selections.get("operation1");
        expect(slw1Op1?.[SLW_COLLECTOR]).toBeDefined();
        expect(slw1Op1?.[ROOT_OP_COLLECTOR]?.ref).toEqual(slw1[SLW_COLLECTOR]!);

        expect(slw1Op1?.[SLW_FIELD_NAME]).toBe("listBooks");
        expect(slw1Op1?.[SLW_FIELD_TYPENAME]).toBe("Book");
        expect(slw1Op1?.[SLW_FIELD_ARR_DEPTH]).toBe(1);
        expect(slw1Op1?.[ROOT_OP_META]).toEqual({
            path: "/books",
            method: "get",
            isEventStream: false,
        });

        expect(slw1Op1?.[SLW_COLLECTOR]?.selections.size).toBe(1);
        expect(slw1Op1?.[SLW_COLLECTOR]?.selections.has("title")).toBeTrue();

        const op1TitleSlw = slw1Op1?.[SLW_COLLECTOR]?.selections.get("title");
        expect(op1TitleSlw?.[SLW_FIELD_NAME]).toBe("title");
        expect(op1TitleSlw?.[SLW_FIELD_TYPENAME]).toBe("String");
        expect(op1TitleSlw?.[SLW_FIELD_ARR_DEPTH]).toBe(0);
        expect(op1TitleSlw?.[SLW_COLLECTOR]).toBeDefined();
        expect(op1TitleSlw?.[SLW_PARENT_COLLECTOR]).toBeUndefined();

        const slw1Op2 = slw1[SLW_COLLECTOR]?.selections.get("operation2");
        expect(slw1Op2?.[SLW_COLLECTOR]).toBeDefined();
        expect(slw1Op2?.[ROOT_OP_COLLECTOR]?.ref).toEqual(slw1[SLW_COLLECTOR]!);
        expect(slw1Op2?.[SLW_COLLECTOR]?.selections.size).toBe(1);
        expect(slw1Op2?.[SLW_COLLECTOR]?.selections.has("author")).toBeTrue();

        const op2AuthorSlw = slw1Op2?.[SLW_COLLECTOR]?.selections.get("author");
        expect(op2AuthorSlw?.[SLW_FIELD_NAME]).toBe("author");
        expect(op2AuthorSlw?.[SLW_FIELD_TYPENAME]).toBe("String");
        expect(op2AuthorSlw?.[SLW_FIELD_ARR_DEPTH]).toBe(0);
        expect(op2AuthorSlw?.[SLW_COLLECTOR]).toBeDefined();
        expect(op2AuthorSlw?.[SLW_PARENT_COLLECTOR]).toBeUndefined();
    });

    it("It should render valid selections (path / query / body locations)", () => {
        const slw1 = rootSLWFactory(examplesBooks._makeRootOperationInput, (op) => ({
            operation1: op.listBooks({ limit: 10 })(({ title }) => ({
                title,
            })),
            operation2: op.listBooks({})(({ author }) => ({
                author,
            })),
            mutation1: op.createBooks({
                titles: ["book1", "book2"],
                authors: ["author1", "author2"],
            })(({ title }) => ({
                title,
            })),
        }));

        expect(slw1[ROOT_OP_COLLECTOR]).toBeDefined();

        const op1 = slw1[ROOT_OP_COLLECTOR]!.ref.selections.get("operation1")!;
        expect(op1).toBeDefined();
        expect(op1[SLW_PARENT_COLLECTOR]).toBeDefined();

        const renderedOp1 = op1[SLW_PARENT_COLLECTOR]!.renderSelections([], [op1]);
        expect(renderedOp1.variables).toEqual({ limit: 10 });
        expect(renderedOp1.variableDefinitions).toEqual({
            limit: {
                type: "Integer",
                location: "query",
            },
        });

        const op2 = slw1[ROOT_OP_COLLECTOR]!.ref.selections.get("operation2")!;
        const renderedOp2 = op2[SLW_PARENT_COLLECTOR]!.renderSelections([], [op2]);
        expect(renderedOp2.variables).toEqual({});
        expect(renderedOp2.variableDefinitions).toEqual({});

        const mutation1 = slw1[ROOT_OP_COLLECTOR]!.ref.selections.get("mutation1")!;
        const renderedMutation1 = mutation1[SLW_PARENT_COLLECTOR]!.renderSelections([], [mutation1]);
        expect(renderedMutation1.variables).toEqual({
            titles: ["book1", "book2"],
            authors: ["author1", "author2"],
        });
        expect(renderedMutation1.variableDefinitions).toEqual({
            $body: {
                type: "createBooksRequestBodyInput!",
                location: "body",
            },
        });
    });

    it("should assign REST path / method / SSE meta to root operations", () => {
        const slw1 = rootSLWFactory(examplesBooks._makeRootOperationInput, (op) => ({
            operation1: op.listBooks({})(({ title }) => ({
                title,
            })),
            mutation1: op.createBooks({
                titles: ["book1"],
                authors: ["author1"],
            })(({ title }) => ({
                title,
            })),
        }));

        const op1 = slw1[ROOT_OP_COLLECTOR]!.ref.selections.get("operation1")!;
        expect(op1[ROOT_OP_META]).toEqual({
            path: "/books",
            method: "get",
            isEventStream: false,
        });

        const mutation1 = slw1[ROOT_OP_COLLECTOR]!.ref.selections.get("mutation1")!;
        expect(mutation1[ROOT_OP_META]).toEqual({
            path: "/books",
            method: "post",
            isEventStream: false,
        });

        const events = rootSLWFactory(examplesEvents._makeRootOperationInput, (op) => ({
            stream: op.onEvent()(({ id }) => ({ id })),
        }));
        const stream = events[ROOT_OP_COLLECTOR]!.ref.selections.get("stream")!;
        expect(stream[ROOT_OP_META]).toEqual({
            path: "/events",
            method: "get",
            isEventStream: true,
        });
    });
});

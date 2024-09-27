import { json, type LoaderFunction } from "@remix-run/node";
import { useLoaderData, Form, useSubmit } from "@remix-run/react";
import {
    getTodos,
    createTodo,
    toggleTodo,
    deleteTodo,
    type Todo,
} from "~/models/todo.server";

export const loader: LoaderFunction = async () => {
    return json({ todos: await getTodos() });
};

export default function Index() {
    const { todos } = useLoaderData<typeof loader>();
    const submit = useSubmit();

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Todo App</h1>
            <Form method="post" className="mb-4">
                <input
                    type="text"
                    name="text"
                    className="border p-2 mr-2"
                    required
                />
                <button
                    type="submit"
                    className="bg-blue-500 text-white p-2 rounded"
                >
                    Add Todo
                </button>
            </Form>
            <ul>
                {todos.map((todo: Todo) => (
                    <li key={todo.id} className="flex items-center mb-2">
                        <input
                            type="checkbox"
                            checked={todo.completed}
                            onChange={() =>
                                submit(
                                    { id: todo.id, completed: !todo.completed },
                                    { method: "put" },
                                )
                            }
                            className="mr-2"
                        />
                        <span className={todo.completed ? "line-through" : ""}>
                            {todo.text}
                        </span>
                        <button
                            onClick={() =>
                                submit({ id: todo.id }, { method: "delete" })
                            }
                            className="ml-2 text-red-500"
                        >
                            Delete
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export async function action({ request }: { request: Request }) {
    const formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (request.method === "POST") {
        await createTodo(values.text as string);
    } else if (request.method === "PUT") {
        await toggleTodo(values.id as string, values.completed === "true");
    } else if (request.method === "DELETE") {
        await deleteTodo(values.id as string);
    }

    return null;
}

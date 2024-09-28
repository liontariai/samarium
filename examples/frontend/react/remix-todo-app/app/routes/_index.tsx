import sdk from "sdk";
import useSWR from "swr";

export default function Index() {
    const { data: { todos } = { todos: [] }, mutate: mutateTodos } = useSWR(
        ["todos"],
        () =>
            sdk((op) =>
                op.query(({ todos }) => ({
                    todos: todos({})(({ id, text, completed }) => ({
                        id,
                        text,
                        completed,
                    })),
                })),
            ),
    );

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Todo App</h1>
            <div className="mb-4">
                <input
                    type="text"
                    name="text"
                    className="border p-2 mr-2"
                    required
                />
                <button
                    onClick={() =>
                        sdk((op) =>
                            op.mutation(({ createOneTodo }) => ({
                                created: createOneTodo({
                                    data: {
                                        text: "New Todo",
                                        completed: false,
                                    },
                                })(({ id }) => ({ id })),
                            })),
                        ).then(() => mutateTodos())
                    }
                    className="bg-blue-500 text-white p-2 rounded"
                >
                    Add Todo
                </button>
            </div>
            <ul>
                {todos?.map((todo: any) => (
                    <li key={todo.id} className="flex items-center mb-2">
                        <input
                            type="checkbox"
                            checked={todo.completed}
                            onChange={() =>
                                sdk((op) =>
                                    op.mutation(({ updateOneTodo }) => ({
                                        updated: updateOneTodo({
                                            data: {
                                                completed: {
                                                    set: !todo.completed,
                                                },
                                            },
                                            where: {
                                                id: todo.id,
                                            },
                                        })(({ id }) => ({ id })),
                                    })),
                                ).then(() => mutateTodos())
                            }
                            className="mr-2"
                        />
                        <span className={todo.completed ? "line-through" : ""}>
                            {todo.text}
                        </span>
                        <button
                            onClick={() =>
                                sdk((op) =>
                                    op.mutation(({ deleteOneTodo }) => ({
                                        deleted: deleteOneTodo({
                                            where: {
                                                id: todo.id,
                                            },
                                        })(({ id }) => ({ id })),
                                    })),
                                ).then(() => mutateTodos())
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

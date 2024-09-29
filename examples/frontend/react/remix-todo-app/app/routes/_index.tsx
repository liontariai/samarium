import sdk, { _ } from "sdk";
import useSWR from "swr";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const { getTodos, createTodo, updateTodo, deleteTodo } = sdk((op) => ({
    ...op.query(({ todos }) => ({
        getTodos: todos(_)(({ $scalars }) => ({ ...$scalars() })).$lazy,
    })),
    ...op.mutation(({ createOneTodo, updateOneTodo, deleteOneTodo }) => ({
        createTodo: createOneTodo(_)(({ id }) => ({ id })).$lazy,
        updateTodo: updateOneTodo(_)(({ id }) => ({ id })).$lazy,
        deleteTodo: deleteOneTodo(_)(({ id }) => ({ id })).$lazy,
    })),
}));

const TodoInput = ({
    todoText,
    setTodoText,
    handleAddTodo,
    showError,
}: {
    todoText: string;
    setTodoText: (text: string) => void;
    handleAddTodo: () => void;
    showError: boolean;
}) => (
    <div className="mb-6 relative">
        <input
            type="text"
            name="text"
            className="w-full border-2 border-gray-300 p-4 rounded-lg text-xl focus:outline-none focus:border-blue-500 transition duration-300"
            required
            value={todoText}
            onChange={(e) => setTodoText(e.target.value)}
            placeholder="What needs to be done?"
            onKeyDown={(e) => {
                if (e.key === "Enter") {
                    handleAddTodo();
                }
            }}
        />
        <AnimatePresence>
            {showError && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="absolute left-0 right-0 bottom-full mb-2 bg-white border-2 border-red-500 rounded-lg p-2 text-red-500 text-sm z-10 before:content-[''] before:absolute before:bottom-[-10px] before:left-1/2 before:-translate-x-1/2 before:translate-y-1/2 before:border-8 before:border-transparent before:border-t-red-500"
                >
                    Please enter a todo item!
                </motion.div>
            )}
        </AnimatePresence>
        <button
            onClick={handleAddTodo}
            className="w-full mt-4 bg-blue-500 hover:bg-blue-600 text-white text-xl font-bold p-4 rounded-lg transition duration-300 transform hover:scale-105"
        >
            Add Todo
        </button>
    </div>
);

const TrashIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
    </svg>
);
const TodoItem = ({
    todo,
    mutateTodos,
}: {
    todo: Awaited<ReturnType<typeof getTodos>>[number];
    mutateTodos: () => void;
}) => (
    <motion.li
        key={todo.id}
        initial={{
            opacity: 0,
            y: 20,
            backgroundColor: "rgb(59, 130, 246)",
            color: "rgb(255, 255, 255)",
        }}
        animate={{
            opacity: 1,
            y: 0,
            backgroundColor: "rgb(255, 255, 255)",
            color: "rgb(0, 0, 0)",
        }}
        exit={{
            opacity: 0,
            y: -20,
            backgroundColor: "rgb(59 130 246)",
            color: "rgb(255, 255, 255)",
        }}
        transition={{ duration: 0.5 }}
        className="flex items-center bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 border border-gray-200"
    >
        <input
            type="checkbox"
            checked={todo.completed}
            onChange={() =>
                updateTodo({
                    data: {
                        completed: {
                            set: !todo.completed,
                        },
                    },
                    where: { id: todo.id },
                }).then(() => mutateTodos())
            }
            className="form-checkbox h-5 w-5 text-blue-500 rounded-full border-2 border-gray-300 transition duration-150 ease-in-out focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        />
        <span
            className={`ml-3 text-lg ${
                todo.completed ? "line-through text-inherit" : "text-inherit"
            } transition-colors duration-300`}
        >
            {todo.text}
        </span>
        <button
            onClick={() =>
                deleteTodo({
                    where: { id: todo.id },
                }).then(() => mutateTodos())
            }
            className="ml-auto text-gray-400 hover:text-red-500 transition duration-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded-full p-1"
        >
            <TrashIcon />
        </button>
    </motion.li>
);

export default function Index() {
    const { data: todos, mutate: mutateTodos } = useSWR(["todos"], () =>
        getTodos({}),
    );

    const [todoText, setTodoText] = useState("");
    const [showError, setShowError] = useState(false);

    const handleAddTodo = () => {
        if (todoText.trim() === "") {
            setShowError(true);
            setTimeout(() => setShowError(false), 3000);
            return;
        }
        createTodo({
            data: { text: todoText, completed: false },
        })
            .then(() => mutateTodos())
            .then(() => setTodoText(""));
    };

    return (
        <div className="min-h-screen bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-2xl">
                <h1 className="text-4xl font-bold mb-8 text-center text-gray-800">
                    Beautiful Todo App
                </h1>
                <TodoInput
                    todoText={todoText}
                    setTodoText={setTodoText}
                    handleAddTodo={handleAddTodo}
                    showError={showError}
                />
                <ul className="space-y-4">
                    {todos
                        ?.sort((a, b) =>
                            a.completed ? 1 : b.completed ? -1 : 0,
                        )
                        .map((todo) => (
                            <TodoItem
                                key={todo.id}
                                todo={todo}
                                mutateTodos={mutateTodos}
                            />
                        ))}
                </ul>
            </div>
        </div>
    );
}

import { motion } from "framer-motion";
import { TrashIcon } from "@/components/icons/TrashIcon";
import type {
    getTodos as GetTodos,
    updateTodo as UpdateTodo,
    deleteTodo as DeleteTodo,
} from "./route";

export const TodoItem = ({
    todo,
    updateTodo,
    deleteTodo,
    mutateTodos,
    animate = true,
}: {
    todo: Awaited<ReturnType<typeof GetTodos>>[number];
    updateTodo: typeof UpdateTodo;
    deleteTodo: typeof DeleteTodo;
    mutateTodos: () => void;
    animate?: boolean;
}) => {
    const LI = animate ? motion.li : "li";
    return (
        <LI
            key={todo.id}
            initial={{
                opacity: 0,
                y: -20,
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
            <div className="flex flex-row items-center justify-between w-full px-4">
                <span
                    className={`ml-3 text-lg ${
                        todo.completed
                            ? "line-through text-inherit"
                            : "text-inherit"
                    } transition-colors duration-300`}
                >
                    {todo.text}
                </span>
                <span className="text-inherit">
                    {todo.createdAt.toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        hour: "numeric",
                        minute: "numeric",
                        second: "numeric",
                    })}
                </span>
            </div>
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
        </LI>
    );
};

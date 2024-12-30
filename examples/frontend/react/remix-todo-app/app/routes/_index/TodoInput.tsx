import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SearchIcon } from "@/components/icons/SearchIcon";
import { XIcon } from "@/components/icons/XIcon";

export const TodoInput = ({
    todoText,
    setTodoText,
    searchText,
    setSearchText,
    handleAddTodo,
    showError,
    setShowError,
}: {
    todoText: string;
    setTodoText: (text: string) => void;
    searchText: string;
    setSearchText: (text: string) => void;
    handleAddTodo: () => void;
    showError: boolean;
    setShowError: (show: boolean) => void;
}) => {
    const [showSearch, setShowSearch] = useState(false);
    return (
        <div className="mb-6 relative">
            <input
                type="text"
                name="text"
                className={
                    "w-full border-2 border-gray-300 p-4 rounded-lg text-xl focus:outline-none focus:border-blue-500 transition duration-300" +
                    (showSearch ? " bg-gray-200 text-gray-500" : "")
                }
                disabled={showSearch}
                required
                value={todoText}
                onChange={(e) => setTodoText(e.target.value)}
                placeholder="What needs to be done?"
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        handleAddTodo();
                    }
                }}
                onBlur={() => setShowError(false)}
                onFocus={() => setShowError(false)}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
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
            <div className="flex flex-row items-center justify-between gap-2">
                {showSearch ? (
                    <input
                        type="text"
                        name="text"
                        className="w-full mt-4 border-2 border-gray-300 p-4 rounded-lg text-xl focus:outline-none focus:border-blue-500 transition duration-300"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        placeholder="Search todos"
                    />
                ) : (
                    <button
                        onClick={handleAddTodo}
                        className="w-full h-16 mt-4 bg-blue-500 hover:bg-blue-600 text-white text-xl font-bold p-4 rounded-lg transition duration-300 transform hover:scale-105"
                    >
                        Add Todo
                    </button>
                )}
                <button
                    onClick={() => {
                        setShowSearch(!showSearch);
                        setSearchText("");
                    }}
                    className="w-12 h-12 mt-4 text-blue-500 text-xl font-bold p-4 rounded-lg scale-150"
                >
                    {showSearch ? <XIcon /> : <SearchIcon />}
                </button>
            </div>
        </div>
    );
};

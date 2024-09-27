import { prisma } from "~/db.server";

export type Todo = {
    id: string;
    text: string;
    completed: boolean;
};

export async function getTodos() {
    return prisma.todo.findMany({
        select: { id: true, text: true, completed: true },
        orderBy: { createdAt: "desc" },
    });
}

export async function createTodo(text: string) {
    return prisma.todo.create({
        data: { text, completed: false },
    });
}

export async function toggleTodo(id: string, completed: boolean) {
    return prisma.todo.update({
        where: { id },
        data: { completed },
    });
}

export async function deleteTodo(id: string) {
    return prisma.todo.delete({
        where: { id },
    });
}

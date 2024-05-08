import { type TypeMeta } from "./meta";

/**
 * Collects all recursively collected information during the code generation process.
 * This information is used to cut infinite loops in the code generation process.
 */
export class Collector {
    /**
     * The collected types.
     */
    private _types: Map<string, TypeMeta> = new Map();
    get types(): Map<string, TypeMeta> {
        return this._types;
    }
    public addType(type: TypeMeta): void {
        this._types.set(type.name, type);
    }
    public hasType(typeName: string): boolean {
        return this._types.has(typeName);
    }
    public getType(typeName: string): TypeMeta {
        return this._types.get(typeName)!;
    }

    /**
     * Collect generated code for a given type.
     * In this case, the generated Enum types.
     */
    private _enumsTypes: Map<TypeMeta, string> = new Map();
    get enumsTypes(): Map<TypeMeta, string> {
        return this._enumsTypes;
    }
    public addEnumType(type: TypeMeta, code: string): void {
        this._enumsTypes.set(type, code);
    }
    public hasEnumType(type?: TypeMeta): boolean {
        if (!type) {
            return false;
        }
        return this._enumsTypes.has(type);
    }
    public getEnumType(type: TypeMeta): string {
        return this._enumsTypes.get(type)!;
    }

    /**
     * Collect generated code for a given type.
     * In this case, the generated Argument types.
     */
    private _argumentTypes: Map<string, string> = new Map();
    get argumentTypes(): Map<string, string> {
        return this._argumentTypes;
    }
    public addArgumentType(typeName: string, code: string): void {
        this._argumentTypes.set(typeName, code);
    }
    public hasArgumentType(typeName: string): boolean {
        return this._argumentTypes.has(typeName);
    }
    public getArgumentType(typeName: string): string {
        return this._argumentTypes.get(typeName)!;
    }

    /**
     * Collect generated code for Argument Metadata.
     */
    private _argumentMeta: Map<string, string> = new Map();
    get argumentMeta(): Map<string, string> {
        return this._argumentMeta;
    }
    public addArgumentMeta(typeName: string, code: string): void {
        this._argumentMeta.set(typeName, code);
    }
    public hasArgumentMeta(typeName: string): boolean {
        return this._argumentMeta.has(typeName);
    }
    public getArgumentMeta(typeName: string): string {
        return this._argumentMeta.get(typeName)!;
    }

    /**
     * Collect generated code for a given type.
     * In this case, the generated SelectionType code.
     */
    private _selectionTypes: Map<TypeMeta, string> = new Map();
    get selectionTypes(): Map<TypeMeta, string> {
        return this._selectionTypes;
    }
    public addSelectionType(type: TypeMeta, code: string): void {
        this._selectionTypes.set(type, code);
    }
    public hasSelectionType(type?: TypeMeta): boolean {
        if (!type) {
            return false;
        }
        return this._selectionTypes.has(type);
    }
    public getSelectionType(type: TypeMeta): string {
        return this._selectionTypes.get(type)!;
    }

    /**
     * Collect generated code for a given type.
     * In this case, the generated SelectionFunction / SelectionFunctionInputObject code.
     */
    private _selectionFunctions: Map<TypeMeta, string> = new Map();
    get selectionFunctions(): Map<TypeMeta, string> {
        return this._selectionFunctions;
    }
    public addSelectionFunction(type: TypeMeta, code: string): void {
        this._selectionFunctions.set(type, code);
    }
    public hasSelectionFunction(type?: TypeMeta): boolean {
        if (!type) {
            return false;
        }
        return this._selectionFunctions.has(type);
    }
    public getSelectionFunction(type: TypeMeta): string {
        return this._selectionFunctions.get(type)!;
    }
}

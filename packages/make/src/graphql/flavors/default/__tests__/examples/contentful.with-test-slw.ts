import {
    OperationSelectionCollector,
    OPTIONS,
    RootOperation,
    SelectionWrapper,
    SelectionWrapperImpl,
    SLW_DIRECTIVE,
    SLW_DIRECTIVE_ARGS,
    SLW_DIRECTIVE_ARGS_META,
} from "@/graphql/flavors/default/wrapper";
import { makeSLFN, selectScalars } from "../utils";
import type {
    SelectionFnParent,
    SLWsFromSelection,
    Prettify,
    ArgumentsTypeFromFragment,
    CleanupNever,
    Prev,
    ToTArrayWithDepth,
    ReplaceReturnType,
    ReturnTypeFromFragment,
    SLFN,
    SLW_TPN_ToType,
    ScalarTypeMapDefault,
    ScalarTypeMapWithCustom,
} from "../utils/types";
export type ImageResizeStrategy = "FIT" | "PAD" | "FILL" | "SCALE" | "CROP" | "THUMB";
export enum ImageResizeStrategyEnum {
    /** Resizes the image to fit into the specified dimensions. */
    FIT = "FIT",
    /** Resizes the image to the specified dimensions, padding the image if needed.
        Uses desired background color as padding color. */
    PAD = "PAD",
    /** Resizes the image to the specified dimensions, cropping the image if needed. */
    FILL = "FILL",
    /** Resizes the image to the specified dimensions, changing the original aspect ratio if needed. */
    SCALE = "SCALE",
    /** Crops a part of the original image to fit into the specified dimensions. */
    CROP = "CROP",
    /** Creates a thumbnail from the image. */
    THUMB = "THUMB",
}

export type ImageResizeFocus =
    | "CENTER"
    | "TOP"
    | "TOP_RIGHT"
    | "RIGHT"
    | "BOTTOM_RIGHT"
    | "BOTTOM"
    | "BOTTOM_LEFT"
    | "LEFT"
    | "TOP_LEFT"
    | "FACE"
    | "FACES";
export enum ImageResizeFocusEnum {
    /** Focus the resizing on the center. */
    CENTER = "CENTER",
    /** Focus the resizing on the top. */
    TOP = "TOP",
    /** Focus the resizing on the top right. */
    TOP_RIGHT = "TOP_RIGHT",
    /** Focus the resizing on the right. */
    RIGHT = "RIGHT",
    /** Focus the resizing on the bottom right. */
    BOTTOM_RIGHT = "BOTTOM_RIGHT",
    /** Focus the resizing on the bottom. */
    BOTTOM = "BOTTOM",
    /** Focus the resizing on the bottom left. */
    BOTTOM_LEFT = "BOTTOM_LEFT",
    /** Focus the resizing on the left. */
    LEFT = "LEFT",
    /** Focus the resizing on the top left. */
    TOP_LEFT = "TOP_LEFT",
    /** Focus the resizing on the largest face. */
    FACE = "FACE",
    /** Focus the resizing on the area containing all the faces. */
    FACES = "FACES",
}

export type ImageFormat = "JPG" | "JPG_PROGRESSIVE" | "PNG" | "PNG8" | "WEBP" | "AVIF";
export enum ImageFormatEnum {
    /** JPG image format. */
    JPG = "JPG",
    /** Progressive JPG format stores multiple passes of an image in progressively higher detail.
        When a progressive image is loading, the viewer will first see a lower quality pixelated version which
        will gradually improve in detail, until the image is fully downloaded. This is to display an image as
        early as possible to make the layout look as designed. */
    JPG_PROGRESSIVE = "JPG_PROGRESSIVE",
    /** PNG image format */
    PNG = "PNG",
    /** 8-bit PNG images support up to 256 colors and weigh less than the standard 24-bit PNG equivalent.
        The 8-bit PNG format is mostly used for simple images, such as icons or logos. */
    PNG8 = "PNG8",
    /** WebP image format. */
    WEBP = "WEBP",
    AVIF = "AVIF",
}

export type AssetOrder =
    | "url_ASC"
    | "url_DESC"
    | "size_ASC"
    | "size_DESC"
    | "contentType_ASC"
    | "contentType_DESC"
    | "fileName_ASC"
    | "fileName_DESC"
    | "width_ASC"
    | "width_DESC"
    | "height_ASC"
    | "height_DESC"
    | "sys_id_ASC"
    | "sys_id_DESC"
    | "sys_publishedAt_ASC"
    | "sys_publishedAt_DESC"
    | "sys_firstPublishedAt_ASC"
    | "sys_firstPublishedAt_DESC"
    | "sys_publishedVersion_ASC"
    | "sys_publishedVersion_DESC";
export enum AssetOrderEnum {
    url_ASC = "url_ASC",
    url_DESC = "url_DESC",
    size_ASC = "size_ASC",
    size_DESC = "size_DESC",
    contentType_ASC = "contentType_ASC",
    contentType_DESC = "contentType_DESC",
    fileName_ASC = "fileName_ASC",
    fileName_DESC = "fileName_DESC",
    width_ASC = "width_ASC",
    width_DESC = "width_DESC",
    height_ASC = "height_ASC",
    height_DESC = "height_DESC",
    sys_id_ASC = "sys_id_ASC",
    sys_id_DESC = "sys_id_DESC",
    sys_publishedAt_ASC = "sys_publishedAt_ASC",
    sys_publishedAt_DESC = "sys_publishedAt_DESC",
    sys_firstPublishedAt_ASC = "sys_firstPublishedAt_ASC",
    sys_firstPublishedAt_DESC = "sys_firstPublishedAt_DESC",
    sys_publishedVersion_ASC = "sys_publishedVersion_ASC",
    sys_publishedVersion_DESC = "sys_publishedVersion_DESC",
}

export type TestOrder =
    | "sys_id_ASC"
    | "sys_id_DESC"
    | "sys_publishedAt_ASC"
    | "sys_publishedAt_DESC"
    | "sys_firstPublishedAt_ASC"
    | "sys_firstPublishedAt_DESC"
    | "sys_publishedVersion_ASC"
    | "sys_publishedVersion_DESC";
export enum TestOrderEnum {
    sys_id_ASC = "sys_id_ASC",
    sys_id_DESC = "sys_id_DESC",
    sys_publishedAt_ASC = "sys_publishedAt_ASC",
    sys_publishedAt_DESC = "sys_publishedAt_DESC",
    sys_firstPublishedAt_ASC = "sys_firstPublishedAt_ASC",
    sys_firstPublishedAt_DESC = "sys_firstPublishedAt_DESC",
    sys_publishedVersion_ASC = "sys_publishedVersion_ASC",
    sys_publishedVersion_DESC = "sys_publishedVersion_DESC",
}

export type EntryOrder =
    | "sys_id_ASC"
    | "sys_id_DESC"
    | "sys_publishedAt_ASC"
    | "sys_publishedAt_DESC"
    | "sys_firstPublishedAt_ASC"
    | "sys_firstPublishedAt_DESC"
    | "sys_publishedVersion_ASC"
    | "sys_publishedVersion_DESC";
export enum EntryOrderEnum {
    sys_id_ASC = "sys_id_ASC",
    sys_id_DESC = "sys_id_DESC",
    sys_publishedAt_ASC = "sys_publishedAt_ASC",
    sys_publishedAt_DESC = "sys_publishedAt_DESC",
    sys_firstPublishedAt_ASC = "sys_firstPublishedAt_ASC",
    sys_firstPublishedAt_DESC = "sys_firstPublishedAt_DESC",
    sys_publishedVersion_ASC = "sys_publishedVersion_ASC",
    sys_publishedVersion_DESC = "sys_publishedVersion_DESC",
}

export type Directive_includeArgs = {
    /** Included when true. */
    if: boolean;
};
export type Directive_skipArgs = {
    /** Skipped when true. */
    if: boolean;
};
export type AssetTitleArgs = {
    locale?: string;
};
export type AssetDescriptionArgs = {
    locale?: string;
};
export type AssetContentTypeArgs = {
    locale?: string;
};
export type AssetFileNameArgs = {
    locale?: string;
};
export type AssetSizeArgs = {
    locale?: string;
};
export type AssetUrlArgs = {
    transform?: ImageTransformOptions;
    locale?: string;
};
export type AssetWidthArgs = {
    locale?: string;
};
export type AssetHeightArgs = {
    locale?: string;
};
export type AssetLinkedFromArgs = {
    allowedLocales?: any;
};
export type AssetLinkingCollectionsEntryCollectionArgs = {
    skip?: number;
    limit?: number;
    preview?: boolean;
    locale?: string;
};
export type AssetArrayNotNullTitleArgs = {
    locale?: string;
};
export type AssetArrayNotNullDescriptionArgs = {
    locale?: string;
};
export type AssetArrayNotNullContentTypeArgs = {
    locale?: string;
};
export type AssetArrayNotNullFileNameArgs = {
    locale?: string;
};
export type AssetArrayNotNullSizeArgs = {
    locale?: string;
};
export type AssetArrayNotNullUrlArgs = {
    transform?: ImageTransformOptions;
    locale?: string;
};
export type AssetArrayNotNullWidthArgs = {
    locale?: string;
};
export type AssetArrayNotNullHeightArgs = {
    locale?: string;
};
export type AssetArrayNotNullLinkedFromArgs = {
    allowedLocales?: any;
};
export type TestLinkedFromArgs = {
    allowedLocales?: any;
};
export type TestTestArgs = {
    locale?: string;
};
export type TestLinkingCollectionsEntryCollectionArgs = {
    skip?: number;
    limit?: number;
    preview?: boolean;
    locale?: string;
};
export type TestArrayNotNullLinkedFromArgs = {
    allowedLocales?: any;
};
export type TestArrayNotNullTestArgs = {
    locale?: string;
};
export type QueryAssetArgs = {
    id: string;
    preview?: boolean;
    locale?: string;
};
export type QueryAssetCollectionArgs = {
    skip?: number;
    limit?: number;
    preview?: boolean;
    locale?: string;
    where?: AssetFilter;
    order?: AssetOrder[];
};
export type QueryTestArgs = {
    id: string;
    preview?: boolean;
    locale?: string;
};
export type QueryTestCollectionArgs = {
    skip?: number;
    limit?: number;
    preview?: boolean;
    locale?: string;
    where?: TestFilter;
    order?: TestOrder[];
};
export type QueryEntryCollectionArgs = {
    skip?: number;
    limit?: number;
    preview?: boolean;
    locale?: string;
    where?: EntryFilter;
    order?: EntryOrder[];
};
export type Query_nodeArgs = {
    id: string;
    preview?: boolean;
    locale?: string;
};
export const Directive_includeArgsMeta = { if: "Boolean!" } as const;
export const Directive_skipArgsMeta = { if: "Boolean!" } as const;
export const AssetLinkingCollectionsEntryCollectionArgsMeta = {
    skip: "Int",
    limit: "Int",
    preview: "Boolean",
    locale: "String",
} as const;
export const AssetTitleArgsMeta = { locale: "String" } as const;
export const AssetDescriptionArgsMeta = { locale: "String" } as const;
export const AssetContentTypeArgsMeta = { locale: "String" } as const;
export const AssetFileNameArgsMeta = { locale: "String" } as const;
export const AssetSizeArgsMeta = { locale: "String" } as const;
export const AssetUrlArgsMeta = {
    transform: "ImageTransformOptions",
    locale: "String",
} as const;
export const AssetWidthArgsMeta = { locale: "String" } as const;
export const AssetHeightArgsMeta = { locale: "String" } as const;
export const AssetLinkedFromArgsMeta = { allowedLocales: "[String]" } as const;
export const AssetArrayNotNullTitleArgsMeta = { locale: "String" } as const;
export const AssetArrayNotNullDescriptionArgsMeta = {
    locale: "String",
} as const;
export const AssetArrayNotNullContentTypeArgsMeta = {
    locale: "String",
} as const;
export const AssetArrayNotNullFileNameArgsMeta = { locale: "String" } as const;
export const AssetArrayNotNullSizeArgsMeta = { locale: "String" } as const;
export const AssetArrayNotNullUrlArgsMeta = {
    transform: "ImageTransformOptions",
    locale: "String",
} as const;
export const AssetArrayNotNullWidthArgsMeta = { locale: "String" } as const;
export const AssetArrayNotNullHeightArgsMeta = { locale: "String" } as const;
export const AssetArrayNotNullLinkedFromArgsMeta = {
    allowedLocales: "[String]",
} as const;
export const TestLinkingCollectionsEntryCollectionArgsMeta = {
    skip: "Int",
    limit: "Int",
    preview: "Boolean",
    locale: "String",
} as const;
export const TestLinkedFromArgsMeta = { allowedLocales: "[String]" } as const;
export const TestTestArgsMeta = { locale: "String" } as const;
export const TestArrayNotNullLinkedFromArgsMeta = {
    allowedLocales: "[String]",
} as const;
export const TestArrayNotNullTestArgsMeta = { locale: "String" } as const;
export const QueryAssetArgsMeta = {
    id: "String!",
    preview: "Boolean",
    locale: "String",
} as const;
export const QueryAssetCollectionArgsMeta = {
    skip: "Int",
    limit: "Int",
    preview: "Boolean",
    locale: "String",
    where: "AssetFilter",
    order: "[AssetOrder]",
} as const;
export const QueryTestArgsMeta = {
    id: "String!",
    preview: "Boolean",
    locale: "String",
} as const;
export const QueryTestCollectionArgsMeta = {
    skip: "Int",
    limit: "Int",
    preview: "Boolean",
    locale: "String",
    where: "TestFilter",
    order: "[TestOrder]",
} as const;
export const QueryEntryCollectionArgsMeta = {
    skip: "Int",
    limit: "Int",
    preview: "Boolean",
    locale: "String",
    where: "EntryFilter",
    order: "[EntryOrder]",
} as const;
export const Query_nodeArgsMeta = {
    id: "ID!",
    preview: "Boolean",
    locale: "String",
} as const;

export type ImageTransformOptions = {
    /* Desired width in pixels. Defaults to the original image width. */
    width?: any;
    /* Desired height in pixels. Defaults to the original image height. */
    height?: any;
    /* Desired quality of the image in percents.
        Used for `PNG8`, `JPG`, `JPG_PROGRESSIVE` and `WEBP` formats. */
    quality?: any;
    /* Desired corner radius in pixels.
        Results in an image with rounded corners (pass `-1` for a full circle/ellipse).
        Defaults to `0`. Uses desired background color as padding color,
        unless the format is `JPG` or `JPG_PROGRESSIVE` and resize strategy is `PAD`, then defaults to white. */
    cornerRadius?: number;
    /* Desired resize strategy. Defaults to `FIT`. */
    resizeStrategy?: any;
    /* Desired resize focus area. Defaults to `CENTER`. */
    resizeFocus?: any;
    /* Desired background color, used with corner radius or `PAD` resize strategy.
        Defaults to transparent (for `PNG`, `PNG8` and `WEBP`) or white (for `JPG` and `JPG_PROGRESSIVE`). */
    backgroundColor?: any;
    /* Desired image format. Defaults to the original image format. */
    format?: any;
};

export type AssetFilter = {
    sys?: SysFilter;
    contentfulMetadata?: ContentfulMetadataFilter;
    title_exists?: boolean;
    title?: string;
    title_not?: string;
    title_in?: Array<string>;
    title_not_in?: Array<string>;
    title_contains?: string;
    title_not_contains?: string;
    description_exists?: boolean;
    description?: string;
    description_not?: string;
    description_in?: Array<string>;
    description_not_in?: Array<string>;
    description_contains?: string;
    description_not_contains?: string;
    url_exists?: boolean;
    url?: string;
    url_not?: string;
    url_in?: Array<string>;
    url_not_in?: Array<string>;
    url_contains?: string;
    url_not_contains?: string;
    size_exists?: boolean;
    size?: number;
    size_not?: number;
    size_in?: Array<number>;
    size_not_in?: Array<number>;
    size_gt?: number;
    size_gte?: number;
    size_lt?: number;
    size_lte?: number;
    contentType_exists?: boolean;
    contentType?: string;
    contentType_not?: string;
    contentType_in?: Array<string>;
    contentType_not_in?: Array<string>;
    contentType_contains?: string;
    contentType_not_contains?: string;
    fileName_exists?: boolean;
    fileName?: string;
    fileName_not?: string;
    fileName_in?: Array<string>;
    fileName_not_in?: Array<string>;
    fileName_contains?: string;
    fileName_not_contains?: string;
    width_exists?: boolean;
    width?: number;
    width_not?: number;
    width_in?: Array<number>;
    width_not_in?: Array<number>;
    width_gt?: number;
    width_gte?: number;
    width_lt?: number;
    width_lte?: number;
    height_exists?: boolean;
    height?: number;
    height_not?: number;
    height_in?: Array<number>;
    height_not_in?: Array<number>;
    height_gt?: number;
    height_gte?: number;
    height_lt?: number;
    height_lte?: number;
    OR?: AssetFilter[];
    AND?: AssetFilter[];
};

export type SysFilter = {
    id_exists?: boolean;
    id?: string;
    id_not?: string;
    id_in?: Array<string>;
    id_not_in?: Array<string>;
    id_contains?: string;
    id_not_contains?: string;
    publishedAt_exists?: boolean;
    publishedAt?: Date;
    publishedAt_not?: Date;
    publishedAt_in?: Array<Date>;
    publishedAt_not_in?: Array<Date>;
    publishedAt_gt?: Date;
    publishedAt_gte?: Date;
    publishedAt_lt?: Date;
    publishedAt_lte?: Date;
    firstPublishedAt_exists?: boolean;
    firstPublishedAt?: Date;
    firstPublishedAt_not?: Date;
    firstPublishedAt_in?: Array<Date>;
    firstPublishedAt_not_in?: Array<Date>;
    firstPublishedAt_gt?: Date;
    firstPublishedAt_gte?: Date;
    firstPublishedAt_lt?: Date;
    firstPublishedAt_lte?: Date;
    publishedVersion_exists?: boolean;
    publishedVersion?: number;
    publishedVersion_not?: number;
    publishedVersion_in?: Array<number>;
    publishedVersion_not_in?: Array<number>;
    publishedVersion_gt?: number;
    publishedVersion_gte?: number;
    publishedVersion_lt?: number;
    publishedVersion_lte?: number;
};

export type ContentfulMetadataFilter = {
    tags_exists?: boolean;
    tags?: ContentfulMetadataTagsFilter;
};

export type ContentfulMetadataTagsFilter = {
    id_contains_all?: Array<string>;
    id_contains_some?: Array<string>;
    id_contains_none?: Array<string>;
};

export type TestFilter = {
    sys?: SysFilter;
    contentfulMetadata?: ContentfulMetadataFilter;
    test_exists?: boolean;
    test_contains?: string;
    test_not_contains?: string;
    OR?: TestFilter[];
    AND?: TestFilter[];
};

export type EntryFilter = {
    sys?: SysFilter;
    contentfulMetadata?: ContentfulMetadataFilter;
    OR?: EntryFilter[];
    AND?: EntryFilter[];
};

type ReturnTypeFromSysNotNullSelection = {
    id: SelectionWrapper<"id", "String", 0, {}, undefined>;
    spaceId: SelectionWrapper<"spaceId", "String", 0, {}, undefined>;
    environmentId: SelectionWrapper<"environmentId", "String", 0, {}, undefined>;
    publishedAt: SelectionWrapper<"publishedAt", "DateTime", 0, {}, undefined>;
    firstPublishedAt: SelectionWrapper<"firstPublishedAt", "DateTime", 0, {}, undefined>;
    publishedVersion: SelectionWrapper<"publishedVersion", "Int", 0, {}, undefined>;
    locale: SelectionWrapper<"locale", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<ReturnType<typeof makeSysNotNullSelectionInput>>;
};

export function makeSysNotNullSelectionInput(this: any): ReturnTypeFromSysNotNullSelection {
    return {
        id: new SelectionWrapper("id", "String", 0, {}, this, undefined),
        spaceId: new SelectionWrapper("spaceId", "String", 0, {}, this, undefined),
        environmentId: new SelectionWrapper("environmentId", "String", 0, {}, this, undefined),
        publishedAt: new SelectionWrapper("publishedAt", "DateTime", 0, {}, this, undefined),
        firstPublishedAt: new SelectionWrapper("firstPublishedAt", "DateTime", 0, {}, this, undefined),
        publishedVersion: new SelectionWrapper("publishedVersion", "Int", 0, {}, this, undefined),
        locale: new SelectionWrapper("locale", "String", 0, {}, this, undefined),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(makeSysNotNullSelectionInput.bind(this)()) as SLWsFromSelection<
                ReturnType<typeof makeSysNotNullSelectionInput>
            >,
    } as const;
}
export const SysNotNullSelection = makeSLFN(makeSysNotNullSelectionInput, "SysNotNullSelection", "Sys", 0);

type ReturnTypeFromContentfulMetadataNotNullSelection = {
    tags: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeContentfulTagArrayNotNullSelectionInput>,
            "ContentfulTagArrayNotNullSelection",
            "ContentfulTag",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeContentfulMetadataNotNullSelectionInput(
    this: any,
): ReturnTypeFromContentfulMetadataNotNullSelection {
    return {
        tags: ContentfulTagArrayNotNullSelection.bind({
            collector: this,
            fieldName: "tags",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,
    } as const;
}
export const ContentfulMetadataNotNullSelection = makeSLFN(
    makeContentfulMetadataNotNullSelectionInput,
    "ContentfulMetadataNotNullSelection",
    "ContentfulMetadata",
    0,
);

type ReturnTypeFromContentfulTagArrayNotNullSelection = {
    id: SelectionWrapper<"id", "String", 0, {}, undefined>;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<ReturnType<typeof makeContentfulTagArrayNotNullSelectionInput>>;
};

export function makeContentfulTagArrayNotNullSelectionInput(
    this: any,
): ReturnTypeFromContentfulTagArrayNotNullSelection {
    return {
        id: new SelectionWrapper("id", "String", 0, {}, this, undefined),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(makeContentfulTagArrayNotNullSelectionInput.bind(this)()) as SLWsFromSelection<
                ReturnType<typeof makeContentfulTagArrayNotNullSelectionInput>
            >,
    } as const;
}
export const ContentfulTagArrayNotNullSelection = makeSLFN(
    makeContentfulTagArrayNotNullSelectionInput,
    "ContentfulTagArrayNotNullSelection",
    "ContentfulTag",
    1,
);

type ReturnTypeFromAssetLinkingCollectionsSelection = {
    entryCollection: (args: AssetLinkingCollectionsEntryCollectionArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeEntryCollectionSelectionInput>,
            "EntryCollectionSelection",
            "EntryCollection",
            0,
            {
                $lazy: (args: AssetLinkingCollectionsEntryCollectionArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeAssetLinkingCollectionsSelectionInput(this: any): ReturnTypeFromAssetLinkingCollectionsSelection {
    return {
        entryCollection: (args: AssetLinkingCollectionsEntryCollectionArgs) =>
            EntryCollectionSelection.bind({
                collector: this,
                fieldName: "entryCollection",
                args,
                argsMeta: AssetLinkingCollectionsEntryCollectionArgsMeta,
            }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,
    } as const;
}
export const AssetLinkingCollectionsSelection = makeSLFN(
    makeAssetLinkingCollectionsSelectionInput,
    "AssetLinkingCollectionsSelection",
    "AssetLinkingCollections",
    0,
);

type ReturnTypeFromEntryCollectionSelection = {
    total: SelectionWrapper<"total", "Int", 0, {}, undefined>;
    skip: SelectionWrapper<"skip", "Int", 0, {}, undefined>;
    limit: SelectionWrapper<"limit", "Int", 0, {}, undefined>;
    items: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeEntryArrayNotNullSelectionInput>,
            "EntryArrayNotNullSelection",
            "Entry",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<ReturnType<typeof makeEntryCollectionSelectionInput>>;
};

export function makeEntryCollectionSelectionInput(this: any): ReturnTypeFromEntryCollectionSelection {
    return {
        total: new SelectionWrapper("total", "Int", 0, {}, this, undefined),
        skip: new SelectionWrapper("skip", "Int", 0, {}, this, undefined),
        limit: new SelectionWrapper("limit", "Int", 0, {}, this, undefined),
        items: EntryArrayNotNullSelection.bind({
            collector: this,
            fieldName: "items",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(makeEntryCollectionSelectionInput.bind(this)()) as SLWsFromSelection<
                ReturnType<typeof makeEntryCollectionSelectionInput>
            >,
    } as const;
}
export const EntryCollectionSelection = makeSLFN(
    makeEntryCollectionSelectionInput,
    "EntryCollectionSelection",
    "EntryCollection",
    0,
);

type ReturnTypeFromEntryArrayNotNullSelection = {
    sys: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeSysNotNullSelectionInput>,
            "SysNotNullSelection",
            "Sys",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    contentfulMetadata: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeContentfulMetadataNotNullSelectionInput>,
            "ContentfulMetadataNotNullSelection",
            "ContentfulMetadata",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeEntryArrayNotNullSelectionInput(this: any): ReturnTypeFromEntryArrayNotNullSelection {
    return {
        sys: SysNotNullSelection.bind({ collector: this, fieldName: "sys" }),
        contentfulMetadata: ContentfulMetadataNotNullSelection.bind({
            collector: this,
            fieldName: "contentfulMetadata",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,
    } as const;
}
export const EntryArrayNotNullSelection = makeSLFN(
    makeEntryArrayNotNullSelectionInput,
    "EntryArrayNotNullSelection",
    "Entry",
    1,
);

type ReturnTypeFromAssetSelection = {
    sys: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeSysNotNullSelectionInput>,
            "SysNotNullSelection",
            "Sys",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    contentfulMetadata: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeContentfulMetadataNotNullSelectionInput>,
            "ContentfulMetadataNotNullSelection",
            "ContentfulMetadata",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    title: (args: AssetTitleArgs) => SelectionWrapper<"title", "String", 0, {}, AssetTitleArgs>;
    description: (args: AssetDescriptionArgs) => SelectionWrapper<"description", "String", 0, {}, AssetDescriptionArgs>;
    contentType: (args: AssetContentTypeArgs) => SelectionWrapper<"contentType", "String", 0, {}, AssetContentTypeArgs>;
    fileName: (args: AssetFileNameArgs) => SelectionWrapper<"fileName", "String", 0, {}, AssetFileNameArgs>;
    size: (args: AssetSizeArgs) => SelectionWrapper<"size", "Int", 0, {}, AssetSizeArgs>;
    url: (args: AssetUrlArgs) => SelectionWrapper<"url", "String", 0, {}, AssetUrlArgs>;
    width: (args: AssetWidthArgs) => SelectionWrapper<"width", "Int", 0, {}, AssetWidthArgs>;
    height: (args: AssetHeightArgs) => SelectionWrapper<"height", "Int", 0, {}, AssetHeightArgs>;
    linkedFrom: (args: AssetLinkedFromArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeAssetLinkingCollectionsSelectionInput>,
            "AssetLinkingCollectionsSelection",
            "AssetLinkingCollections",
            0,
            {
                $lazy: (args: AssetLinkedFromArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<ReturnType<typeof makeAssetSelectionInput>>;
};

export function makeAssetSelectionInput(this: any): ReturnTypeFromAssetSelection {
    return {
        sys: SysNotNullSelection.bind({ collector: this, fieldName: "sys" }),
        contentfulMetadata: ContentfulMetadataNotNullSelection.bind({
            collector: this,
            fieldName: "contentfulMetadata",
        }),
        title: (args: AssetTitleArgs) =>
            new SelectionWrapper("title", "String", 0, {}, this, undefined, args, AssetTitleArgsMeta),
        description: (args: AssetDescriptionArgs) =>
            new SelectionWrapper("description", "String", 0, {}, this, undefined, args, AssetDescriptionArgsMeta),
        contentType: (args: AssetContentTypeArgs) =>
            new SelectionWrapper("contentType", "String", 0, {}, this, undefined, args, AssetContentTypeArgsMeta),
        fileName: (args: AssetFileNameArgs) =>
            new SelectionWrapper("fileName", "String", 0, {}, this, undefined, args, AssetFileNameArgsMeta),
        size: (args: AssetSizeArgs) =>
            new SelectionWrapper("size", "Int", 0, {}, this, undefined, args, AssetSizeArgsMeta),
        url: (args: AssetUrlArgs) =>
            new SelectionWrapper("url", "String", 0, {}, this, undefined, args, AssetUrlArgsMeta),
        width: (args: AssetWidthArgs) =>
            new SelectionWrapper("width", "Int", 0, {}, this, undefined, args, AssetWidthArgsMeta),
        height: (args: AssetHeightArgs) =>
            new SelectionWrapper("height", "Int", 0, {}, this, undefined, args, AssetHeightArgsMeta),
        linkedFrom: (args: AssetLinkedFromArgs) =>
            AssetLinkingCollectionsSelection.bind({
                collector: this,
                fieldName: "linkedFrom",
                args,
                argsMeta: AssetLinkedFromArgsMeta,
            }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(makeAssetSelectionInput.bind(this)()) as SLWsFromSelection<
                ReturnType<typeof makeAssetSelectionInput>
            >,
    } as const;
}
export const AssetSelection = makeSLFN(makeAssetSelectionInput, "AssetSelection", "Asset", 0);

type ReturnTypeFromAssetArrayNotNullSelection = {
    sys: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeSysNotNullSelectionInput>,
            "SysNotNullSelection",
            "Sys",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    contentfulMetadata: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeContentfulMetadataNotNullSelectionInput>,
            "ContentfulMetadataNotNullSelection",
            "ContentfulMetadata",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    title: (args: AssetArrayNotNullTitleArgs) => SelectionWrapper<"title", "String", 0, {}, AssetArrayNotNullTitleArgs>;
    description: (
        args: AssetArrayNotNullDescriptionArgs,
    ) => SelectionWrapper<"description", "String", 0, {}, AssetArrayNotNullDescriptionArgs>;
    contentType: (
        args: AssetArrayNotNullContentTypeArgs,
    ) => SelectionWrapper<"contentType", "String", 0, {}, AssetArrayNotNullContentTypeArgs>;
    fileName: (
        args: AssetArrayNotNullFileNameArgs,
    ) => SelectionWrapper<"fileName", "String", 0, {}, AssetArrayNotNullFileNameArgs>;
    size: (args: AssetArrayNotNullSizeArgs) => SelectionWrapper<"size", "Int", 0, {}, AssetArrayNotNullSizeArgs>;
    url: (args: AssetArrayNotNullUrlArgs) => SelectionWrapper<"url", "String", 0, {}, AssetArrayNotNullUrlArgs>;
    width: (args: AssetArrayNotNullWidthArgs) => SelectionWrapper<"width", "Int", 0, {}, AssetArrayNotNullWidthArgs>;
    height: (
        args: AssetArrayNotNullHeightArgs,
    ) => SelectionWrapper<"height", "Int", 0, {}, AssetArrayNotNullHeightArgs>;
    linkedFrom: (args: AssetArrayNotNullLinkedFromArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeAssetLinkingCollectionsSelectionInput>,
            "AssetLinkingCollectionsSelection",
            "AssetLinkingCollections",
            0,
            {
                $lazy: (args: AssetArrayNotNullLinkedFromArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<ReturnType<typeof makeAssetArrayNotNullSelectionInput>>;
};

export function makeAssetArrayNotNullSelectionInput(this: any): ReturnTypeFromAssetArrayNotNullSelection {
    return {
        sys: SysNotNullSelection.bind({ collector: this, fieldName: "sys" }),
        contentfulMetadata: ContentfulMetadataNotNullSelection.bind({
            collector: this,
            fieldName: "contentfulMetadata",
        }),
        title: (args: AssetArrayNotNullTitleArgs) =>
            new SelectionWrapper("title", "String", 0, {}, this, undefined, args, AssetArrayNotNullTitleArgsMeta),
        description: (args: AssetArrayNotNullDescriptionArgs) =>
            new SelectionWrapper(
                "description",
                "String",
                0,
                {},
                this,
                undefined,
                args,
                AssetArrayNotNullDescriptionArgsMeta,
            ),
        contentType: (args: AssetArrayNotNullContentTypeArgs) =>
            new SelectionWrapper(
                "contentType",
                "String",
                0,
                {},
                this,
                undefined,
                args,
                AssetArrayNotNullContentTypeArgsMeta,
            ),
        fileName: (args: AssetArrayNotNullFileNameArgs) =>
            new SelectionWrapper("fileName", "String", 0, {}, this, undefined, args, AssetArrayNotNullFileNameArgsMeta),
        size: (args: AssetArrayNotNullSizeArgs) =>
            new SelectionWrapper("size", "Int", 0, {}, this, undefined, args, AssetArrayNotNullSizeArgsMeta),
        url: (args: AssetArrayNotNullUrlArgs) =>
            new SelectionWrapper("url", "String", 0, {}, this, undefined, args, AssetArrayNotNullUrlArgsMeta),
        width: (args: AssetArrayNotNullWidthArgs) =>
            new SelectionWrapper("width", "Int", 0, {}, this, undefined, args, AssetArrayNotNullWidthArgsMeta),
        height: (args: AssetArrayNotNullHeightArgs) =>
            new SelectionWrapper("height", "Int", 0, {}, this, undefined, args, AssetArrayNotNullHeightArgsMeta),
        linkedFrom: (args: AssetArrayNotNullLinkedFromArgs) =>
            AssetLinkingCollectionsSelection.bind({
                collector: this,
                fieldName: "linkedFrom",
                args,
                argsMeta: AssetArrayNotNullLinkedFromArgsMeta,
            }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(makeAssetArrayNotNullSelectionInput.bind(this)()) as SLWsFromSelection<
                ReturnType<typeof makeAssetArrayNotNullSelectionInput>
            >,
    } as const;
}
export const AssetArrayNotNullSelection = makeSLFN(
    makeAssetArrayNotNullSelectionInput,
    "AssetArrayNotNullSelection",
    "Asset",
    1,
);

type ReturnTypeFromAssetCollectionSelection = {
    total: SelectionWrapper<"total", "Int", 0, {}, undefined>;
    skip: SelectionWrapper<"skip", "Int", 0, {}, undefined>;
    limit: SelectionWrapper<"limit", "Int", 0, {}, undefined>;
    items: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeAssetArrayNotNullSelectionInput>,
            "AssetArrayNotNullSelection",
            "Asset",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<ReturnType<typeof makeAssetCollectionSelectionInput>>;
};

export function makeAssetCollectionSelectionInput(this: any): ReturnTypeFromAssetCollectionSelection {
    return {
        total: new SelectionWrapper("total", "Int", 0, {}, this, undefined),
        skip: new SelectionWrapper("skip", "Int", 0, {}, this, undefined),
        limit: new SelectionWrapper("limit", "Int", 0, {}, this, undefined),
        items: AssetArrayNotNullSelection.bind({
            collector: this,
            fieldName: "items",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(makeAssetCollectionSelectionInput.bind(this)()) as SLWsFromSelection<
                ReturnType<typeof makeAssetCollectionSelectionInput>
            >,
    } as const;
}
export const AssetCollectionSelection = makeSLFN(
    makeAssetCollectionSelectionInput,
    "AssetCollectionSelection",
    "AssetCollection",
    0,
);

type ReturnTypeFromTestLinkingCollectionsSelection = {
    entryCollection: (args: TestLinkingCollectionsEntryCollectionArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeEntryCollectionSelectionInput>,
            "EntryCollectionSelection",
            "EntryCollection",
            0,
            {
                $lazy: (args: TestLinkingCollectionsEntryCollectionArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeTestLinkingCollectionsSelectionInput(this: any): ReturnTypeFromTestLinkingCollectionsSelection {
    return {
        entryCollection: (args: TestLinkingCollectionsEntryCollectionArgs) =>
            EntryCollectionSelection.bind({
                collector: this,
                fieldName: "entryCollection",
                args,
                argsMeta: TestLinkingCollectionsEntryCollectionArgsMeta,
            }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,
    } as const;
}
export const TestLinkingCollectionsSelection = makeSLFN(
    makeTestLinkingCollectionsSelectionInput,
    "TestLinkingCollectionsSelection",
    "TestLinkingCollections",
    0,
);

type ReturnTypeFromTestTestSelection = {
    json: SelectionWrapper<"json", "JSON", 0, {}, undefined>;
    links: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTestTestLinksNotNullSelectionInput>,
            "TestTestLinksNotNullSelection",
            "TestTestLinks",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<ReturnType<typeof makeTestTestSelectionInput>>;
};

export function makeTestTestSelectionInput(this: any): ReturnTypeFromTestTestSelection {
    return {
        json: new SelectionWrapper("json", "JSON", 0, {}, this, undefined),
        links: TestTestLinksNotNullSelection.bind({
            collector: this,
            fieldName: "links",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(makeTestTestSelectionInput.bind(this)()) as SLWsFromSelection<
                ReturnType<typeof makeTestTestSelectionInput>
            >,
    } as const;
}
export const TestTestSelection = makeSLFN(makeTestTestSelectionInput, "TestTestSelection", "TestTest", 0);

type ReturnTypeFromTestTestLinksNotNullSelection = {
    entries: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTestTestEntriesNotNullSelectionInput>,
            "TestTestEntriesNotNullSelection",
            "TestTestEntries",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    assets: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTestTestAssetsNotNullSelectionInput>,
            "TestTestAssetsNotNullSelection",
            "TestTestAssets",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    resources: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTestTestResourcesNotNullSelectionInput>,
            "TestTestResourcesNotNullSelection",
            "TestTestResources",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeTestTestLinksNotNullSelectionInput(this: any): ReturnTypeFromTestTestLinksNotNullSelection {
    return {
        entries: TestTestEntriesNotNullSelection.bind({
            collector: this,
            fieldName: "entries",
        }),
        assets: TestTestAssetsNotNullSelection.bind({
            collector: this,
            fieldName: "assets",
        }),
        resources: TestTestResourcesNotNullSelection.bind({
            collector: this,
            fieldName: "resources",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,
    } as const;
}
export const TestTestLinksNotNullSelection = makeSLFN(
    makeTestTestLinksNotNullSelectionInput,
    "TestTestLinksNotNullSelection",
    "TestTestLinks",
    0,
);

type ReturnTypeFromTestTestEntriesNotNullSelection = {
    inline: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeEntryArrayNotNullSelectionInput>,
            "EntryArrayNotNullSelection",
            "Entry",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    hyperlink: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeEntryArrayNotNullSelectionInput>,
            "EntryArrayNotNullSelection",
            "Entry",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    block: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeEntryArrayNotNullSelectionInput>,
            "EntryArrayNotNullSelection",
            "Entry",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeTestTestEntriesNotNullSelectionInput(this: any): ReturnTypeFromTestTestEntriesNotNullSelection {
    return {
        inline: EntryArrayNotNullSelection.bind({
            collector: this,
            fieldName: "inline",
        }),
        hyperlink: EntryArrayNotNullSelection.bind({
            collector: this,
            fieldName: "hyperlink",
        }),
        block: EntryArrayNotNullSelection.bind({
            collector: this,
            fieldName: "block",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,
    } as const;
}
export const TestTestEntriesNotNullSelection = makeSLFN(
    makeTestTestEntriesNotNullSelectionInput,
    "TestTestEntriesNotNullSelection",
    "TestTestEntries",
    0,
);

type ReturnTypeFromTestTestAssetsNotNullSelection = {
    hyperlink: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeAssetArrayNotNullSelectionInput>,
            "AssetArrayNotNullSelection",
            "Asset",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    block: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeAssetArrayNotNullSelectionInput>,
            "AssetArrayNotNullSelection",
            "Asset",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeTestTestAssetsNotNullSelectionInput(this: any): ReturnTypeFromTestTestAssetsNotNullSelection {
    return {
        hyperlink: AssetArrayNotNullSelection.bind({
            collector: this,
            fieldName: "hyperlink",
        }),
        block: AssetArrayNotNullSelection.bind({
            collector: this,
            fieldName: "block",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,
    } as const;
}
export const TestTestAssetsNotNullSelection = makeSLFN(
    makeTestTestAssetsNotNullSelectionInput,
    "TestTestAssetsNotNullSelection",
    "TestTestAssets",
    0,
);

type ReturnTypeFromTestTestResourcesNotNullSelection = {
    block: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTestTestResourcesBlockNotNullArrayNotNullSelectionInput>,
            "TestTestResourcesBlockNotNullArrayNotNullSelection",
            "TestTestResourcesBlock",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    inline: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTestTestResourcesInlineNotNullArrayNotNullSelectionInput>,
            "TestTestResourcesInlineNotNullArrayNotNullSelection",
            "TestTestResourcesInline",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    hyperlink: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTestTestResourcesHyperlinkNotNullArrayNotNullSelectionInput>,
            "TestTestResourcesHyperlinkNotNullArrayNotNullSelection",
            "TestTestResourcesHyperlink",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeTestTestResourcesNotNullSelectionInput(this: any): ReturnTypeFromTestTestResourcesNotNullSelection {
    return {
        block: TestTestResourcesBlockNotNullArrayNotNullSelection.bind({
            collector: this,
            fieldName: "block",
        }),
        inline: TestTestResourcesInlineNotNullArrayNotNullSelection.bind({
            collector: this,
            fieldName: "inline",
        }),
        hyperlink: TestTestResourcesHyperlinkNotNullArrayNotNullSelection.bind({
            collector: this,
            fieldName: "hyperlink",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,
    } as const;
}
export const TestTestResourcesNotNullSelection = makeSLFN(
    makeTestTestResourcesNotNullSelectionInput,
    "TestTestResourcesNotNullSelection",
    "TestTestResources",
    0,
);

type ReturnTypeFromTestTestResourcesBlockNotNullArrayNotNullSelection = {
    sys: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeResourceSysNotNullSelectionInput>,
            "ResourceSysNotNullSelection",
            "ResourceSys",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeTestTestResourcesBlockNotNullArrayNotNullSelectionInput(
    this: any,
): ReturnTypeFromTestTestResourcesBlockNotNullArrayNotNullSelection {
    return {
        sys: ResourceSysNotNullSelection.bind({
            collector: this,
            fieldName: "sys",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,
    } as const;
}
export const TestTestResourcesBlockNotNullArrayNotNullSelection = makeSLFN(
    makeTestTestResourcesBlockNotNullArrayNotNullSelectionInput,
    "TestTestResourcesBlockNotNullArrayNotNullSelection",
    "TestTestResourcesBlock",
    1,
);

type ReturnTypeFromResourceSysNotNullSelection = {
    urn: SelectionWrapper<"urn", "String", 0, {}, undefined>;
    linkType: SelectionWrapper<"linkType", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<ReturnType<typeof makeResourceSysNotNullSelectionInput>>;
};

export function makeResourceSysNotNullSelectionInput(this: any): ReturnTypeFromResourceSysNotNullSelection {
    return {
        urn: new SelectionWrapper("urn", "String", 0, {}, this, undefined),
        linkType: new SelectionWrapper("linkType", "String", 0, {}, this, undefined),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(makeResourceSysNotNullSelectionInput.bind(this)()) as SLWsFromSelection<
                ReturnType<typeof makeResourceSysNotNullSelectionInput>
            >,
    } as const;
}
export const ResourceSysNotNullSelection = makeSLFN(
    makeResourceSysNotNullSelectionInput,
    "ResourceSysNotNullSelection",
    "ResourceSys",
    0,
);

type ReturnTypeFromTestTestResourcesInlineNotNullArrayNotNullSelection = {
    sys: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeResourceSysNotNullSelectionInput>,
            "ResourceSysNotNullSelection",
            "ResourceSys",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeTestTestResourcesInlineNotNullArrayNotNullSelectionInput(
    this: any,
): ReturnTypeFromTestTestResourcesInlineNotNullArrayNotNullSelection {
    return {
        sys: ResourceSysNotNullSelection.bind({
            collector: this,
            fieldName: "sys",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,
    } as const;
}
export const TestTestResourcesInlineNotNullArrayNotNullSelection = makeSLFN(
    makeTestTestResourcesInlineNotNullArrayNotNullSelectionInput,
    "TestTestResourcesInlineNotNullArrayNotNullSelection",
    "TestTestResourcesInline",
    1,
);

type ReturnTypeFromTestTestResourcesHyperlinkNotNullArrayNotNullSelection = {
    sys: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeResourceSysNotNullSelectionInput>,
            "ResourceSysNotNullSelection",
            "ResourceSys",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeTestTestResourcesHyperlinkNotNullArrayNotNullSelectionInput(
    this: any,
): ReturnTypeFromTestTestResourcesHyperlinkNotNullArrayNotNullSelection {
    return {
        sys: ResourceSysNotNullSelection.bind({
            collector: this,
            fieldName: "sys",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,
    } as const;
}
export const TestTestResourcesHyperlinkNotNullArrayNotNullSelection = makeSLFN(
    makeTestTestResourcesHyperlinkNotNullArrayNotNullSelectionInput,
    "TestTestResourcesHyperlinkNotNullArrayNotNullSelection",
    "TestTestResourcesHyperlink",
    1,
);

type ReturnTypeFromTestSelection = {
    sys: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeSysNotNullSelectionInput>,
            "SysNotNullSelection",
            "Sys",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    contentfulMetadata: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeContentfulMetadataNotNullSelectionInput>,
            "ContentfulMetadataNotNullSelection",
            "ContentfulMetadata",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    linkedFrom: (args: TestLinkedFromArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTestLinkingCollectionsSelectionInput>,
            "TestLinkingCollectionsSelection",
            "TestLinkingCollections",
            0,
            {
                $lazy: (args: TestLinkedFromArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    _id: SelectionWrapper<"_id", "ID", 0, {}, undefined>;
    test: (args: TestTestArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTestTestSelectionInput>,
            "TestTestSelection",
            "TestTest",
            0,
            {
                $lazy: (args: TestTestArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<ReturnType<typeof makeTestSelectionInput>>;
};

export function makeTestSelectionInput(this: any): ReturnTypeFromTestSelection {
    return {
        sys: SysNotNullSelection.bind({ collector: this, fieldName: "sys" }),
        contentfulMetadata: ContentfulMetadataNotNullSelection.bind({
            collector: this,
            fieldName: "contentfulMetadata",
        }),
        linkedFrom: (args: TestLinkedFromArgs) =>
            TestLinkingCollectionsSelection.bind({
                collector: this,
                fieldName: "linkedFrom",
                args,
                argsMeta: TestLinkedFromArgsMeta,
            }),
        _id: new SelectionWrapper("_id", "ID", 0, {}, this, undefined),
        test: (args: TestTestArgs) =>
            TestTestSelection.bind({
                collector: this,
                fieldName: "test",
                args,
                argsMeta: TestTestArgsMeta,
            }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(makeTestSelectionInput.bind(this)()) as SLWsFromSelection<
                ReturnType<typeof makeTestSelectionInput>
            >,
    } as const;
}
export const TestSelection = makeSLFN(makeTestSelectionInput, "TestSelection", "Test", 0);

type ReturnTypeFromTestArrayNotNullSelection = {
    sys: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeSysNotNullSelectionInput>,
            "SysNotNullSelection",
            "Sys",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    contentfulMetadata: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeContentfulMetadataNotNullSelectionInput>,
            "ContentfulMetadataNotNullSelection",
            "ContentfulMetadata",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    linkedFrom: (args: TestArrayNotNullLinkedFromArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTestLinkingCollectionsSelectionInput>,
            "TestLinkingCollectionsSelection",
            "TestLinkingCollections",
            0,
            {
                $lazy: (args: TestArrayNotNullLinkedFromArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    _id: SelectionWrapper<"_id", "ID", 0, {}, undefined>;
    test: (args: TestArrayNotNullTestArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTestTestSelectionInput>,
            "TestTestSelection",
            "TestTest",
            0,
            {
                $lazy: (args: TestArrayNotNullTestArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<ReturnType<typeof makeTestArrayNotNullSelectionInput>>;
};

export function makeTestArrayNotNullSelectionInput(this: any): ReturnTypeFromTestArrayNotNullSelection {
    return {
        sys: SysNotNullSelection.bind({ collector: this, fieldName: "sys" }),
        contentfulMetadata: ContentfulMetadataNotNullSelection.bind({
            collector: this,
            fieldName: "contentfulMetadata",
        }),
        linkedFrom: (args: TestArrayNotNullLinkedFromArgs) =>
            TestLinkingCollectionsSelection.bind({
                collector: this,
                fieldName: "linkedFrom",
                args,
                argsMeta: TestArrayNotNullLinkedFromArgsMeta,
            }),
        _id: new SelectionWrapper("_id", "ID", 0, {}, this, undefined),
        test: (args: TestArrayNotNullTestArgs) =>
            TestTestSelection.bind({
                collector: this,
                fieldName: "test",
                args,
                argsMeta: TestArrayNotNullTestArgsMeta,
            }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(makeTestArrayNotNullSelectionInput.bind(this)()) as SLWsFromSelection<
                ReturnType<typeof makeTestArrayNotNullSelectionInput>
            >,
    } as const;
}
export const TestArrayNotNullSelection = makeSLFN(
    makeTestArrayNotNullSelectionInput,
    "TestArrayNotNullSelection",
    "Test",
    1,
);

type ReturnTypeFromTestCollectionSelection = {
    total: SelectionWrapper<"total", "Int", 0, {}, undefined>;
    skip: SelectionWrapper<"skip", "Int", 0, {}, undefined>;
    limit: SelectionWrapper<"limit", "Int", 0, {}, undefined>;
    items: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTestArrayNotNullSelectionInput>,
            "TestArrayNotNullSelection",
            "Test",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<ReturnType<typeof makeTestCollectionSelectionInput>>;
};

export function makeTestCollectionSelectionInput(this: any): ReturnTypeFromTestCollectionSelection {
    return {
        total: new SelectionWrapper("total", "Int", 0, {}, this, undefined),
        skip: new SelectionWrapper("skip", "Int", 0, {}, this, undefined),
        limit: new SelectionWrapper("limit", "Int", 0, {}, this, undefined),
        items: TestArrayNotNullSelection.bind({
            collector: this,
            fieldName: "items",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(makeTestCollectionSelectionInput.bind(this)()) as SLWsFromSelection<
                ReturnType<typeof makeTestCollectionSelectionInput>
            >,
    } as const;
}
export const TestCollectionSelection = makeSLFN(
    makeTestCollectionSelectionInput,
    "TestCollectionSelection",
    "TestCollection",
    0,
);

type ReturnTypeFrom_NodeSelection = {
    _id: SelectionWrapper<"_id", "ID", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<ReturnType<typeof make_NodeSelectionInput>>;
};

export function make_NodeSelectionInput(this: any): ReturnTypeFrom_NodeSelection {
    return {
        _id: new SelectionWrapper("_id", "ID", 0, {}, this, undefined),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(make_NodeSelectionInput.bind(this)()) as SLWsFromSelection<
                ReturnType<typeof make_NodeSelectionInput>
            >,
    } as const;
}
export const _NodeSelection = makeSLFN(make_NodeSelectionInput, "_NodeSelection", "_Node", 0);

type ReturnTypeFromQuerySelection = {
    asset: (args: QueryAssetArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeAssetSelectionInput>,
            "AssetSelection",
            "Asset",
            0,
            {
                $lazy: (args: QueryAssetArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    assetCollection: (args: QueryAssetCollectionArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeAssetCollectionSelectionInput>,
            "AssetCollectionSelection",
            "AssetCollection",
            0,
            {
                $lazy: (args: QueryAssetCollectionArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    test: (args: QueryTestArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTestSelectionInput>,
            "TestSelection",
            "Test",
            0,
            {
                $lazy: (args: QueryTestArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    testCollection: (args: QueryTestCollectionArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTestCollectionSelectionInput>,
            "TestCollectionSelection",
            "TestCollection",
            0,
            {
                $lazy: (args: QueryTestCollectionArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    entryCollection: (args: QueryEntryCollectionArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeEntryCollectionSelectionInput>,
            "EntryCollectionSelection",
            "EntryCollection",
            0,
            {
                $lazy: (args: QueryEntryCollectionArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    _node: (args: Query_nodeArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof make_NodeSelectionInput>,
            "_NodeSelection",
            "_Node",
            0,
            {
                $lazy: (args: Query_nodeArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeQuerySelectionInput(this: any): ReturnTypeFromQuerySelection {
    return {
        asset: (args: QueryAssetArgs) =>
            AssetSelection.bind({
                collector: this,
                fieldName: "asset",
                args,
                argsMeta: QueryAssetArgsMeta,
            }),
        assetCollection: (args: QueryAssetCollectionArgs) =>
            AssetCollectionSelection.bind({
                collector: this,
                fieldName: "assetCollection",
                args,
                argsMeta: QueryAssetCollectionArgsMeta,
            }),
        test: (args: QueryTestArgs) =>
            TestSelection.bind({
                collector: this,
                fieldName: "test",
                args,
                argsMeta: QueryTestArgsMeta,
            }),
        testCollection: (args: QueryTestCollectionArgs) =>
            TestCollectionSelection.bind({
                collector: this,
                fieldName: "testCollection",
                args,
                argsMeta: QueryTestCollectionArgsMeta,
            }),
        entryCollection: (args: QueryEntryCollectionArgs) =>
            EntryCollectionSelection.bind({
                collector: this,
                fieldName: "entryCollection",
                args,
                argsMeta: QueryEntryCollectionArgsMeta,
            }),
        _node: (args: Query_nodeArgs) =>
            _NodeSelection.bind({
                collector: this,
                fieldName: "_node",
                args,
                argsMeta: Query_nodeArgsMeta,
            }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,
    } as const;
}
export const QuerySelection = makeSLFN(makeQuerySelectionInput, "QuerySelection", "Query", 0);

type ReturnTypeFromSysSelection = {
    id: SelectionWrapper<"id", "String", 0, {}, undefined>;
    spaceId: SelectionWrapper<"spaceId", "String", 0, {}, undefined>;
    environmentId: SelectionWrapper<"environmentId", "String", 0, {}, undefined>;
    publishedAt: SelectionWrapper<"publishedAt", "DateTime", 0, {}, undefined>;
    firstPublishedAt: SelectionWrapper<"firstPublishedAt", "DateTime", 0, {}, undefined>;
    publishedVersion: SelectionWrapper<"publishedVersion", "Int", 0, {}, undefined>;
    locale: SelectionWrapper<"locale", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<ReturnType<typeof makeSysSelectionInput>>;
};

export function makeSysSelectionInput(this: any): ReturnTypeFromSysSelection {
    return {
        id: new SelectionWrapper("id", "String", 0, {}, this, undefined),
        spaceId: new SelectionWrapper("spaceId", "String", 0, {}, this, undefined),
        environmentId: new SelectionWrapper("environmentId", "String", 0, {}, this, undefined),
        publishedAt: new SelectionWrapper("publishedAt", "DateTime", 0, {}, this, undefined),
        firstPublishedAt: new SelectionWrapper("firstPublishedAt", "DateTime", 0, {}, this, undefined),
        publishedVersion: new SelectionWrapper("publishedVersion", "Int", 0, {}, this, undefined),
        locale: new SelectionWrapper("locale", "String", 0, {}, this, undefined),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(makeSysSelectionInput.bind(this)()) as SLWsFromSelection<
                ReturnType<typeof makeSysSelectionInput>
            >,
    } as const;
}
export const SysSelection = makeSLFN(makeSysSelectionInput, "SysSelection", "Sys", 0);

type ReturnTypeFromContentfulMetadataSelection = {
    tags: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeContentfulTagArrayNotNullSelectionInput>,
            "ContentfulTagArrayNotNullSelection",
            "ContentfulTag",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeContentfulMetadataSelectionInput(this: any): ReturnTypeFromContentfulMetadataSelection {
    return {
        tags: ContentfulTagArrayNotNullSelection.bind({
            collector: this,
            fieldName: "tags",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,
    } as const;
}
export const ContentfulMetadataSelection = makeSLFN(
    makeContentfulMetadataSelectionInput,
    "ContentfulMetadataSelection",
    "ContentfulMetadata",
    0,
);

type ReturnTypeFromContentfulTagSelection = {
    id: SelectionWrapper<"id", "String", 0, {}, undefined>;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<ReturnType<typeof makeContentfulTagSelectionInput>>;
};

export function makeContentfulTagSelectionInput(this: any): ReturnTypeFromContentfulTagSelection {
    return {
        id: new SelectionWrapper("id", "String", 0, {}, this, undefined),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(makeContentfulTagSelectionInput.bind(this)()) as SLWsFromSelection<
                ReturnType<typeof makeContentfulTagSelectionInput>
            >,
    } as const;
}
export const ContentfulTagSelection = makeSLFN(
    makeContentfulTagSelectionInput,
    "ContentfulTagSelection",
    "ContentfulTag",
    0,
);

type ReturnTypeFromEntrySelection = {
    sys: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeSysNotNullSelectionInput>,
            "SysNotNullSelection",
            "Sys",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    contentfulMetadata: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeContentfulMetadataNotNullSelectionInput>,
            "ContentfulMetadataNotNullSelection",
            "ContentfulMetadata",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeEntrySelectionInput(this: any): ReturnTypeFromEntrySelection {
    return {
        sys: SysNotNullSelection.bind({ collector: this, fieldName: "sys" }),
        contentfulMetadata: ContentfulMetadataNotNullSelection.bind({
            collector: this,
            fieldName: "contentfulMetadata",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,
    } as const;
}
export const EntrySelection = makeSLFN(makeEntrySelectionInput, "EntrySelection", "Entry", 0);

type ReturnTypeFromTestTestLinksSelection = {
    entries: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTestTestEntriesNotNullSelectionInput>,
            "TestTestEntriesNotNullSelection",
            "TestTestEntries",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    assets: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTestTestAssetsNotNullSelectionInput>,
            "TestTestAssetsNotNullSelection",
            "TestTestAssets",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    resources: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTestTestResourcesNotNullSelectionInput>,
            "TestTestResourcesNotNullSelection",
            "TestTestResources",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeTestTestLinksSelectionInput(this: any): ReturnTypeFromTestTestLinksSelection {
    return {
        entries: TestTestEntriesNotNullSelection.bind({
            collector: this,
            fieldName: "entries",
        }),
        assets: TestTestAssetsNotNullSelection.bind({
            collector: this,
            fieldName: "assets",
        }),
        resources: TestTestResourcesNotNullSelection.bind({
            collector: this,
            fieldName: "resources",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,
    } as const;
}
export const TestTestLinksSelection = makeSLFN(
    makeTestTestLinksSelectionInput,
    "TestTestLinksSelection",
    "TestTestLinks",
    0,
);

type ReturnTypeFromTestTestEntriesSelection = {
    inline: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeEntryArrayNotNullSelectionInput>,
            "EntryArrayNotNullSelection",
            "Entry",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    hyperlink: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeEntryArrayNotNullSelectionInput>,
            "EntryArrayNotNullSelection",
            "Entry",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    block: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeEntryArrayNotNullSelectionInput>,
            "EntryArrayNotNullSelection",
            "Entry",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeTestTestEntriesSelectionInput(this: any): ReturnTypeFromTestTestEntriesSelection {
    return {
        inline: EntryArrayNotNullSelection.bind({
            collector: this,
            fieldName: "inline",
        }),
        hyperlink: EntryArrayNotNullSelection.bind({
            collector: this,
            fieldName: "hyperlink",
        }),
        block: EntryArrayNotNullSelection.bind({
            collector: this,
            fieldName: "block",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,
    } as const;
}
export const TestTestEntriesSelection = makeSLFN(
    makeTestTestEntriesSelectionInput,
    "TestTestEntriesSelection",
    "TestTestEntries",
    0,
);

type ReturnTypeFromTestTestAssetsSelection = {
    hyperlink: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeAssetArrayNotNullSelectionInput>,
            "AssetArrayNotNullSelection",
            "Asset",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    block: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeAssetArrayNotNullSelectionInput>,
            "AssetArrayNotNullSelection",
            "Asset",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeTestTestAssetsSelectionInput(this: any): ReturnTypeFromTestTestAssetsSelection {
    return {
        hyperlink: AssetArrayNotNullSelection.bind({
            collector: this,
            fieldName: "hyperlink",
        }),
        block: AssetArrayNotNullSelection.bind({
            collector: this,
            fieldName: "block",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,
    } as const;
}
export const TestTestAssetsSelection = makeSLFN(
    makeTestTestAssetsSelectionInput,
    "TestTestAssetsSelection",
    "TestTestAssets",
    0,
);

type ReturnTypeFromTestTestResourcesSelection = {
    block: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTestTestResourcesBlockNotNullArrayNotNullSelectionInput>,
            "TestTestResourcesBlockNotNullArrayNotNullSelection",
            "TestTestResourcesBlock",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    inline: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTestTestResourcesInlineNotNullArrayNotNullSelectionInput>,
            "TestTestResourcesInlineNotNullArrayNotNullSelection",
            "TestTestResourcesInline",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    hyperlink: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTestTestResourcesHyperlinkNotNullArrayNotNullSelectionInput>,
            "TestTestResourcesHyperlinkNotNullArrayNotNullSelection",
            "TestTestResourcesHyperlink",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeTestTestResourcesSelectionInput(this: any): ReturnTypeFromTestTestResourcesSelection {
    return {
        block: TestTestResourcesBlockNotNullArrayNotNullSelection.bind({
            collector: this,
            fieldName: "block",
        }),
        inline: TestTestResourcesInlineNotNullArrayNotNullSelection.bind({
            collector: this,
            fieldName: "inline",
        }),
        hyperlink: TestTestResourcesHyperlinkNotNullArrayNotNullSelection.bind({
            collector: this,
            fieldName: "hyperlink",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,
    } as const;
}
export const TestTestResourcesSelection = makeSLFN(
    makeTestTestResourcesSelectionInput,
    "TestTestResourcesSelection",
    "TestTestResources",
    0,
);

type ReturnTypeFromTestTestResourcesBlockSelection = {
    sys: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeResourceSysNotNullSelectionInput>,
            "ResourceSysNotNullSelection",
            "ResourceSys",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeTestTestResourcesBlockSelectionInput(this: any): ReturnTypeFromTestTestResourcesBlockSelection {
    return {
        sys: ResourceSysNotNullSelection.bind({
            collector: this,
            fieldName: "sys",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,
    } as const;
}
export const TestTestResourcesBlockSelection = makeSLFN(
    makeTestTestResourcesBlockSelectionInput,
    "TestTestResourcesBlockSelection",
    "TestTestResourcesBlock",
    0,
);

type ReturnTypeFromResourceLinkSelection = {
    sys: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeResourceSysNotNullSelectionInput>,
            "ResourceSysNotNullSelection",
            "ResourceSys",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeResourceLinkSelectionInput(this: any): ReturnTypeFromResourceLinkSelection {
    return {
        sys: ResourceSysNotNullSelection.bind({
            collector: this,
            fieldName: "sys",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,
    } as const;
}
export const ResourceLinkSelection = makeSLFN(
    makeResourceLinkSelectionInput,
    "ResourceLinkSelection",
    "ResourceLink",
    0,
);

type ReturnTypeFromResourceSysSelection = {
    urn: SelectionWrapper<"urn", "String", 0, {}, undefined>;
    linkType: SelectionWrapper<"linkType", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<ReturnType<typeof makeResourceSysSelectionInput>>;
};

export function makeResourceSysSelectionInput(this: any): ReturnTypeFromResourceSysSelection {
    return {
        urn: new SelectionWrapper("urn", "String", 0, {}, this, undefined),
        linkType: new SelectionWrapper("linkType", "String", 0, {}, this, undefined),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(makeResourceSysSelectionInput.bind(this)()) as SLWsFromSelection<
                ReturnType<typeof makeResourceSysSelectionInput>
            >,
    } as const;
}
export const ResourceSysSelection = makeSLFN(makeResourceSysSelectionInput, "ResourceSysSelection", "ResourceSys", 0);

type ReturnTypeFromTestTestResourcesInlineSelection = {
    sys: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeResourceSysNotNullSelectionInput>,
            "ResourceSysNotNullSelection",
            "ResourceSys",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeTestTestResourcesInlineSelectionInput(this: any): ReturnTypeFromTestTestResourcesInlineSelection {
    return {
        sys: ResourceSysNotNullSelection.bind({
            collector: this,
            fieldName: "sys",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,
    } as const;
}
export const TestTestResourcesInlineSelection = makeSLFN(
    makeTestTestResourcesInlineSelectionInput,
    "TestTestResourcesInlineSelection",
    "TestTestResourcesInline",
    0,
);

type ReturnTypeFromTestTestResourcesHyperlinkSelection = {
    sys: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeResourceSysNotNullSelectionInput>,
            "ResourceSysNotNullSelection",
            "ResourceSys",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeTestTestResourcesHyperlinkSelectionInput(
    this: any,
): ReturnTypeFromTestTestResourcesHyperlinkSelection {
    return {
        sys: ResourceSysNotNullSelection.bind({
            collector: this,
            fieldName: "sys",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>,
    } as const;
}
export const TestTestResourcesHyperlinkSelection = makeSLFN(
    makeTestTestResourcesHyperlinkSelectionInput,
    "TestTestResourcesHyperlinkSelection",
    "TestTestResourcesHyperlink",
    0,
);

export const _directive_include =
    (args: Directive_includeArgs) =>
    <F>(f: F) => {
        (f as any)[SLW_DIRECTIVE] = "include";
        (f as any)[SLW_DIRECTIVE_ARGS] = args;
        (f as any)[SLW_DIRECTIVE_ARGS_META] = Directive_includeArgsMeta;
        return f;
    };

export const _directive_skip =
    (args: Directive_skipArgs) =>
    <F>(f: F) => {
        (f as any)[SLW_DIRECTIVE] = "skip";
        (f as any)[SLW_DIRECTIVE_ARGS] = args;
        (f as any)[SLW_DIRECTIVE_ARGS_META] = Directive_skipArgsMeta;
        return f;
    };

export const $directives = {
    include: _directive_include,
    skip: _directive_skip,
} as const;
export function _makeRootOperationInput(this: any) {
    return {
        query: QuerySelection.bind({
            collector: this,
            isRootType: "Query",
        }),

        $directives,
    } as const;
}

type __AuthenticationArg__ =
    | string
    | { [key: string]: string }
    | (() => string | { [key: string]: string })
    | (() => Promise<string | { [key: string]: string }>);
function __client__<T extends object, F extends ReturnType<typeof _makeRootOperationInput>>(
    this: any,
    s: (selection: F) => T,
) {
    const root = new OperationSelectionCollector(undefined, undefined, new RootOperation());
    const rootRef = { ref: root };
    const selection: F = _makeRootOperationInput.bind(rootRef)() as any;
    const r = s(selection);
    const _result = new SelectionWrapper(undefined, undefined, undefined, r, root, undefined) as unknown as T;
    Object.keys(r).forEach((key) => (_result as T)[key as keyof T]);
    const result = _result as {
        [k in keyof T]: T[k] extends (...args: infer A) => any
            ? (...args: A) => Omit<ReturnType<T[k]>, "$lazy">
            : Omit<T[k], "$lazy">;
    };
    type TR = typeof result;

    let headers: Record<string, string> | undefined = undefined;
    const finalPromise = {
        then: (resolve: (value: TR) => void, reject: (reason: any) => void) => {
            const doExecute = () => {
                root.execute(headers)
                    .then(() => {
                        resolve(result);
                    })
                    .catch(reject);
            };
            if (typeof RootOperation[OPTIONS]._auth_fn === "function") {
                const tokenOrPromise = RootOperation[OPTIONS]._auth_fn();
                if (tokenOrPromise instanceof Promise) {
                    tokenOrPromise.then((t) => {
                        if (typeof t === "string") headers = { Authorization: t };
                        else headers = t;

                        doExecute();
                    });
                } else if (typeof tokenOrPromise === "string") {
                    headers = { Authorization: tokenOrPromise };

                    doExecute();
                } else {
                    headers = tokenOrPromise;

                    doExecute();
                }
            } else {
                doExecute();
            }
        },
    };

    Object.defineProperty(finalPromise, "auth", {
        enumerable: false,
        get: function () {
            return function (auth: __AuthenticationArg__) {
                if (typeof auth === "string") {
                    headers = { Authorization: auth };
                } else if (typeof auth === "function") {
                    const tokenOrPromise = auth();
                    if (tokenOrPromise instanceof Promise) {
                        return tokenOrPromise.then((t) => {
                            if (typeof t === "string") headers = { Authorization: t };
                            else headers = t;

                            return finalPromise as Promise<TR>;
                        });
                    }
                    if (typeof tokenOrPromise === "string") {
                        headers = { Authorization: tokenOrPromise };
                    } else {
                        headers = tokenOrPromise;
                    }
                } else {
                    headers = auth;
                }

                return finalPromise as Promise<TR>;
            };
        },
    });

    return finalPromise as Promise<TR> & {
        auth: (auth: __AuthenticationArg__) => Promise<TR>;
    };
}

const __init__ = (options: {
    auth?: __AuthenticationArg__;
    headers?: { [key: string]: string };
    scalars?: {
        [key in keyof ScalarTypeMapDefault]?: (v: string) => ScalarTypeMapDefault[key];
    } & {
        [key in keyof ScalarTypeMapWithCustom]?: (v: string) => ScalarTypeMapWithCustom[key];
    };
}) => {
    if (typeof options.auth === "string") {
        RootOperation[OPTIONS].headers = {
            Authorization: options.auth,
        };
    } else if (typeof options.auth === "function") {
        RootOperation[OPTIONS]._auth_fn = options.auth;
    } else if (options.auth) {
        RootOperation[OPTIONS].headers = options.auth;
    }

    if (options.headers) {
        RootOperation[OPTIONS].headers = {
            ...RootOperation[OPTIONS].headers,
            ...options.headers,
        };
    }
    if (options.scalars) {
        RootOperation[OPTIONS].scalars = {
            ...RootOperation[OPTIONS].scalars,
            ...options.scalars,
        };
    }
};
Object.defineProperty(__client__, "init", {
    enumerable: false,
    value: __init__,
});

export default __client__ as typeof __client__ & {
    init: typeof __init__;
};

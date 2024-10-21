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

export type users_select_column =
    | "column"
    | "name"
    | "id"
    | "rocket"
    | "timestamp"
    | "twitter";
export enum users_select_columnEnum {
    column = "column",
    name = "name",
    id = "id",
    rocket = "rocket",
    timestamp = "timestamp",
    twitter = "twitter",
}

export type order_by =
    | "asc"
    | "asc_nulls_first"
    | "asc_nulls_last"
    | "desc"
    | "desc_nulls_first"
    | "desc_nulls_last";
export enum order_byEnum {
    /** in the ascending order, nulls last */
    asc = "asc",
    /** in the ascending order, nulls first */
    asc_nulls_first = "asc_nulls_first",
    /** in the ascending order, nulls last */
    asc_nulls_last = "asc_nulls_last",
    /** in the descending order, nulls first */
    desc = "desc",
    /** in the descending order, nulls first */
    desc_nulls_first = "desc_nulls_first",
    /** in the descending order, nulls last */
    desc_nulls_last = "desc_nulls_last",
}

export type users_constraint =
    | "unique"
    | "or"
    | "primary"
    | "key"
    | "constraint"
    | "users_pkey";
export enum users_constraintEnum {
    unique = "unique",
    or = "or",
    primary = "primary",
    key = "key",
    constraint = "constraint",
    users_pkey = "users_pkey",
}

export type users_update_column =
    | "column"
    | "name"
    | "id"
    | "rocket"
    | "timestamp"
    | "twitter";
export enum users_update_columnEnum {
    column = "column",
    name = "name",
    id = "id",
    rocket = "rocket",
    timestamp = "timestamp",
    twitter = "twitter",
}

export type link__Purpose = "SECURITY" | "EXECUTION";
export enum link__PurposeEnum {
    /** `SECURITY` features provide metadata necessary to securely resolve fields. */
    SECURITY = "SECURITY",
    /** `EXECUTION` features provide metadata necessary for operation execution. */
    EXECUTION = "EXECUTION",
}

export type Directive_includeArgs = {
    /** Included when true. */
    if: boolean;
};
export type Directive_skipArgs = {
    /** Skipped when true. */
    if: boolean;
};
export type users_aggregate_fieldsCountArgs = {
    columns?: users_select_column[];
    distinct?: boolean;
};
export type MutationDelete_usersArgs = {
    /** filter the rows which have to be deleted */ where: users_bool_exp;
};
export type MutationInsert_usersArgs = {
    /** the rows to be inserted */
    objects: users_insert_input[] /** on conflict condition */;
    on_conflict?: users_on_conflict;
};
export type MutationUpdate_usersArgs = {
    /** sets the columns of the filtered rows to the given values */
    _set?: users_set_input /** filter the rows which have to be updated */;
    where: users_bool_exp;
};
export type QueryCapsuleArgs = {
    id: string;
};
export type QueryCapsulesArgs = {
    find?: CapsulesFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryCapsulesPastArgs = {
    find?: CapsulesFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryCapsulesUpcomingArgs = {
    find?: CapsulesFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryCoreArgs = {
    id: string;
};
export type QueryCoresArgs = {
    find?: CoresFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryCoresPastArgs = {
    find?: CoresFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryCoresUpcomingArgs = {
    find?: CoresFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryDragonArgs = {
    id: string;
};
export type QueryDragonsArgs = {
    limit?: number;
    offset?: number;
};
export type QueryHistoriesArgs = {
    find?: HistoryFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryHistoriesResultArgs = {
    find?: HistoryFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryHistoryArgs = {
    id: string;
};
export type QueryLandpadArgs = {
    id: string;
};
export type QueryLandpadsArgs = {
    limit?: number;
    offset?: number;
};
export type QueryLaunchArgs = {
    id: string;
};
export type QueryLaunchLatestArgs = {
    offset?: number;
};
export type QueryLaunchNextArgs = {
    offset?: number;
};
export type QueryLaunchesArgs = {
    find?: LaunchFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryLaunchesPastArgs = {
    find?: LaunchFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryLaunchesPastResultArgs = {
    find?: LaunchFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryLaunchesUpcomingArgs = {
    find?: LaunchFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryLaunchpadArgs = {
    id: string;
};
export type QueryLaunchpadsArgs = {
    limit?: number;
    offset?: number;
};
export type QueryMissionArgs = {
    id: string;
};
export type QueryMissionsArgs = {
    find?: MissionsFind;
    limit?: number;
    offset?: number;
};
export type QueryMissionsResultArgs = {
    find?: MissionsFind;
    limit?: number;
    offset?: number;
};
export type QueryPayloadArgs = {
    id: string;
};
export type QueryPayloadsArgs = {
    find?: PayloadsFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryRocketArgs = {
    id: string;
};
export type QueryRocketsArgs = {
    limit?: number;
    offset?: number;
};
export type QueryRocketsResultArgs = {
    limit?: number;
    offset?: number;
};
export type QueryShipArgs = {
    id: string;
};
export type QueryShipsArgs = {
    find?: ShipsFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryShipsResultArgs = {
    find?: ShipsFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryUsersArgs = {
    /** distinct select on columns */
    distinct_on?: users_select_column[] /** limit the nuber of rows returned */;
    limit?: number /** skip the first n rows. Use only with order_by */;
    offset?: number /** sort the rows by one or more columns */;
    order_by?: users_order_by[] /** filter the rows returned */;
    where?: users_bool_exp;
};
export type QueryUsers_aggregateArgs = {
    /** distinct select on columns */
    distinct_on?: users_select_column[] /** limit the nuber of rows returned */;
    limit?: number /** skip the first n rows. Use only with order_by */;
    offset?: number /** sort the rows by one or more columns */;
    order_by?: users_order_by[] /** filter the rows returned */;
    where?: users_bool_exp;
};
export type QueryUsers_by_pkArgs = {
    id: any;
};
export type SubscriptionUsersArgs = {
    /** distinct select on columns */
    distinct_on?: users_select_column[] /** limit the nuber of rows returned */;
    limit?: number /** skip the first n rows. Use only with order_by */;
    offset?: number /** sort the rows by one or more columns */;
    order_by?: users_order_by[] /** filter the rows returned */;
    where?: users_bool_exp;
};
export type SubscriptionUsers_aggregateArgs = {
    /** distinct select on columns */
    distinct_on?: users_select_column[] /** limit the nuber of rows returned */;
    limit?: number /** skip the first n rows. Use only with order_by */;
    offset?: number /** sort the rows by one or more columns */;
    order_by?: users_order_by[] /** filter the rows returned */;
    where?: users_bool_exp;
};
export type SubscriptionUsers_by_pkArgs = {
    id: any;
};
export const Directive_includeArgsMeta = { if: "Boolean!" } as const;
export const Directive_skipArgsMeta = { if: "Boolean!" } as const;
export const users_aggregate_fieldsCountArgsMeta = {
    columns: "[users_select_column!]",
    distinct: "Boolean",
} as const;
export const MutationDelete_usersArgsMeta = {
    where: "users_bool_exp!",
} as const;
export const MutationInsert_usersArgsMeta = {
    objects: "[users_insert_input!]!",
    on_conflict: "users_on_conflict",
} as const;
export const MutationUpdate_usersArgsMeta = {
    _set: "users_set_input",
    where: "users_bool_exp!",
} as const;
export const QueryCapsuleArgsMeta = { id: "ID!" } as const;
export const QueryCapsulesArgsMeta = {
    find: "CapsulesFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryCapsulesPastArgsMeta = {
    find: "CapsulesFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryCapsulesUpcomingArgsMeta = {
    find: "CapsulesFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryCoreArgsMeta = { id: "ID!" } as const;
export const QueryCoresArgsMeta = {
    find: "CoresFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryCoresPastArgsMeta = {
    find: "CoresFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryCoresUpcomingArgsMeta = {
    find: "CoresFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryDragonArgsMeta = { id: "ID!" } as const;
export const QueryDragonsArgsMeta = { limit: "Int", offset: "Int" } as const;
export const QueryHistoriesArgsMeta = {
    find: "HistoryFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryHistoriesResultArgsMeta = {
    find: "HistoryFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryHistoryArgsMeta = { id: "ID!" } as const;
export const QueryLandpadArgsMeta = { id: "ID!" } as const;
export const QueryLandpadsArgsMeta = { limit: "Int", offset: "Int" } as const;
export const QueryLaunchArgsMeta = { id: "ID!" } as const;
export const QueryLaunchLatestArgsMeta = { offset: "Int" } as const;
export const QueryLaunchNextArgsMeta = { offset: "Int" } as const;
export const QueryLaunchesArgsMeta = {
    find: "LaunchFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryLaunchesPastArgsMeta = {
    find: "LaunchFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryLaunchesPastResultArgsMeta = {
    find: "LaunchFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryLaunchesUpcomingArgsMeta = {
    find: "LaunchFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryLaunchpadArgsMeta = { id: "ID!" } as const;
export const QueryLaunchpadsArgsMeta = { limit: "Int", offset: "Int" } as const;
export const QueryMissionArgsMeta = { id: "ID!" } as const;
export const QueryMissionsArgsMeta = {
    find: "MissionsFind",
    limit: "Int",
    offset: "Int",
} as const;
export const QueryMissionsResultArgsMeta = {
    find: "MissionsFind",
    limit: "Int",
    offset: "Int",
} as const;
export const QueryPayloadArgsMeta = { id: "ID!" } as const;
export const QueryPayloadsArgsMeta = {
    find: "PayloadsFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryRocketArgsMeta = { id: "ID!" } as const;
export const QueryRocketsArgsMeta = { limit: "Int", offset: "Int" } as const;
export const QueryRocketsResultArgsMeta = {
    limit: "Int",
    offset: "Int",
} as const;
export const QueryShipArgsMeta = { id: "ID!" } as const;
export const QueryShipsArgsMeta = {
    find: "ShipsFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryShipsResultArgsMeta = {
    find: "ShipsFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryUsersArgsMeta = {
    distinct_on: "[users_select_column!]",
    limit: "Int",
    offset: "Int",
    order_by: "[users_order_by!]",
    where: "users_bool_exp",
} as const;
export const QueryUsers_aggregateArgsMeta = {
    distinct_on: "[users_select_column!]",
    limit: "Int",
    offset: "Int",
    order_by: "[users_order_by!]",
    where: "users_bool_exp",
} as const;
export const QueryUsers_by_pkArgsMeta = { id: "uuid!" } as const;
export const SubscriptionUsersArgsMeta = {
    distinct_on: "[users_select_column!]",
    limit: "Int",
    offset: "Int",
    order_by: "[users_order_by!]",
    where: "users_bool_exp",
} as const;
export const SubscriptionUsers_aggregateArgsMeta = {
    distinct_on: "[users_select_column!]",
    limit: "Int",
    offset: "Int",
    order_by: "[users_order_by!]",
    where: "users_bool_exp",
} as const;
export const SubscriptionUsers_by_pkArgsMeta = { id: "uuid!" } as const;

export type CapsulesFind = {
    id?: string;
    landings?: number;
    mission?: string;
    original_launch?: Date;
    reuse_count?: number;
    status?: string;
    type?: string;
};

export type CoresFind = {
    asds_attempts?: number;
    asds_landings?: number;
    block?: number;
    id?: string;
    missions?: string;
    original_launch?: Date;
    reuse_count?: number;
    rtls_attempts?: number;
    rtls_landings?: number;
    status?: string;
    water_landing?: boolean;
};

export type HistoryFind = {
    end?: Date;
    flight_number?: number;
    id?: string;
    start?: Date;
};

export type LaunchFind = {
    apoapsis_km?: number;
    block?: number;
    cap_serial?: string;
    capsule_reuse?: string;
    core_flight?: number;
    core_reuse?: string;
    core_serial?: string;
    customer?: string;
    eccentricity?: number;
    end?: Date;
    epoch?: Date;
    fairings_recovered?: string;
    fairings_recovery_attempt?: string;
    fairings_reuse?: string;
    fairings_reused?: string;
    fairings_ship?: string;
    gridfins?: string;
    id?: string;
    inclination_deg?: number;
    land_success?: string;
    landing_intent?: string;
    landing_type?: string;
    landing_vehicle?: string;
    launch_date_local?: Date;
    launch_date_utc?: Date;
    launch_success?: string;
    launch_year?: string;
    legs?: string;
    lifespan_years?: number;
    longitude?: number;
    manufacturer?: string;
    mean_motion?: number;
    mission_id?: string;
    mission_name?: string;
    nationality?: string;
    norad_id?: number;
    orbit?: string;
    payload_id?: string;
    payload_type?: string;
    periapsis_km?: number;
    period_min?: number;
    raan?: number;
    reference_system?: string;
    regime?: string;
    reused?: string;
    rocket_id?: string;
    rocket_name?: string;
    rocket_type?: string;
    second_stage_block?: string;
    semi_major_axis_km?: number;
    ship?: string;
    side_core1_reuse?: string;
    side_core2_reuse?: string;
    site_id?: string;
    site_name_long?: string;
    site_name?: string;
    start?: Date;
    tbd?: string;
    tentative_max_precision?: string;
    tentative?: string;
};

export type MissionsFind = {
    id?: string;
    manufacturer?: string;
    name?: string;
    payload_id?: string;
};

export type PayloadsFind = {
    apoapsis_km?: number;
    customer?: string;
    eccentricity?: number;
    epoch?: Date;
    inclination_deg?: number;
    lifespan_years?: number;
    longitude?: number;
    manufacturer?: string;
    mean_motion?: number;
    nationality?: string;
    norad_id?: number;
    orbit?: string;
    payload_id?: string;
    payload_type?: string;
    periapsis_km?: number;
    period_min?: number;
    raan?: number;
    reference_system?: string;
    regime?: string;
    reused?: boolean;
    semi_major_axis_km?: number;
};

export type ShipsFind = {
    id?: string;
    name?: string;
    model?: string;
    type?: string;
    role?: string;
    active?: boolean;
    imo?: number;
    mmsi?: number;
    abs?: number;
    class?: number;
    weight_lbs?: number;
    weight_kg?: number;
    year_built?: number;
    home_port?: string;
    status?: string;
    speed_kn?: number;
    course_deg?: number;
    latitude?: number;
    longitude?: number;
    successful_landings?: number;
    attempted_landings?: number;
    mission?: string;
};

export type users_order_by = {
    id?: any;
    name?: any;
    rocket?: any;
    timestamp?: any;
    twitter?: any;
};

export type users_bool_exp = {
    _and?: users_bool_exp[];
    _not?: users_bool_exp;
    _or?: users_bool_exp[];
    id?: uuid_comparison_exp;
    name?: String_comparison_exp;
    rocket?: String_comparison_exp;
    timestamp?: timestamptz_comparison_exp;
    twitter?: String_comparison_exp;
};

export type uuid_comparison_exp = {
    _eq?: any;
    _gt?: any;
    _gte?: any;
    _in?: Array<any>;
    _is_null?: boolean;
    _lt?: any;
    _lte?: any;
    _neq?: any;
    _nin?: Array<any>;
};

export type String_comparison_exp = {
    _eq?: string;
    _gt?: string;
    _gte?: string;
    _ilike?: string;
    _in?: Array<string>;
    _is_null?: boolean;
    _like?: string;
    _lt?: string;
    _lte?: string;
    _neq?: string;
    _nilike?: string;
    _nin?: Array<string>;
    _nlike?: string;
    _nsimilar?: string;
    _similar?: string;
};

export type timestamptz_comparison_exp = {
    _eq?: any;
    _gt?: any;
    _gte?: any;
    _in?: Array<any>;
    _is_null?: boolean;
    _lt?: any;
    _lte?: any;
    _neq?: any;
    _nin?: Array<any>;
};

export type users_insert_input = {
    id?: any;
    name?: string;
    rocket?: string;
    timestamp?: any;
    twitter?: string;
};

export type users_on_conflict = {
    constraint: any;
    update_columns: Array<any>;
};

export type users_set_input = {
    id?: any;
    name?: string;
    rocket?: string;
    timestamp?: any;
    twitter?: string;
};

type ReturnTypeFromDragonSelection = {
    active: SelectionWrapper<"active", "Boolean", 0, {}, undefined>;
    crew_capacity: SelectionWrapper<"crew_capacity", "Int", 0, {}, undefined>;
    description: SelectionWrapper<"description", "String", 0, {}, undefined>;
    diameter: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDistanceSelectionInput>,
            "DistanceSelection",
            "Distance",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    dry_mass_kg: SelectionWrapper<"dry_mass_kg", "Int", 0, {}, undefined>;
    dry_mass_lb: SelectionWrapper<"dry_mass_lb", "Int", 0, {}, undefined>;
    first_flight: SelectionWrapper<"first_flight", "String", 0, {}, undefined>;
    heat_shield: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDragonHeatShieldSelectionInput>,
            "DragonHeatShieldSelection",
            "DragonHeatShield",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    height_w_trunk: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDistanceSelectionInput>,
            "DistanceSelection",
            "Distance",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    id: SelectionWrapper<"id", "ID", 0, {}, undefined>;
    launch_payload_mass: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeMassSelectionInput>,
            "MassSelection",
            "Mass",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    launch_payload_vol: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVolumeSelectionInput>,
            "VolumeSelection",
            "Volume",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
    orbit_duration_yr: SelectionWrapper<
        "orbit_duration_yr",
        "Int",
        0,
        {},
        undefined
    >;
    pressurized_capsule: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDragonPressurizedCapsuleSelectionInput>,
            "DragonPressurizedCapsuleSelection",
            "DragonPressurizedCapsule",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    return_payload_mass: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeMassSelectionInput>,
            "MassSelection",
            "Mass",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    return_payload_vol: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVolumeSelectionInput>,
            "VolumeSelection",
            "Volume",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    sidewall_angle_deg: SelectionWrapper<
        "sidewall_angle_deg",
        "Float",
        0,
        {},
        undefined
    >;
    thrusters: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDragonThrustArraySelectionInput>,
            "DragonThrustArraySelection",
            "DragonThrust",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    trunk: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDragonTrunkSelectionInput>,
            "DragonTrunkSelection",
            "DragonTrunk",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    type: SelectionWrapper<"type", "String", 0, {}, undefined>;
    wikipedia: SelectionWrapper<"wikipedia", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeDragonSelectionInput>
    >;
};

export function makeDragonSelectionInput(
    this: any,
): ReturnTypeFromDragonSelection {
    return {
        active: new SelectionWrapper(
            "active",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        crew_capacity: new SelectionWrapper(
            "crew_capacity",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        description: new SelectionWrapper(
            "description",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        diameter: DistanceSelection.bind({
            collector: this,
            fieldName: "diameter",
        }),
        dry_mass_kg: new SelectionWrapper(
            "dry_mass_kg",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        dry_mass_lb: new SelectionWrapper(
            "dry_mass_lb",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        first_flight: new SelectionWrapper(
            "first_flight",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        heat_shield: DragonHeatShieldSelection.bind({
            collector: this,
            fieldName: "heat_shield",
        }),
        height_w_trunk: DistanceSelection.bind({
            collector: this,
            fieldName: "height_w_trunk",
        }),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        launch_payload_mass: MassSelection.bind({
            collector: this,
            fieldName: "launch_payload_mass",
        }),
        launch_payload_vol: VolumeSelection.bind({
            collector: this,
            fieldName: "launch_payload_vol",
        }),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        orbit_duration_yr: new SelectionWrapper(
            "orbit_duration_yr",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        pressurized_capsule: DragonPressurizedCapsuleSelection.bind({
            collector: this,
            fieldName: "pressurized_capsule",
        }),
        return_payload_mass: MassSelection.bind({
            collector: this,
            fieldName: "return_payload_mass",
        }),
        return_payload_vol: VolumeSelection.bind({
            collector: this,
            fieldName: "return_payload_vol",
        }),
        sidewall_angle_deg: new SelectionWrapper(
            "sidewall_angle_deg",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        thrusters: DragonThrustArraySelection.bind({
            collector: this,
            fieldName: "thrusters",
        }),
        trunk: DragonTrunkSelection.bind({
            collector: this,
            fieldName: "trunk",
        }),
        type: new SelectionWrapper("type", "String", 0, {}, this, undefined),
        wikipedia: new SelectionWrapper(
            "wikipedia",
            "String",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeDragonSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeDragonSelectionInput>>,
    } as const;
}
export const DragonSelection = makeSLFN(
    makeDragonSelectionInput,
    "DragonSelection",
    "Dragon",
    0,
);

type ReturnTypeFromDistanceSelection = {
    feet: SelectionWrapper<"feet", "Float", 0, {}, undefined>;
    meters: SelectionWrapper<"meters", "Float", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeDistanceSelectionInput>
    >;
};

export function makeDistanceSelectionInput(
    this: any,
): ReturnTypeFromDistanceSelection {
    return {
        feet: new SelectionWrapper("feet", "Float", 0, {}, this, undefined),
        meters: new SelectionWrapper("meters", "Float", 0, {}, this, undefined),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeDistanceSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeDistanceSelectionInput>
            >,
    } as const;
}
export const DistanceSelection = makeSLFN(
    makeDistanceSelectionInput,
    "DistanceSelection",
    "Distance",
    0,
);

type ReturnTypeFromDragonHeatShieldSelection = {
    dev_partner: SelectionWrapper<"dev_partner", "String", 0, {}, undefined>;
    material: SelectionWrapper<"material", "String", 0, {}, undefined>;
    size_meters: SelectionWrapper<"size_meters", "Float", 0, {}, undefined>;
    temp_degrees: SelectionWrapper<"temp_degrees", "Int", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeDragonHeatShieldSelectionInput>
    >;
};

export function makeDragonHeatShieldSelectionInput(
    this: any,
): ReturnTypeFromDragonHeatShieldSelection {
    return {
        dev_partner: new SelectionWrapper(
            "dev_partner",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        material: new SelectionWrapper(
            "material",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        size_meters: new SelectionWrapper(
            "size_meters",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        temp_degrees: new SelectionWrapper(
            "temp_degrees",
            "Int",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeDragonHeatShieldSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeDragonHeatShieldSelectionInput>
            >,
    } as const;
}
export const DragonHeatShieldSelection = makeSLFN(
    makeDragonHeatShieldSelectionInput,
    "DragonHeatShieldSelection",
    "DragonHeatShield",
    0,
);

type ReturnTypeFromMassSelection = {
    kg: SelectionWrapper<"kg", "Int", 0, {}, undefined>;
    lb: SelectionWrapper<"lb", "Int", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeMassSelectionInput>
    >;
};

export function makeMassSelectionInput(this: any): ReturnTypeFromMassSelection {
    return {
        kg: new SelectionWrapper("kg", "Int", 0, {}, this, undefined),
        lb: new SelectionWrapper("lb", "Int", 0, {}, this, undefined),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeMassSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeMassSelectionInput>>,
    } as const;
}
export const MassSelection = makeSLFN(
    makeMassSelectionInput,
    "MassSelection",
    "Mass",
    0,
);

type ReturnTypeFromVolumeSelection = {
    cubic_feet: SelectionWrapper<"cubic_feet", "Int", 0, {}, undefined>;
    cubic_meters: SelectionWrapper<"cubic_meters", "Int", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeVolumeSelectionInput>
    >;
};

export function makeVolumeSelectionInput(
    this: any,
): ReturnTypeFromVolumeSelection {
    return {
        cubic_feet: new SelectionWrapper(
            "cubic_feet",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        cubic_meters: new SelectionWrapper(
            "cubic_meters",
            "Int",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeVolumeSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeVolumeSelectionInput>>,
    } as const;
}
export const VolumeSelection = makeSLFN(
    makeVolumeSelectionInput,
    "VolumeSelection",
    "Volume",
    0,
);

type ReturnTypeFromDragonPressurizedCapsuleSelection = {
    payload_volume: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVolumeSelectionInput>,
            "VolumeSelection",
            "Volume",
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

export function makeDragonPressurizedCapsuleSelectionInput(
    this: any,
): ReturnTypeFromDragonPressurizedCapsuleSelection {
    return {
        payload_volume: VolumeSelection.bind({
            collector: this,
            fieldName: "payload_volume",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,
    } as const;
}
export const DragonPressurizedCapsuleSelection = makeSLFN(
    makeDragonPressurizedCapsuleSelectionInput,
    "DragonPressurizedCapsuleSelection",
    "DragonPressurizedCapsule",
    0,
);

type ReturnTypeFromDragonThrustArraySelection = {
    amount: SelectionWrapper<"amount", "Int", 0, {}, undefined>;
    fuel_1: SelectionWrapper<"fuel_1", "String", 0, {}, undefined>;
    fuel_2: SelectionWrapper<"fuel_2", "String", 0, {}, undefined>;
    pods: SelectionWrapper<"pods", "Int", 0, {}, undefined>;
    thrust: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeForceSelectionInput>,
            "ForceSelection",
            "Force",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    type: SelectionWrapper<"type", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeDragonThrustArraySelectionInput>
    >;
};

export function makeDragonThrustArraySelectionInput(
    this: any,
): ReturnTypeFromDragonThrustArraySelection {
    return {
        amount: new SelectionWrapper("amount", "Int", 0, {}, this, undefined),
        fuel_1: new SelectionWrapper(
            "fuel_1",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        fuel_2: new SelectionWrapper(
            "fuel_2",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        pods: new SelectionWrapper("pods", "Int", 0, {}, this, undefined),
        thrust: ForceSelection.bind({ collector: this, fieldName: "thrust" }),
        type: new SelectionWrapper("type", "String", 0, {}, this, undefined),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeDragonThrustArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeDragonThrustArraySelectionInput>
            >,
    } as const;
}
export const DragonThrustArraySelection = makeSLFN(
    makeDragonThrustArraySelectionInput,
    "DragonThrustArraySelection",
    "DragonThrust",
    1,
);

type ReturnTypeFromForceSelection = {
    kN: SelectionWrapper<"kN", "Float", 0, {}, undefined>;
    lbf: SelectionWrapper<"lbf", "Float", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeForceSelectionInput>
    >;
};

export function makeForceSelectionInput(
    this: any,
): ReturnTypeFromForceSelection {
    return {
        kN: new SelectionWrapper("kN", "Float", 0, {}, this, undefined),
        lbf: new SelectionWrapper("lbf", "Float", 0, {}, this, undefined),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeForceSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeForceSelectionInput>>,
    } as const;
}
export const ForceSelection = makeSLFN(
    makeForceSelectionInput,
    "ForceSelection",
    "Force",
    0,
);

type ReturnTypeFromDragonTrunkSelection = {
    cargo: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDragonTrunkCargoSelectionInput>,
            "DragonTrunkCargoSelection",
            "DragonTrunkCargo",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    trunk_volume: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVolumeSelectionInput>,
            "VolumeSelection",
            "Volume",
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

export function makeDragonTrunkSelectionInput(
    this: any,
): ReturnTypeFromDragonTrunkSelection {
    return {
        cargo: DragonTrunkCargoSelection.bind({
            collector: this,
            fieldName: "cargo",
        }),
        trunk_volume: VolumeSelection.bind({
            collector: this,
            fieldName: "trunk_volume",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,
    } as const;
}
export const DragonTrunkSelection = makeSLFN(
    makeDragonTrunkSelectionInput,
    "DragonTrunkSelection",
    "DragonTrunk",
    0,
);

type ReturnTypeFromDragonTrunkCargoSelection = {
    solar_array: SelectionWrapper<"solar_array", "Int", 0, {}, undefined>;
    unpressurized_cargo: SelectionWrapper<
        "unpressurized_cargo",
        "Boolean",
        0,
        {},
        undefined
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeDragonTrunkCargoSelectionInput>
    >;
};

export function makeDragonTrunkCargoSelectionInput(
    this: any,
): ReturnTypeFromDragonTrunkCargoSelection {
    return {
        solar_array: new SelectionWrapper(
            "solar_array",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        unpressurized_cargo: new SelectionWrapper(
            "unpressurized_cargo",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeDragonTrunkCargoSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeDragonTrunkCargoSelectionInput>
            >,
    } as const;
}
export const DragonTrunkCargoSelection = makeSLFN(
    makeDragonTrunkCargoSelectionInput,
    "DragonTrunkCargoSelection",
    "DragonTrunkCargo",
    0,
);

type ReturnTypeFromCapsuleMissionArraySelection = {
    flight: SelectionWrapper<"flight", "Int", 0, {}, undefined>;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeCapsuleMissionArraySelectionInput>
    >;
};

export function makeCapsuleMissionArraySelectionInput(
    this: any,
): ReturnTypeFromCapsuleMissionArraySelection {
    return {
        flight: new SelectionWrapper("flight", "Int", 0, {}, this, undefined),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeCapsuleMissionArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeCapsuleMissionArraySelectionInput>
            >,
    } as const;
}
export const CapsuleMissionArraySelection = makeSLFN(
    makeCapsuleMissionArraySelectionInput,
    "CapsuleMissionArraySelection",
    "CapsuleMission",
    1,
);

type ReturnTypeFromCapsuleSelection = {
    dragon: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDragonSelectionInput>,
            "DragonSelection",
            "Dragon",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    id: SelectionWrapper<"id", "ID", 0, {}, undefined>;
    landings: SelectionWrapper<"landings", "Int", 0, {}, undefined>;
    missions: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCapsuleMissionArraySelectionInput>,
            "CapsuleMissionArraySelection",
            "CapsuleMission",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    original_launch: SelectionWrapper<
        "original_launch",
        "Date",
        0,
        {},
        undefined
    >;
    reuse_count: SelectionWrapper<"reuse_count", "Int", 0, {}, undefined>;
    status: SelectionWrapper<"status", "String", 0, {}, undefined>;
    type: SelectionWrapper<"type", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeCapsuleSelectionInput>
    >;
};

export function makeCapsuleSelectionInput(
    this: any,
): ReturnTypeFromCapsuleSelection {
    return {
        dragon: DragonSelection.bind({ collector: this, fieldName: "dragon" }),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        landings: new SelectionWrapper(
            "landings",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        missions: CapsuleMissionArraySelection.bind({
            collector: this,
            fieldName: "missions",
        }),
        original_launch: new SelectionWrapper(
            "original_launch",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        reuse_count: new SelectionWrapper(
            "reuse_count",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        status: new SelectionWrapper(
            "status",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        type: new SelectionWrapper("type", "String", 0, {}, this, undefined),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeCapsuleSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeCapsuleSelectionInput>
            >,
    } as const;
}
export const CapsuleSelection = makeSLFN(
    makeCapsuleSelectionInput,
    "CapsuleSelection",
    "Capsule",
    0,
);

type ReturnTypeFromCapsuleArraySelection = {
    dragon: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDragonSelectionInput>,
            "DragonSelection",
            "Dragon",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    id: SelectionWrapper<"id", "ID", 0, {}, undefined>;
    landings: SelectionWrapper<"landings", "Int", 0, {}, undefined>;
    missions: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCapsuleMissionArraySelectionInput>,
            "CapsuleMissionArraySelection",
            "CapsuleMission",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    original_launch: SelectionWrapper<
        "original_launch",
        "Date",
        0,
        {},
        undefined
    >;
    reuse_count: SelectionWrapper<"reuse_count", "Int", 0, {}, undefined>;
    status: SelectionWrapper<"status", "String", 0, {}, undefined>;
    type: SelectionWrapper<"type", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeCapsuleArraySelectionInput>
    >;
};

export function makeCapsuleArraySelectionInput(
    this: any,
): ReturnTypeFromCapsuleArraySelection {
    return {
        dragon: DragonSelection.bind({ collector: this, fieldName: "dragon" }),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        landings: new SelectionWrapper(
            "landings",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        missions: CapsuleMissionArraySelection.bind({
            collector: this,
            fieldName: "missions",
        }),
        original_launch: new SelectionWrapper(
            "original_launch",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        reuse_count: new SelectionWrapper(
            "reuse_count",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        status: new SelectionWrapper(
            "status",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        type: new SelectionWrapper("type", "String", 0, {}, this, undefined),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeCapsuleArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeCapsuleArraySelectionInput>
            >,
    } as const;
}
export const CapsuleArraySelection = makeSLFN(
    makeCapsuleArraySelectionInput,
    "CapsuleArraySelection",
    "Capsule",
    1,
);

type ReturnTypeFromAddressSelection = {
    address: SelectionWrapper<"address", "String", 0, {}, undefined>;
    city: SelectionWrapper<"city", "String", 0, {}, undefined>;
    state: SelectionWrapper<"state", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeAddressSelectionInput>
    >;
};

export function makeAddressSelectionInput(
    this: any,
): ReturnTypeFromAddressSelection {
    return {
        address: new SelectionWrapper(
            "address",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        city: new SelectionWrapper("city", "String", 0, {}, this, undefined),
        state: new SelectionWrapper("state", "String", 0, {}, this, undefined),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeAddressSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeAddressSelectionInput>
            >,
    } as const;
}
export const AddressSelection = makeSLFN(
    makeAddressSelectionInput,
    "AddressSelection",
    "Address",
    0,
);

type ReturnTypeFromInfoLinksSelection = {
    elon_twitter: SelectionWrapper<"elon_twitter", "String", 0, {}, undefined>;
    flickr: SelectionWrapper<"flickr", "String", 0, {}, undefined>;
    twitter: SelectionWrapper<"twitter", "String", 0, {}, undefined>;
    website: SelectionWrapper<"website", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeInfoLinksSelectionInput>
    >;
};

export function makeInfoLinksSelectionInput(
    this: any,
): ReturnTypeFromInfoLinksSelection {
    return {
        elon_twitter: new SelectionWrapper(
            "elon_twitter",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        flickr: new SelectionWrapper(
            "flickr",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        twitter: new SelectionWrapper(
            "twitter",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        website: new SelectionWrapper(
            "website",
            "String",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeInfoLinksSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeInfoLinksSelectionInput>
            >,
    } as const;
}
export const InfoLinksSelection = makeSLFN(
    makeInfoLinksSelectionInput,
    "InfoLinksSelection",
    "InfoLinks",
    0,
);

type ReturnTypeFromInfoSelection = {
    ceo: SelectionWrapper<"ceo", "String", 0, {}, undefined>;
    coo: SelectionWrapper<"coo", "String", 0, {}, undefined>;
    cto: SelectionWrapper<"cto", "String", 0, {}, undefined>;
    cto_propulsion: SelectionWrapper<
        "cto_propulsion",
        "String",
        0,
        {},
        undefined
    >;
    employees: SelectionWrapper<"employees", "Int", 0, {}, undefined>;
    founded: SelectionWrapper<"founded", "Int", 0, {}, undefined>;
    founder: SelectionWrapper<"founder", "String", 0, {}, undefined>;
    headquarters: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeAddressSelectionInput>,
            "AddressSelection",
            "Address",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    launch_sites: SelectionWrapper<"launch_sites", "Int", 0, {}, undefined>;
    links: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeInfoLinksSelectionInput>,
            "InfoLinksSelection",
            "InfoLinks",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
    summary: SelectionWrapper<"summary", "String", 0, {}, undefined>;
    test_sites: SelectionWrapper<"test_sites", "Int", 0, {}, undefined>;
    valuation: SelectionWrapper<"valuation", "Float", 0, {}, undefined>;
    vehicles: SelectionWrapper<"vehicles", "Int", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeInfoSelectionInput>
    >;
};

export function makeInfoSelectionInput(this: any): ReturnTypeFromInfoSelection {
    return {
        ceo: new SelectionWrapper("ceo", "String", 0, {}, this, undefined),
        coo: new SelectionWrapper("coo", "String", 0, {}, this, undefined),
        cto: new SelectionWrapper("cto", "String", 0, {}, this, undefined),
        cto_propulsion: new SelectionWrapper(
            "cto_propulsion",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        employees: new SelectionWrapper(
            "employees",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        founded: new SelectionWrapper("founded", "Int", 0, {}, this, undefined),
        founder: new SelectionWrapper(
            "founder",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        headquarters: AddressSelection.bind({
            collector: this,
            fieldName: "headquarters",
        }),
        launch_sites: new SelectionWrapper(
            "launch_sites",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        links: InfoLinksSelection.bind({ collector: this, fieldName: "links" }),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        summary: new SelectionWrapper(
            "summary",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        test_sites: new SelectionWrapper(
            "test_sites",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        valuation: new SelectionWrapper(
            "valuation",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        vehicles: new SelectionWrapper(
            "vehicles",
            "Int",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeInfoSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeInfoSelectionInput>>,
    } as const;
}
export const InfoSelection = makeSLFN(
    makeInfoSelectionInput,
    "InfoSelection",
    "Info",
    0,
);

type ReturnTypeFromCoreSelection = {
    asds_attempts: SelectionWrapper<"asds_attempts", "Int", 0, {}, undefined>;
    asds_landings: SelectionWrapper<"asds_landings", "Int", 0, {}, undefined>;
    block: SelectionWrapper<"block", "Int", 0, {}, undefined>;
    id: SelectionWrapper<"id", "ID", 0, {}, undefined>;
    missions: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCapsuleMissionArraySelectionInput>,
            "CapsuleMissionArraySelection",
            "CapsuleMission",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    original_launch: SelectionWrapper<
        "original_launch",
        "Date",
        0,
        {},
        undefined
    >;
    reuse_count: SelectionWrapper<"reuse_count", "Int", 0, {}, undefined>;
    rtls_attempts: SelectionWrapper<"rtls_attempts", "Int", 0, {}, undefined>;
    rtls_landings: SelectionWrapper<"rtls_landings", "Int", 0, {}, undefined>;
    status: SelectionWrapper<"status", "String", 0, {}, undefined>;
    water_landing: SelectionWrapper<
        "water_landing",
        "Boolean",
        0,
        {},
        undefined
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeCoreSelectionInput>
    >;
};

export function makeCoreSelectionInput(this: any): ReturnTypeFromCoreSelection {
    return {
        asds_attempts: new SelectionWrapper(
            "asds_attempts",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        asds_landings: new SelectionWrapper(
            "asds_landings",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        block: new SelectionWrapper("block", "Int", 0, {}, this, undefined),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        missions: CapsuleMissionArraySelection.bind({
            collector: this,
            fieldName: "missions",
        }),
        original_launch: new SelectionWrapper(
            "original_launch",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        reuse_count: new SelectionWrapper(
            "reuse_count",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        rtls_attempts: new SelectionWrapper(
            "rtls_attempts",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        rtls_landings: new SelectionWrapper(
            "rtls_landings",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        status: new SelectionWrapper(
            "status",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        water_landing: new SelectionWrapper(
            "water_landing",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeCoreSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeCoreSelectionInput>>,
    } as const;
}
export const CoreSelection = makeSLFN(
    makeCoreSelectionInput,
    "CoreSelection",
    "Core",
    0,
);

type ReturnTypeFromCoreArraySelection = {
    asds_attempts: SelectionWrapper<"asds_attempts", "Int", 0, {}, undefined>;
    asds_landings: SelectionWrapper<"asds_landings", "Int", 0, {}, undefined>;
    block: SelectionWrapper<"block", "Int", 0, {}, undefined>;
    id: SelectionWrapper<"id", "ID", 0, {}, undefined>;
    missions: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCapsuleMissionArraySelectionInput>,
            "CapsuleMissionArraySelection",
            "CapsuleMission",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    original_launch: SelectionWrapper<
        "original_launch",
        "Date",
        0,
        {},
        undefined
    >;
    reuse_count: SelectionWrapper<"reuse_count", "Int", 0, {}, undefined>;
    rtls_attempts: SelectionWrapper<"rtls_attempts", "Int", 0, {}, undefined>;
    rtls_landings: SelectionWrapper<"rtls_landings", "Int", 0, {}, undefined>;
    status: SelectionWrapper<"status", "String", 0, {}, undefined>;
    water_landing: SelectionWrapper<
        "water_landing",
        "Boolean",
        0,
        {},
        undefined
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeCoreArraySelectionInput>
    >;
};

export function makeCoreArraySelectionInput(
    this: any,
): ReturnTypeFromCoreArraySelection {
    return {
        asds_attempts: new SelectionWrapper(
            "asds_attempts",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        asds_landings: new SelectionWrapper(
            "asds_landings",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        block: new SelectionWrapper("block", "Int", 0, {}, this, undefined),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        missions: CapsuleMissionArraySelection.bind({
            collector: this,
            fieldName: "missions",
        }),
        original_launch: new SelectionWrapper(
            "original_launch",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        reuse_count: new SelectionWrapper(
            "reuse_count",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        rtls_attempts: new SelectionWrapper(
            "rtls_attempts",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        rtls_landings: new SelectionWrapper(
            "rtls_landings",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        status: new SelectionWrapper(
            "status",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        water_landing: new SelectionWrapper(
            "water_landing",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeCoreArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeCoreArraySelectionInput>
            >,
    } as const;
}
export const CoreArraySelection = makeSLFN(
    makeCoreArraySelectionInput,
    "CoreArraySelection",
    "Core",
    1,
);

type ReturnTypeFromDragonArraySelection = {
    active: SelectionWrapper<"active", "Boolean", 0, {}, undefined>;
    crew_capacity: SelectionWrapper<"crew_capacity", "Int", 0, {}, undefined>;
    description: SelectionWrapper<"description", "String", 0, {}, undefined>;
    diameter: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDistanceSelectionInput>,
            "DistanceSelection",
            "Distance",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    dry_mass_kg: SelectionWrapper<"dry_mass_kg", "Int", 0, {}, undefined>;
    dry_mass_lb: SelectionWrapper<"dry_mass_lb", "Int", 0, {}, undefined>;
    first_flight: SelectionWrapper<"first_flight", "String", 0, {}, undefined>;
    heat_shield: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDragonHeatShieldSelectionInput>,
            "DragonHeatShieldSelection",
            "DragonHeatShield",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    height_w_trunk: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDistanceSelectionInput>,
            "DistanceSelection",
            "Distance",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    id: SelectionWrapper<"id", "ID", 0, {}, undefined>;
    launch_payload_mass: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeMassSelectionInput>,
            "MassSelection",
            "Mass",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    launch_payload_vol: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVolumeSelectionInput>,
            "VolumeSelection",
            "Volume",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
    orbit_duration_yr: SelectionWrapper<
        "orbit_duration_yr",
        "Int",
        0,
        {},
        undefined
    >;
    pressurized_capsule: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDragonPressurizedCapsuleSelectionInput>,
            "DragonPressurizedCapsuleSelection",
            "DragonPressurizedCapsule",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    return_payload_mass: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeMassSelectionInput>,
            "MassSelection",
            "Mass",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    return_payload_vol: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVolumeSelectionInput>,
            "VolumeSelection",
            "Volume",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    sidewall_angle_deg: SelectionWrapper<
        "sidewall_angle_deg",
        "Float",
        0,
        {},
        undefined
    >;
    thrusters: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDragonThrustArraySelectionInput>,
            "DragonThrustArraySelection",
            "DragonThrust",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    trunk: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDragonTrunkSelectionInput>,
            "DragonTrunkSelection",
            "DragonTrunk",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    type: SelectionWrapper<"type", "String", 0, {}, undefined>;
    wikipedia: SelectionWrapper<"wikipedia", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeDragonArraySelectionInput>
    >;
};

export function makeDragonArraySelectionInput(
    this: any,
): ReturnTypeFromDragonArraySelection {
    return {
        active: new SelectionWrapper(
            "active",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        crew_capacity: new SelectionWrapper(
            "crew_capacity",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        description: new SelectionWrapper(
            "description",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        diameter: DistanceSelection.bind({
            collector: this,
            fieldName: "diameter",
        }),
        dry_mass_kg: new SelectionWrapper(
            "dry_mass_kg",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        dry_mass_lb: new SelectionWrapper(
            "dry_mass_lb",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        first_flight: new SelectionWrapper(
            "first_flight",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        heat_shield: DragonHeatShieldSelection.bind({
            collector: this,
            fieldName: "heat_shield",
        }),
        height_w_trunk: DistanceSelection.bind({
            collector: this,
            fieldName: "height_w_trunk",
        }),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        launch_payload_mass: MassSelection.bind({
            collector: this,
            fieldName: "launch_payload_mass",
        }),
        launch_payload_vol: VolumeSelection.bind({
            collector: this,
            fieldName: "launch_payload_vol",
        }),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        orbit_duration_yr: new SelectionWrapper(
            "orbit_duration_yr",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        pressurized_capsule: DragonPressurizedCapsuleSelection.bind({
            collector: this,
            fieldName: "pressurized_capsule",
        }),
        return_payload_mass: MassSelection.bind({
            collector: this,
            fieldName: "return_payload_mass",
        }),
        return_payload_vol: VolumeSelection.bind({
            collector: this,
            fieldName: "return_payload_vol",
        }),
        sidewall_angle_deg: new SelectionWrapper(
            "sidewall_angle_deg",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        thrusters: DragonThrustArraySelection.bind({
            collector: this,
            fieldName: "thrusters",
        }),
        trunk: DragonTrunkSelection.bind({
            collector: this,
            fieldName: "trunk",
        }),
        type: new SelectionWrapper("type", "String", 0, {}, this, undefined),
        wikipedia: new SelectionWrapper(
            "wikipedia",
            "String",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeDragonArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeDragonArraySelectionInput>
            >,
    } as const;
}
export const DragonArraySelection = makeSLFN(
    makeDragonArraySelectionInput,
    "DragonArraySelection",
    "Dragon",
    1,
);

type ReturnTypeFromLaunchSelection = {
    details: SelectionWrapper<"details", "String", 0, {}, undefined>;
    id: SelectionWrapper<"id", "ID", 0, {}, undefined>;
    is_tentative: SelectionWrapper<"is_tentative", "Boolean", 0, {}, undefined>;
    launch_date_local: SelectionWrapper<
        "launch_date_local",
        "Date",
        0,
        {},
        undefined
    >;
    launch_date_unix: SelectionWrapper<
        "launch_date_unix",
        "Date",
        0,
        {},
        undefined
    >;
    launch_date_utc: SelectionWrapper<
        "launch_date_utc",
        "Date",
        0,
        {},
        undefined
    >;
    launch_site: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchSiteSelectionInput>,
            "LaunchSiteSelection",
            "LaunchSite",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    launch_success: SelectionWrapper<
        "launch_success",
        "Boolean",
        0,
        {},
        undefined
    >;
    launch_year: SelectionWrapper<"launch_year", "String", 0, {}, undefined>;
    links: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchLinksSelectionInput>,
            "LaunchLinksSelection",
            "LaunchLinks",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    mission_id: SelectionWrapper<"mission_id", "String", 1, {}, undefined>;
    mission_name: SelectionWrapper<"mission_name", "String", 0, {}, undefined>;
    rocket: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchRocketSelectionInput>,
            "LaunchRocketSelection",
            "LaunchRocket",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    ships: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeShipArraySelectionInput>,
            "ShipArraySelection",
            "Ship",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    static_fire_date_unix: SelectionWrapper<
        "static_fire_date_unix",
        "Date",
        0,
        {},
        undefined
    >;
    static_fire_date_utc: SelectionWrapper<
        "static_fire_date_utc",
        "Date",
        0,
        {},
        undefined
    >;
    telemetry: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchTelemetrySelectionInput>,
            "LaunchTelemetrySelection",
            "LaunchTelemetry",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    tentative_max_precision: SelectionWrapper<
        "tentative_max_precision",
        "String",
        0,
        {},
        undefined
    >;
    upcoming: SelectionWrapper<"upcoming", "Boolean", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchSelectionInput>
    >;
};

export function makeLaunchSelectionInput(
    this: any,
): ReturnTypeFromLaunchSelection {
    return {
        details: new SelectionWrapper(
            "details",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        is_tentative: new SelectionWrapper(
            "is_tentative",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        launch_date_local: new SelectionWrapper(
            "launch_date_local",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        launch_date_unix: new SelectionWrapper(
            "launch_date_unix",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        launch_date_utc: new SelectionWrapper(
            "launch_date_utc",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        launch_site: LaunchSiteSelection.bind({
            collector: this,
            fieldName: "launch_site",
        }),
        launch_success: new SelectionWrapper(
            "launch_success",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        launch_year: new SelectionWrapper(
            "launch_year",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        links: LaunchLinksSelection.bind({
            collector: this,
            fieldName: "links",
        }),
        mission_id: new SelectionWrapper(
            "mission_id",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        mission_name: new SelectionWrapper(
            "mission_name",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        rocket: LaunchRocketSelection.bind({
            collector: this,
            fieldName: "rocket",
        }),
        ships: ShipArraySelection.bind({ collector: this, fieldName: "ships" }),
        static_fire_date_unix: new SelectionWrapper(
            "static_fire_date_unix",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        static_fire_date_utc: new SelectionWrapper(
            "static_fire_date_utc",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        telemetry: LaunchTelemetrySelection.bind({
            collector: this,
            fieldName: "telemetry",
        }),
        tentative_max_precision: new SelectionWrapper(
            "tentative_max_precision",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        upcoming: new SelectionWrapper(
            "upcoming",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLaunchSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeLaunchSelectionInput>>,
    } as const;
}
export const LaunchSelection = makeSLFN(
    makeLaunchSelectionInput,
    "LaunchSelection",
    "Launch",
    0,
);

type ReturnTypeFromLaunchSiteSelection = {
    site_id: SelectionWrapper<"site_id", "String", 0, {}, undefined>;
    site_name: SelectionWrapper<"site_name", "String", 0, {}, undefined>;
    site_name_long: SelectionWrapper<
        "site_name_long",
        "String",
        0,
        {},
        undefined
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchSiteSelectionInput>
    >;
};

export function makeLaunchSiteSelectionInput(
    this: any,
): ReturnTypeFromLaunchSiteSelection {
    return {
        site_id: new SelectionWrapper(
            "site_id",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        site_name: new SelectionWrapper(
            "site_name",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        site_name_long: new SelectionWrapper(
            "site_name_long",
            "String",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLaunchSiteSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchSiteSelectionInput>
            >,
    } as const;
}
export const LaunchSiteSelection = makeSLFN(
    makeLaunchSiteSelectionInput,
    "LaunchSiteSelection",
    "LaunchSite",
    0,
);

type ReturnTypeFromLaunchLinksSelection = {
    article_link: SelectionWrapper<"article_link", "String", 0, {}, undefined>;
    flickr_images: SelectionWrapper<
        "flickr_images",
        "String",
        1,
        {},
        undefined
    >;
    mission_patch: SelectionWrapper<
        "mission_patch",
        "String",
        0,
        {},
        undefined
    >;
    mission_patch_small: SelectionWrapper<
        "mission_patch_small",
        "String",
        0,
        {},
        undefined
    >;
    presskit: SelectionWrapper<"presskit", "String", 0, {}, undefined>;
    reddit_campaign: SelectionWrapper<
        "reddit_campaign",
        "String",
        0,
        {},
        undefined
    >;
    reddit_launch: SelectionWrapper<
        "reddit_launch",
        "String",
        0,
        {},
        undefined
    >;
    reddit_media: SelectionWrapper<"reddit_media", "String", 0, {}, undefined>;
    reddit_recovery: SelectionWrapper<
        "reddit_recovery",
        "String",
        0,
        {},
        undefined
    >;
    video_link: SelectionWrapper<"video_link", "String", 0, {}, undefined>;
    wikipedia: SelectionWrapper<"wikipedia", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchLinksSelectionInput>
    >;
};

export function makeLaunchLinksSelectionInput(
    this: any,
): ReturnTypeFromLaunchLinksSelection {
    return {
        article_link: new SelectionWrapper(
            "article_link",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        flickr_images: new SelectionWrapper(
            "flickr_images",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        mission_patch: new SelectionWrapper(
            "mission_patch",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        mission_patch_small: new SelectionWrapper(
            "mission_patch_small",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        presskit: new SelectionWrapper(
            "presskit",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        reddit_campaign: new SelectionWrapper(
            "reddit_campaign",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        reddit_launch: new SelectionWrapper(
            "reddit_launch",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        reddit_media: new SelectionWrapper(
            "reddit_media",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        reddit_recovery: new SelectionWrapper(
            "reddit_recovery",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        video_link: new SelectionWrapper(
            "video_link",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        wikipedia: new SelectionWrapper(
            "wikipedia",
            "String",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLaunchLinksSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchLinksSelectionInput>
            >,
    } as const;
}
export const LaunchLinksSelection = makeSLFN(
    makeLaunchLinksSelectionInput,
    "LaunchLinksSelection",
    "LaunchLinks",
    0,
);

type ReturnTypeFromLaunchRocketSelection = {
    fairings: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchRocketFairingsSelectionInput>,
            "LaunchRocketFairingsSelection",
            "LaunchRocketFairings",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    first_stage: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchRocketFirstStageSelectionInput>,
            "LaunchRocketFirstStageSelection",
            "LaunchRocketFirstStage",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    rocket: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketSelectionInput>,
            "RocketSelection",
            "Rocket",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    rocket_name: SelectionWrapper<"rocket_name", "String", 0, {}, undefined>;
    rocket_type: SelectionWrapper<"rocket_type", "String", 0, {}, undefined>;
    second_stage: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchRocketSecondStageSelectionInput>,
            "LaunchRocketSecondStageSelection",
            "LaunchRocketSecondStage",
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

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchRocketSelectionInput>
    >;
};

export function makeLaunchRocketSelectionInput(
    this: any,
): ReturnTypeFromLaunchRocketSelection {
    return {
        fairings: LaunchRocketFairingsSelection.bind({
            collector: this,
            fieldName: "fairings",
        }),
        first_stage: LaunchRocketFirstStageSelection.bind({
            collector: this,
            fieldName: "first_stage",
        }),
        rocket: RocketSelection.bind({ collector: this, fieldName: "rocket" }),
        rocket_name: new SelectionWrapper(
            "rocket_name",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        rocket_type: new SelectionWrapper(
            "rocket_type",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        second_stage: LaunchRocketSecondStageSelection.bind({
            collector: this,
            fieldName: "second_stage",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLaunchRocketSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchRocketSelectionInput>
            >,
    } as const;
}
export const LaunchRocketSelection = makeSLFN(
    makeLaunchRocketSelectionInput,
    "LaunchRocketSelection",
    "LaunchRocket",
    0,
);

type ReturnTypeFromLaunchRocketFairingsSelection = {
    recovered: SelectionWrapper<"recovered", "Boolean", 0, {}, undefined>;
    recovery_attempt: SelectionWrapper<
        "recovery_attempt",
        "Boolean",
        0,
        {},
        undefined
    >;
    reused: SelectionWrapper<"reused", "Boolean", 0, {}, undefined>;
    ship: SelectionWrapper<"ship", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchRocketFairingsSelectionInput>
    >;
};

export function makeLaunchRocketFairingsSelectionInput(
    this: any,
): ReturnTypeFromLaunchRocketFairingsSelection {
    return {
        recovered: new SelectionWrapper(
            "recovered",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        recovery_attempt: new SelectionWrapper(
            "recovery_attempt",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        reused: new SelectionWrapper(
            "reused",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        ship: new SelectionWrapper("ship", "String", 0, {}, this, undefined),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLaunchRocketFairingsSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchRocketFairingsSelectionInput>
            >,
    } as const;
}
export const LaunchRocketFairingsSelection = makeSLFN(
    makeLaunchRocketFairingsSelectionInput,
    "LaunchRocketFairingsSelection",
    "LaunchRocketFairings",
    0,
);

type ReturnTypeFromLaunchRocketFirstStageSelection = {
    cores: ReturnType<
        SLFN<
            {},
            ReturnType<
                typeof makeLaunchRocketFirstStageCoreArraySelectionInput
            >,
            "LaunchRocketFirstStageCoreArraySelection",
            "LaunchRocketFirstStageCore",
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

export function makeLaunchRocketFirstStageSelectionInput(
    this: any,
): ReturnTypeFromLaunchRocketFirstStageSelection {
    return {
        cores: LaunchRocketFirstStageCoreArraySelection.bind({
            collector: this,
            fieldName: "cores",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,
    } as const;
}
export const LaunchRocketFirstStageSelection = makeSLFN(
    makeLaunchRocketFirstStageSelectionInput,
    "LaunchRocketFirstStageSelection",
    "LaunchRocketFirstStage",
    0,
);

type ReturnTypeFromLaunchRocketFirstStageCoreArraySelection = {
    block: SelectionWrapper<"block", "Int", 0, {}, undefined>;
    core: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCoreSelectionInput>,
            "CoreSelection",
            "Core",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    flight: SelectionWrapper<"flight", "Int", 0, {}, undefined>;
    gridfins: SelectionWrapper<"gridfins", "Boolean", 0, {}, undefined>;
    land_success: SelectionWrapper<"land_success", "Boolean", 0, {}, undefined>;
    landing_intent: SelectionWrapper<
        "landing_intent",
        "Boolean",
        0,
        {},
        undefined
    >;
    landing_type: SelectionWrapper<"landing_type", "String", 0, {}, undefined>;
    landing_vehicle: SelectionWrapper<
        "landing_vehicle",
        "String",
        0,
        {},
        undefined
    >;
    legs: SelectionWrapper<"legs", "Boolean", 0, {}, undefined>;
    reused: SelectionWrapper<"reused", "Boolean", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchRocketFirstStageCoreArraySelectionInput>
    >;
};

export function makeLaunchRocketFirstStageCoreArraySelectionInput(
    this: any,
): ReturnTypeFromLaunchRocketFirstStageCoreArraySelection {
    return {
        block: new SelectionWrapper("block", "Int", 0, {}, this, undefined),
        core: CoreSelection.bind({ collector: this, fieldName: "core" }),
        flight: new SelectionWrapper("flight", "Int", 0, {}, this, undefined),
        gridfins: new SelectionWrapper(
            "gridfins",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        land_success: new SelectionWrapper(
            "land_success",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        landing_intent: new SelectionWrapper(
            "landing_intent",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        landing_type: new SelectionWrapper(
            "landing_type",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        landing_vehicle: new SelectionWrapper(
            "landing_vehicle",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        legs: new SelectionWrapper("legs", "Boolean", 0, {}, this, undefined),
        reused: new SelectionWrapper(
            "reused",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLaunchRocketFirstStageCoreArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<
                    typeof makeLaunchRocketFirstStageCoreArraySelectionInput
                >
            >,
    } as const;
}
export const LaunchRocketFirstStageCoreArraySelection = makeSLFN(
    makeLaunchRocketFirstStageCoreArraySelectionInput,
    "LaunchRocketFirstStageCoreArraySelection",
    "LaunchRocketFirstStageCore",
    1,
);

type ReturnTypeFromRocketSelection = {
    active: SelectionWrapper<"active", "Boolean", 0, {}, undefined>;
    boosters: SelectionWrapper<"boosters", "Int", 0, {}, undefined>;
    company: SelectionWrapper<"company", "String", 0, {}, undefined>;
    cost_per_launch: SelectionWrapper<
        "cost_per_launch",
        "Int",
        0,
        {},
        undefined
    >;
    country: SelectionWrapper<"country", "String", 0, {}, undefined>;
    description: SelectionWrapper<"description", "String", 0, {}, undefined>;
    diameter: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDistanceSelectionInput>,
            "DistanceSelection",
            "Distance",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    engines: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketEnginesSelectionInput>,
            "RocketEnginesSelection",
            "RocketEngines",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    first_flight: SelectionWrapper<"first_flight", "Date", 0, {}, undefined>;
    first_stage: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketFirstStageSelectionInput>,
            "RocketFirstStageSelection",
            "RocketFirstStage",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    height: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDistanceSelectionInput>,
            "DistanceSelection",
            "Distance",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    id: SelectionWrapper<"id", "ID", 0, {}, undefined>;
    landing_legs: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketLandingLegsSelectionInput>,
            "RocketLandingLegsSelection",
            "RocketLandingLegs",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    mass: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeMassSelectionInput>,
            "MassSelection",
            "Mass",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
    payload_weights: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketPayloadWeightArraySelectionInput>,
            "RocketPayloadWeightArraySelection",
            "RocketPayloadWeight",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    second_stage: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketSecondStageSelectionInput>,
            "RocketSecondStageSelection",
            "RocketSecondStage",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    stages: SelectionWrapper<"stages", "Int", 0, {}, undefined>;
    success_rate_pct: SelectionWrapper<
        "success_rate_pct",
        "Int",
        0,
        {},
        undefined
    >;
    type: SelectionWrapper<"type", "String", 0, {}, undefined>;
    wikipedia: SelectionWrapper<"wikipedia", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRocketSelectionInput>
    >;
};

export function makeRocketSelectionInput(
    this: any,
): ReturnTypeFromRocketSelection {
    return {
        active: new SelectionWrapper(
            "active",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        boosters: new SelectionWrapper(
            "boosters",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        company: new SelectionWrapper(
            "company",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        cost_per_launch: new SelectionWrapper(
            "cost_per_launch",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        country: new SelectionWrapper(
            "country",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        description: new SelectionWrapper(
            "description",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        diameter: DistanceSelection.bind({
            collector: this,
            fieldName: "diameter",
        }),
        engines: RocketEnginesSelection.bind({
            collector: this,
            fieldName: "engines",
        }),
        first_flight: new SelectionWrapper(
            "first_flight",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        first_stage: RocketFirstStageSelection.bind({
            collector: this,
            fieldName: "first_stage",
        }),
        height: DistanceSelection.bind({
            collector: this,
            fieldName: "height",
        }),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        landing_legs: RocketLandingLegsSelection.bind({
            collector: this,
            fieldName: "landing_legs",
        }),
        mass: MassSelection.bind({ collector: this, fieldName: "mass" }),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        payload_weights: RocketPayloadWeightArraySelection.bind({
            collector: this,
            fieldName: "payload_weights",
        }),
        second_stage: RocketSecondStageSelection.bind({
            collector: this,
            fieldName: "second_stage",
        }),
        stages: new SelectionWrapper("stages", "Int", 0, {}, this, undefined),
        success_rate_pct: new SelectionWrapper(
            "success_rate_pct",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        type: new SelectionWrapper("type", "String", 0, {}, this, undefined),
        wikipedia: new SelectionWrapper(
            "wikipedia",
            "String",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeRocketSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeRocketSelectionInput>>,
    } as const;
}
export const RocketSelection = makeSLFN(
    makeRocketSelectionInput,
    "RocketSelection",
    "Rocket",
    0,
);

type ReturnTypeFromRocketEnginesSelection = {
    engine_loss_max: SelectionWrapper<
        "engine_loss_max",
        "String",
        0,
        {},
        undefined
    >;
    layout: SelectionWrapper<"layout", "String", 0, {}, undefined>;
    number: SelectionWrapper<"number", "Int", 0, {}, undefined>;
    propellant_1: SelectionWrapper<"propellant_1", "String", 0, {}, undefined>;
    propellant_2: SelectionWrapper<"propellant_2", "String", 0, {}, undefined>;
    thrust_sea_level: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeForceSelectionInput>,
            "ForceSelection",
            "Force",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    thrust_to_weight: SelectionWrapper<
        "thrust_to_weight",
        "Float",
        0,
        {},
        undefined
    >;
    thrust_vacuum: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeForceSelectionInput>,
            "ForceSelection",
            "Force",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    type: SelectionWrapper<"type", "String", 0, {}, undefined>;
    version: SelectionWrapper<"version", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRocketEnginesSelectionInput>
    >;
};

export function makeRocketEnginesSelectionInput(
    this: any,
): ReturnTypeFromRocketEnginesSelection {
    return {
        engine_loss_max: new SelectionWrapper(
            "engine_loss_max",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        layout: new SelectionWrapper(
            "layout",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        number: new SelectionWrapper("number", "Int", 0, {}, this, undefined),
        propellant_1: new SelectionWrapper(
            "propellant_1",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        propellant_2: new SelectionWrapper(
            "propellant_2",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        thrust_sea_level: ForceSelection.bind({
            collector: this,
            fieldName: "thrust_sea_level",
        }),
        thrust_to_weight: new SelectionWrapper(
            "thrust_to_weight",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        thrust_vacuum: ForceSelection.bind({
            collector: this,
            fieldName: "thrust_vacuum",
        }),
        type: new SelectionWrapper("type", "String", 0, {}, this, undefined),
        version: new SelectionWrapper(
            "version",
            "String",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeRocketEnginesSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeRocketEnginesSelectionInput>
            >,
    } as const;
}
export const RocketEnginesSelection = makeSLFN(
    makeRocketEnginesSelectionInput,
    "RocketEnginesSelection",
    "RocketEngines",
    0,
);

type ReturnTypeFromRocketFirstStageSelection = {
    burn_time_sec: SelectionWrapper<"burn_time_sec", "Int", 0, {}, undefined>;
    engines: SelectionWrapper<"engines", "Int", 0, {}, undefined>;
    fuel_amount_tons: SelectionWrapper<
        "fuel_amount_tons",
        "Float",
        0,
        {},
        undefined
    >;
    reusable: SelectionWrapper<"reusable", "Boolean", 0, {}, undefined>;
    thrust_sea_level: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeForceSelectionInput>,
            "ForceSelection",
            "Force",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    thrust_vacuum: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeForceSelectionInput>,
            "ForceSelection",
            "Force",
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

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRocketFirstStageSelectionInput>
    >;
};

export function makeRocketFirstStageSelectionInput(
    this: any,
): ReturnTypeFromRocketFirstStageSelection {
    return {
        burn_time_sec: new SelectionWrapper(
            "burn_time_sec",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        engines: new SelectionWrapper("engines", "Int", 0, {}, this, undefined),
        fuel_amount_tons: new SelectionWrapper(
            "fuel_amount_tons",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        reusable: new SelectionWrapper(
            "reusable",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        thrust_sea_level: ForceSelection.bind({
            collector: this,
            fieldName: "thrust_sea_level",
        }),
        thrust_vacuum: ForceSelection.bind({
            collector: this,
            fieldName: "thrust_vacuum",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeRocketFirstStageSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeRocketFirstStageSelectionInput>
            >,
    } as const;
}
export const RocketFirstStageSelection = makeSLFN(
    makeRocketFirstStageSelectionInput,
    "RocketFirstStageSelection",
    "RocketFirstStage",
    0,
);

type ReturnTypeFromRocketLandingLegsSelection = {
    material: SelectionWrapper<"material", "String", 0, {}, undefined>;
    number: SelectionWrapper<"number", "Int", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRocketLandingLegsSelectionInput>
    >;
};

export function makeRocketLandingLegsSelectionInput(
    this: any,
): ReturnTypeFromRocketLandingLegsSelection {
    return {
        material: new SelectionWrapper(
            "material",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        number: new SelectionWrapper("number", "Int", 0, {}, this, undefined),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeRocketLandingLegsSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeRocketLandingLegsSelectionInput>
            >,
    } as const;
}
export const RocketLandingLegsSelection = makeSLFN(
    makeRocketLandingLegsSelectionInput,
    "RocketLandingLegsSelection",
    "RocketLandingLegs",
    0,
);

type ReturnTypeFromRocketPayloadWeightArraySelection = {
    id: SelectionWrapper<"id", "String", 0, {}, undefined>;
    kg: SelectionWrapper<"kg", "Int", 0, {}, undefined>;
    lb: SelectionWrapper<"lb", "Int", 0, {}, undefined>;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRocketPayloadWeightArraySelectionInput>
    >;
};

export function makeRocketPayloadWeightArraySelectionInput(
    this: any,
): ReturnTypeFromRocketPayloadWeightArraySelection {
    return {
        id: new SelectionWrapper("id", "String", 0, {}, this, undefined),
        kg: new SelectionWrapper("kg", "Int", 0, {}, this, undefined),
        lb: new SelectionWrapper("lb", "Int", 0, {}, this, undefined),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeRocketPayloadWeightArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeRocketPayloadWeightArraySelectionInput>
            >,
    } as const;
}
export const RocketPayloadWeightArraySelection = makeSLFN(
    makeRocketPayloadWeightArraySelectionInput,
    "RocketPayloadWeightArraySelection",
    "RocketPayloadWeight",
    1,
);

type ReturnTypeFromRocketSecondStageSelection = {
    burn_time_sec: SelectionWrapper<"burn_time_sec", "Int", 0, {}, undefined>;
    engines: SelectionWrapper<"engines", "Int", 0, {}, undefined>;
    fuel_amount_tons: SelectionWrapper<
        "fuel_amount_tons",
        "Float",
        0,
        {},
        undefined
    >;
    payloads: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketSecondStagePayloadsSelectionInput>,
            "RocketSecondStagePayloadsSelection",
            "RocketSecondStagePayloads",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    thrust: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeForceSelectionInput>,
            "ForceSelection",
            "Force",
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

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRocketSecondStageSelectionInput>
    >;
};

export function makeRocketSecondStageSelectionInput(
    this: any,
): ReturnTypeFromRocketSecondStageSelection {
    return {
        burn_time_sec: new SelectionWrapper(
            "burn_time_sec",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        engines: new SelectionWrapper("engines", "Int", 0, {}, this, undefined),
        fuel_amount_tons: new SelectionWrapper(
            "fuel_amount_tons",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        payloads: RocketSecondStagePayloadsSelection.bind({
            collector: this,
            fieldName: "payloads",
        }),
        thrust: ForceSelection.bind({ collector: this, fieldName: "thrust" }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeRocketSecondStageSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeRocketSecondStageSelectionInput>
            >,
    } as const;
}
export const RocketSecondStageSelection = makeSLFN(
    makeRocketSecondStageSelectionInput,
    "RocketSecondStageSelection",
    "RocketSecondStage",
    0,
);

type ReturnTypeFromRocketSecondStagePayloadsSelection = {
    composite_fairing: ReturnType<
        SLFN<
            {},
            ReturnType<
                typeof makeRocketSecondStagePayloadCompositeFairingSelectionInput
            >,
            "RocketSecondStagePayloadCompositeFairingSelection",
            "RocketSecondStagePayloadCompositeFairing",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    option_1: SelectionWrapper<"option_1", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRocketSecondStagePayloadsSelectionInput>
    >;
};

export function makeRocketSecondStagePayloadsSelectionInput(
    this: any,
): ReturnTypeFromRocketSecondStagePayloadsSelection {
    return {
        composite_fairing:
            RocketSecondStagePayloadCompositeFairingSelection.bind({
                collector: this,
                fieldName: "composite_fairing",
            }),
        option_1: new SelectionWrapper(
            "option_1",
            "String",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeRocketSecondStagePayloadsSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeRocketSecondStagePayloadsSelectionInput>
            >,
    } as const;
}
export const RocketSecondStagePayloadsSelection = makeSLFN(
    makeRocketSecondStagePayloadsSelectionInput,
    "RocketSecondStagePayloadsSelection",
    "RocketSecondStagePayloads",
    0,
);

type ReturnTypeFromRocketSecondStagePayloadCompositeFairingSelection = {
    diameter: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDistanceSelectionInput>,
            "DistanceSelection",
            "Distance",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    height: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDistanceSelectionInput>,
            "DistanceSelection",
            "Distance",
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

export function makeRocketSecondStagePayloadCompositeFairingSelectionInput(
    this: any,
): ReturnTypeFromRocketSecondStagePayloadCompositeFairingSelection {
    return {
        diameter: DistanceSelection.bind({
            collector: this,
            fieldName: "diameter",
        }),
        height: DistanceSelection.bind({
            collector: this,
            fieldName: "height",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,
    } as const;
}
export const RocketSecondStagePayloadCompositeFairingSelection = makeSLFN(
    makeRocketSecondStagePayloadCompositeFairingSelectionInput,
    "RocketSecondStagePayloadCompositeFairingSelection",
    "RocketSecondStagePayloadCompositeFairing",
    0,
);

type ReturnTypeFromLaunchRocketSecondStageSelection = {
    block: SelectionWrapper<"block", "Int", 0, {}, undefined>;
    payloads: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePayloadArraySelectionInput>,
            "PayloadArraySelection",
            "Payload",
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

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchRocketSecondStageSelectionInput>
    >;
};

export function makeLaunchRocketSecondStageSelectionInput(
    this: any,
): ReturnTypeFromLaunchRocketSecondStageSelection {
    return {
        block: new SelectionWrapper("block", "Int", 0, {}, this, undefined),
        payloads: PayloadArraySelection.bind({
            collector: this,
            fieldName: "payloads",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLaunchRocketSecondStageSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchRocketSecondStageSelectionInput>
            >,
    } as const;
}
export const LaunchRocketSecondStageSelection = makeSLFN(
    makeLaunchRocketSecondStageSelectionInput,
    "LaunchRocketSecondStageSelection",
    "LaunchRocketSecondStage",
    0,
);

type ReturnTypeFromPayloadArraySelection = {
    customers: SelectionWrapper<"customers", "String", 1, {}, undefined>;
    id: SelectionWrapper<"id", "ID", 0, {}, undefined>;
    manufacturer: SelectionWrapper<"manufacturer", "String", 0, {}, undefined>;
    nationality: SelectionWrapper<"nationality", "String", 0, {}, undefined>;
    norad_id: SelectionWrapper<"norad_id", "Int", 1, {}, undefined>;
    orbit: SelectionWrapper<"orbit", "String", 0, {}, undefined>;
    orbit_params: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePayloadOrbitParamsSelectionInput>,
            "PayloadOrbitParamsSelection",
            "PayloadOrbitParams",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    payload_mass_kg: SelectionWrapper<
        "payload_mass_kg",
        "Float",
        0,
        {},
        undefined
    >;
    payload_mass_lbs: SelectionWrapper<
        "payload_mass_lbs",
        "Float",
        0,
        {},
        undefined
    >;
    payload_type: SelectionWrapper<"payload_type", "String", 0, {}, undefined>;
    reused: SelectionWrapper<"reused", "Boolean", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePayloadArraySelectionInput>
    >;
};

export function makePayloadArraySelectionInput(
    this: any,
): ReturnTypeFromPayloadArraySelection {
    return {
        customers: new SelectionWrapper(
            "customers",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        manufacturer: new SelectionWrapper(
            "manufacturer",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        nationality: new SelectionWrapper(
            "nationality",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        norad_id: new SelectionWrapper(
            "norad_id",
            "Int",
            1,
            {},
            this,
            undefined,
        ),
        orbit: new SelectionWrapper("orbit", "String", 0, {}, this, undefined),
        orbit_params: PayloadOrbitParamsSelection.bind({
            collector: this,
            fieldName: "orbit_params",
        }),
        payload_mass_kg: new SelectionWrapper(
            "payload_mass_kg",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        payload_mass_lbs: new SelectionWrapper(
            "payload_mass_lbs",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        payload_type: new SelectionWrapper(
            "payload_type",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        reused: new SelectionWrapper(
            "reused",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makePayloadArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePayloadArraySelectionInput>
            >,
    } as const;
}
export const PayloadArraySelection = makeSLFN(
    makePayloadArraySelectionInput,
    "PayloadArraySelection",
    "Payload",
    1,
);

type ReturnTypeFromPayloadOrbitParamsSelection = {
    apoapsis_km: SelectionWrapper<"apoapsis_km", "Float", 0, {}, undefined>;
    arg_of_pericenter: SelectionWrapper<
        "arg_of_pericenter",
        "Float",
        0,
        {},
        undefined
    >;
    eccentricity: SelectionWrapper<"eccentricity", "Float", 0, {}, undefined>;
    epoch: SelectionWrapper<"epoch", "Date", 0, {}, undefined>;
    inclination_deg: SelectionWrapper<
        "inclination_deg",
        "Float",
        0,
        {},
        undefined
    >;
    lifespan_years: SelectionWrapper<
        "lifespan_years",
        "Float",
        0,
        {},
        undefined
    >;
    longitude: SelectionWrapper<"longitude", "Float", 0, {}, undefined>;
    mean_anomaly: SelectionWrapper<"mean_anomaly", "Float", 0, {}, undefined>;
    mean_motion: SelectionWrapper<"mean_motion", "Float", 0, {}, undefined>;
    periapsis_km: SelectionWrapper<"periapsis_km", "Float", 0, {}, undefined>;
    period_min: SelectionWrapper<"period_min", "Float", 0, {}, undefined>;
    raan: SelectionWrapper<"raan", "Float", 0, {}, undefined>;
    reference_system: SelectionWrapper<
        "reference_system",
        "String",
        0,
        {},
        undefined
    >;
    regime: SelectionWrapper<"regime", "String", 0, {}, undefined>;
    semi_major_axis_km: SelectionWrapper<
        "semi_major_axis_km",
        "Float",
        0,
        {},
        undefined
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePayloadOrbitParamsSelectionInput>
    >;
};

export function makePayloadOrbitParamsSelectionInput(
    this: any,
): ReturnTypeFromPayloadOrbitParamsSelection {
    return {
        apoapsis_km: new SelectionWrapper(
            "apoapsis_km",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        arg_of_pericenter: new SelectionWrapper(
            "arg_of_pericenter",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        eccentricity: new SelectionWrapper(
            "eccentricity",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        epoch: new SelectionWrapper("epoch", "Date", 0, {}, this, undefined),
        inclination_deg: new SelectionWrapper(
            "inclination_deg",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        lifespan_years: new SelectionWrapper(
            "lifespan_years",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        longitude: new SelectionWrapper(
            "longitude",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        mean_anomaly: new SelectionWrapper(
            "mean_anomaly",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        mean_motion: new SelectionWrapper(
            "mean_motion",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        periapsis_km: new SelectionWrapper(
            "periapsis_km",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        period_min: new SelectionWrapper(
            "period_min",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        raan: new SelectionWrapper("raan", "Float", 0, {}, this, undefined),
        reference_system: new SelectionWrapper(
            "reference_system",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        regime: new SelectionWrapper(
            "regime",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        semi_major_axis_km: new SelectionWrapper(
            "semi_major_axis_km",
            "Float",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makePayloadOrbitParamsSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePayloadOrbitParamsSelectionInput>
            >,
    } as const;
}
export const PayloadOrbitParamsSelection = makeSLFN(
    makePayloadOrbitParamsSelectionInput,
    "PayloadOrbitParamsSelection",
    "PayloadOrbitParams",
    0,
);

type ReturnTypeFromShipArraySelection = {
    abs: SelectionWrapper<"abs", "Int", 0, {}, undefined>;
    active: SelectionWrapper<"active", "Boolean", 0, {}, undefined>;
    attempted_landings: SelectionWrapper<
        "attempted_landings",
        "Int",
        0,
        {},
        undefined
    >;
    class: SelectionWrapper<"class", "Int", 0, {}, undefined>;
    course_deg: SelectionWrapper<"course_deg", "Int", 0, {}, undefined>;
    home_port: SelectionWrapper<"home_port", "String", 0, {}, undefined>;
    id: SelectionWrapper<"id", "ID", 0, {}, undefined>;
    image: SelectionWrapper<"image", "String", 0, {}, undefined>;
    imo: SelectionWrapper<"imo", "Int", 0, {}, undefined>;
    missions: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeShipMissionArraySelectionInput>,
            "ShipMissionArraySelection",
            "ShipMission",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    mmsi: SelectionWrapper<"mmsi", "Int", 0, {}, undefined>;
    model: SelectionWrapper<"model", "String", 0, {}, undefined>;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
    position: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeShipLocationSelectionInput>,
            "ShipLocationSelection",
            "ShipLocation",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    roles: SelectionWrapper<"roles", "String", 1, {}, undefined>;
    speed_kn: SelectionWrapper<"speed_kn", "Float", 0, {}, undefined>;
    status: SelectionWrapper<"status", "String", 0, {}, undefined>;
    successful_landings: SelectionWrapper<
        "successful_landings",
        "Int",
        0,
        {},
        undefined
    >;
    type: SelectionWrapper<"type", "String", 0, {}, undefined>;
    url: SelectionWrapper<"url", "String", 0, {}, undefined>;
    weight_kg: SelectionWrapper<"weight_kg", "Int", 0, {}, undefined>;
    weight_lbs: SelectionWrapper<"weight_lbs", "Int", 0, {}, undefined>;
    year_built: SelectionWrapper<"year_built", "Int", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeShipArraySelectionInput>
    >;
};

export function makeShipArraySelectionInput(
    this: any,
): ReturnTypeFromShipArraySelection {
    return {
        abs: new SelectionWrapper("abs", "Int", 0, {}, this, undefined),
        active: new SelectionWrapper(
            "active",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        attempted_landings: new SelectionWrapper(
            "attempted_landings",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        class: new SelectionWrapper("class", "Int", 0, {}, this, undefined),
        course_deg: new SelectionWrapper(
            "course_deg",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        home_port: new SelectionWrapper(
            "home_port",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        image: new SelectionWrapper("image", "String", 0, {}, this, undefined),
        imo: new SelectionWrapper("imo", "Int", 0, {}, this, undefined),
        missions: ShipMissionArraySelection.bind({
            collector: this,
            fieldName: "missions",
        }),
        mmsi: new SelectionWrapper("mmsi", "Int", 0, {}, this, undefined),
        model: new SelectionWrapper("model", "String", 0, {}, this, undefined),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        position: ShipLocationSelection.bind({
            collector: this,
            fieldName: "position",
        }),
        roles: new SelectionWrapper("roles", "String", 1, {}, this, undefined),
        speed_kn: new SelectionWrapper(
            "speed_kn",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        status: new SelectionWrapper(
            "status",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        successful_landings: new SelectionWrapper(
            "successful_landings",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        type: new SelectionWrapper("type", "String", 0, {}, this, undefined),
        url: new SelectionWrapper("url", "String", 0, {}, this, undefined),
        weight_kg: new SelectionWrapper(
            "weight_kg",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        weight_lbs: new SelectionWrapper(
            "weight_lbs",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        year_built: new SelectionWrapper(
            "year_built",
            "Int",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeShipArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeShipArraySelectionInput>
            >,
    } as const;
}
export const ShipArraySelection = makeSLFN(
    makeShipArraySelectionInput,
    "ShipArraySelection",
    "Ship",
    1,
);

type ReturnTypeFromShipMissionArraySelection = {
    flight: SelectionWrapper<"flight", "String", 0, {}, undefined>;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeShipMissionArraySelectionInput>
    >;
};

export function makeShipMissionArraySelectionInput(
    this: any,
): ReturnTypeFromShipMissionArraySelection {
    return {
        flight: new SelectionWrapper(
            "flight",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeShipMissionArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeShipMissionArraySelectionInput>
            >,
    } as const;
}
export const ShipMissionArraySelection = makeSLFN(
    makeShipMissionArraySelectionInput,
    "ShipMissionArraySelection",
    "ShipMission",
    1,
);

type ReturnTypeFromShipLocationSelection = {
    latitude: SelectionWrapper<"latitude", "Float", 0, {}, undefined>;
    longitude: SelectionWrapper<"longitude", "Float", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeShipLocationSelectionInput>
    >;
};

export function makeShipLocationSelectionInput(
    this: any,
): ReturnTypeFromShipLocationSelection {
    return {
        latitude: new SelectionWrapper(
            "latitude",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        longitude: new SelectionWrapper(
            "longitude",
            "Float",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeShipLocationSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeShipLocationSelectionInput>
            >,
    } as const;
}
export const ShipLocationSelection = makeSLFN(
    makeShipLocationSelectionInput,
    "ShipLocationSelection",
    "ShipLocation",
    0,
);

type ReturnTypeFromLaunchTelemetrySelection = {
    flight_club: SelectionWrapper<"flight_club", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchTelemetrySelectionInput>
    >;
};

export function makeLaunchTelemetrySelectionInput(
    this: any,
): ReturnTypeFromLaunchTelemetrySelection {
    return {
        flight_club: new SelectionWrapper(
            "flight_club",
            "String",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLaunchTelemetrySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchTelemetrySelectionInput>
            >,
    } as const;
}
export const LaunchTelemetrySelection = makeSLFN(
    makeLaunchTelemetrySelectionInput,
    "LaunchTelemetrySelection",
    "LaunchTelemetry",
    0,
);

type ReturnTypeFromLinkSelection = {
    article: SelectionWrapper<"article", "String", 0, {}, undefined>;
    reddit: SelectionWrapper<"reddit", "String", 0, {}, undefined>;
    wikipedia: SelectionWrapper<"wikipedia", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLinkSelectionInput>
    >;
};

export function makeLinkSelectionInput(this: any): ReturnTypeFromLinkSelection {
    return {
        article: new SelectionWrapper(
            "article",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        reddit: new SelectionWrapper(
            "reddit",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        wikipedia: new SelectionWrapper(
            "wikipedia",
            "String",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLinkSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeLinkSelectionInput>>,
    } as const;
}
export const LinkSelection = makeSLFN(
    makeLinkSelectionInput,
    "LinkSelection",
    "Link",
    0,
);

type ReturnTypeFromHistoryArraySelection = {
    details: SelectionWrapper<"details", "String", 0, {}, undefined>;
    event_date_unix: SelectionWrapper<
        "event_date_unix",
        "Date",
        0,
        {},
        undefined
    >;
    event_date_utc: SelectionWrapper<
        "event_date_utc",
        "Date",
        0,
        {},
        undefined
    >;
    flight: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchSelectionInput>,
            "LaunchSelection",
            "Launch",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    id: SelectionWrapper<"id", "ID", 0, {}, undefined>;
    links: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLinkSelectionInput>,
            "LinkSelection",
            "Link",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    title: SelectionWrapper<"title", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeHistoryArraySelectionInput>
    >;
};

export function makeHistoryArraySelectionInput(
    this: any,
): ReturnTypeFromHistoryArraySelection {
    return {
        details: new SelectionWrapper(
            "details",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        event_date_unix: new SelectionWrapper(
            "event_date_unix",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        event_date_utc: new SelectionWrapper(
            "event_date_utc",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        flight: LaunchSelection.bind({ collector: this, fieldName: "flight" }),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        links: LinkSelection.bind({ collector: this, fieldName: "links" }),
        title: new SelectionWrapper("title", "String", 0, {}, this, undefined),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeHistoryArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeHistoryArraySelectionInput>
            >,
    } as const;
}
export const HistoryArraySelection = makeSLFN(
    makeHistoryArraySelectionInput,
    "HistoryArraySelection",
    "History",
    1,
);

type ReturnTypeFromResultSelection = {
    totalCount: SelectionWrapper<"totalCount", "Int", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeResultSelectionInput>
    >;
};

export function makeResultSelectionInput(
    this: any,
): ReturnTypeFromResultSelection {
    return {
        totalCount: new SelectionWrapper(
            "totalCount",
            "Int",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeResultSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeResultSelectionInput>>,
    } as const;
}
export const ResultSelection = makeSLFN(
    makeResultSelectionInput,
    "ResultSelection",
    "Result",
    0,
);

type ReturnTypeFromHistoriesResultSelection = {
    data: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeHistoryArraySelectionInput>,
            "HistoryArraySelection",
            "History",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    result: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeResultSelectionInput>,
            "ResultSelection",
            "Result",
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

export function makeHistoriesResultSelectionInput(
    this: any,
): ReturnTypeFromHistoriesResultSelection {
    return {
        data: HistoryArraySelection.bind({
            collector: this,
            fieldName: "data",
        }),
        result: ResultSelection.bind({ collector: this, fieldName: "result" }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,
    } as const;
}
export const HistoriesResultSelection = makeSLFN(
    makeHistoriesResultSelectionInput,
    "HistoriesResultSelection",
    "HistoriesResult",
    0,
);

type ReturnTypeFromHistorySelection = {
    details: SelectionWrapper<"details", "String", 0, {}, undefined>;
    event_date_unix: SelectionWrapper<
        "event_date_unix",
        "Date",
        0,
        {},
        undefined
    >;
    event_date_utc: SelectionWrapper<
        "event_date_utc",
        "Date",
        0,
        {},
        undefined
    >;
    flight: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchSelectionInput>,
            "LaunchSelection",
            "Launch",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    id: SelectionWrapper<"id", "ID", 0, {}, undefined>;
    links: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLinkSelectionInput>,
            "LinkSelection",
            "Link",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    title: SelectionWrapper<"title", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeHistorySelectionInput>
    >;
};

export function makeHistorySelectionInput(
    this: any,
): ReturnTypeFromHistorySelection {
    return {
        details: new SelectionWrapper(
            "details",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        event_date_unix: new SelectionWrapper(
            "event_date_unix",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        event_date_utc: new SelectionWrapper(
            "event_date_utc",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        flight: LaunchSelection.bind({ collector: this, fieldName: "flight" }),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        links: LinkSelection.bind({ collector: this, fieldName: "links" }),
        title: new SelectionWrapper("title", "String", 0, {}, this, undefined),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeHistorySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeHistorySelectionInput>
            >,
    } as const;
}
export const HistorySelection = makeSLFN(
    makeHistorySelectionInput,
    "HistorySelection",
    "History",
    0,
);

type ReturnTypeFromLocationSelection = {
    latitude: SelectionWrapper<"latitude", "Float", 0, {}, undefined>;
    longitude: SelectionWrapper<"longitude", "Float", 0, {}, undefined>;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
    region: SelectionWrapper<"region", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLocationSelectionInput>
    >;
};

export function makeLocationSelectionInput(
    this: any,
): ReturnTypeFromLocationSelection {
    return {
        latitude: new SelectionWrapper(
            "latitude",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        longitude: new SelectionWrapper(
            "longitude",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        region: new SelectionWrapper(
            "region",
            "String",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLocationSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLocationSelectionInput>
            >,
    } as const;
}
export const LocationSelection = makeSLFN(
    makeLocationSelectionInput,
    "LocationSelection",
    "Location",
    0,
);

type ReturnTypeFromLandpadSelection = {
    attempted_landings: SelectionWrapper<
        "attempted_landings",
        "String",
        0,
        {},
        undefined
    >;
    details: SelectionWrapper<"details", "String", 0, {}, undefined>;
    full_name: SelectionWrapper<"full_name", "String", 0, {}, undefined>;
    id: SelectionWrapper<"id", "ID", 0, {}, undefined>;
    landing_type: SelectionWrapper<"landing_type", "String", 0, {}, undefined>;
    location: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLocationSelectionInput>,
            "LocationSelection",
            "Location",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    status: SelectionWrapper<"status", "String", 0, {}, undefined>;
    successful_landings: SelectionWrapper<
        "successful_landings",
        "String",
        0,
        {},
        undefined
    >;
    wikipedia: SelectionWrapper<"wikipedia", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLandpadSelectionInput>
    >;
};

export function makeLandpadSelectionInput(
    this: any,
): ReturnTypeFromLandpadSelection {
    return {
        attempted_landings: new SelectionWrapper(
            "attempted_landings",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        details: new SelectionWrapper(
            "details",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        full_name: new SelectionWrapper(
            "full_name",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        landing_type: new SelectionWrapper(
            "landing_type",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        location: LocationSelection.bind({
            collector: this,
            fieldName: "location",
        }),
        status: new SelectionWrapper(
            "status",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        successful_landings: new SelectionWrapper(
            "successful_landings",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        wikipedia: new SelectionWrapper(
            "wikipedia",
            "String",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLandpadSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLandpadSelectionInput>
            >,
    } as const;
}
export const LandpadSelection = makeSLFN(
    makeLandpadSelectionInput,
    "LandpadSelection",
    "Landpad",
    0,
);

type ReturnTypeFromLandpadArraySelection = {
    attempted_landings: SelectionWrapper<
        "attempted_landings",
        "String",
        0,
        {},
        undefined
    >;
    details: SelectionWrapper<"details", "String", 0, {}, undefined>;
    full_name: SelectionWrapper<"full_name", "String", 0, {}, undefined>;
    id: SelectionWrapper<"id", "ID", 0, {}, undefined>;
    landing_type: SelectionWrapper<"landing_type", "String", 0, {}, undefined>;
    location: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLocationSelectionInput>,
            "LocationSelection",
            "Location",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    status: SelectionWrapper<"status", "String", 0, {}, undefined>;
    successful_landings: SelectionWrapper<
        "successful_landings",
        "String",
        0,
        {},
        undefined
    >;
    wikipedia: SelectionWrapper<"wikipedia", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLandpadArraySelectionInput>
    >;
};

export function makeLandpadArraySelectionInput(
    this: any,
): ReturnTypeFromLandpadArraySelection {
    return {
        attempted_landings: new SelectionWrapper(
            "attempted_landings",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        details: new SelectionWrapper(
            "details",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        full_name: new SelectionWrapper(
            "full_name",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        landing_type: new SelectionWrapper(
            "landing_type",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        location: LocationSelection.bind({
            collector: this,
            fieldName: "location",
        }),
        status: new SelectionWrapper(
            "status",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        successful_landings: new SelectionWrapper(
            "successful_landings",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        wikipedia: new SelectionWrapper(
            "wikipedia",
            "String",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLandpadArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLandpadArraySelectionInput>
            >,
    } as const;
}
export const LandpadArraySelection = makeSLFN(
    makeLandpadArraySelectionInput,
    "LandpadArraySelection",
    "Landpad",
    1,
);

type ReturnTypeFromLaunchArraySelection = {
    details: SelectionWrapper<"details", "String", 0, {}, undefined>;
    id: SelectionWrapper<"id", "ID", 0, {}, undefined>;
    is_tentative: SelectionWrapper<"is_tentative", "Boolean", 0, {}, undefined>;
    launch_date_local: SelectionWrapper<
        "launch_date_local",
        "Date",
        0,
        {},
        undefined
    >;
    launch_date_unix: SelectionWrapper<
        "launch_date_unix",
        "Date",
        0,
        {},
        undefined
    >;
    launch_date_utc: SelectionWrapper<
        "launch_date_utc",
        "Date",
        0,
        {},
        undefined
    >;
    launch_site: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchSiteSelectionInput>,
            "LaunchSiteSelection",
            "LaunchSite",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    launch_success: SelectionWrapper<
        "launch_success",
        "Boolean",
        0,
        {},
        undefined
    >;
    launch_year: SelectionWrapper<"launch_year", "String", 0, {}, undefined>;
    links: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchLinksSelectionInput>,
            "LaunchLinksSelection",
            "LaunchLinks",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    mission_id: SelectionWrapper<"mission_id", "String", 1, {}, undefined>;
    mission_name: SelectionWrapper<"mission_name", "String", 0, {}, undefined>;
    rocket: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchRocketSelectionInput>,
            "LaunchRocketSelection",
            "LaunchRocket",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    ships: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeShipArraySelectionInput>,
            "ShipArraySelection",
            "Ship",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    static_fire_date_unix: SelectionWrapper<
        "static_fire_date_unix",
        "Date",
        0,
        {},
        undefined
    >;
    static_fire_date_utc: SelectionWrapper<
        "static_fire_date_utc",
        "Date",
        0,
        {},
        undefined
    >;
    telemetry: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchTelemetrySelectionInput>,
            "LaunchTelemetrySelection",
            "LaunchTelemetry",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    tentative_max_precision: SelectionWrapper<
        "tentative_max_precision",
        "String",
        0,
        {},
        undefined
    >;
    upcoming: SelectionWrapper<"upcoming", "Boolean", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchArraySelectionInput>
    >;
};

export function makeLaunchArraySelectionInput(
    this: any,
): ReturnTypeFromLaunchArraySelection {
    return {
        details: new SelectionWrapper(
            "details",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        is_tentative: new SelectionWrapper(
            "is_tentative",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        launch_date_local: new SelectionWrapper(
            "launch_date_local",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        launch_date_unix: new SelectionWrapper(
            "launch_date_unix",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        launch_date_utc: new SelectionWrapper(
            "launch_date_utc",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        launch_site: LaunchSiteSelection.bind({
            collector: this,
            fieldName: "launch_site",
        }),
        launch_success: new SelectionWrapper(
            "launch_success",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        launch_year: new SelectionWrapper(
            "launch_year",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        links: LaunchLinksSelection.bind({
            collector: this,
            fieldName: "links",
        }),
        mission_id: new SelectionWrapper(
            "mission_id",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        mission_name: new SelectionWrapper(
            "mission_name",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        rocket: LaunchRocketSelection.bind({
            collector: this,
            fieldName: "rocket",
        }),
        ships: ShipArraySelection.bind({ collector: this, fieldName: "ships" }),
        static_fire_date_unix: new SelectionWrapper(
            "static_fire_date_unix",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        static_fire_date_utc: new SelectionWrapper(
            "static_fire_date_utc",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        telemetry: LaunchTelemetrySelection.bind({
            collector: this,
            fieldName: "telemetry",
        }),
        tentative_max_precision: new SelectionWrapper(
            "tentative_max_precision",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        upcoming: new SelectionWrapper(
            "upcoming",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLaunchArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchArraySelectionInput>
            >,
    } as const;
}
export const LaunchArraySelection = makeSLFN(
    makeLaunchArraySelectionInput,
    "LaunchArraySelection",
    "Launch",
    1,
);

type ReturnTypeFromLaunchesPastResultSelection = {
    data: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchArraySelectionInput>,
            "LaunchArraySelection",
            "Launch",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    result: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeResultSelectionInput>,
            "ResultSelection",
            "Result",
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

export function makeLaunchesPastResultSelectionInput(
    this: any,
): ReturnTypeFromLaunchesPastResultSelection {
    return {
        data: LaunchArraySelection.bind({ collector: this, fieldName: "data" }),
        result: ResultSelection.bind({ collector: this, fieldName: "result" }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,
    } as const;
}
export const LaunchesPastResultSelection = makeSLFN(
    makeLaunchesPastResultSelectionInput,
    "LaunchesPastResultSelection",
    "LaunchesPastResult",
    0,
);

type ReturnTypeFromRocketArraySelection = {
    active: SelectionWrapper<"active", "Boolean", 0, {}, undefined>;
    boosters: SelectionWrapper<"boosters", "Int", 0, {}, undefined>;
    company: SelectionWrapper<"company", "String", 0, {}, undefined>;
    cost_per_launch: SelectionWrapper<
        "cost_per_launch",
        "Int",
        0,
        {},
        undefined
    >;
    country: SelectionWrapper<"country", "String", 0, {}, undefined>;
    description: SelectionWrapper<"description", "String", 0, {}, undefined>;
    diameter: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDistanceSelectionInput>,
            "DistanceSelection",
            "Distance",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    engines: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketEnginesSelectionInput>,
            "RocketEnginesSelection",
            "RocketEngines",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    first_flight: SelectionWrapper<"first_flight", "Date", 0, {}, undefined>;
    first_stage: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketFirstStageSelectionInput>,
            "RocketFirstStageSelection",
            "RocketFirstStage",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    height: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDistanceSelectionInput>,
            "DistanceSelection",
            "Distance",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    id: SelectionWrapper<"id", "ID", 0, {}, undefined>;
    landing_legs: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketLandingLegsSelectionInput>,
            "RocketLandingLegsSelection",
            "RocketLandingLegs",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    mass: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeMassSelectionInput>,
            "MassSelection",
            "Mass",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
    payload_weights: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketPayloadWeightArraySelectionInput>,
            "RocketPayloadWeightArraySelection",
            "RocketPayloadWeight",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    second_stage: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketSecondStageSelectionInput>,
            "RocketSecondStageSelection",
            "RocketSecondStage",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    stages: SelectionWrapper<"stages", "Int", 0, {}, undefined>;
    success_rate_pct: SelectionWrapper<
        "success_rate_pct",
        "Int",
        0,
        {},
        undefined
    >;
    type: SelectionWrapper<"type", "String", 0, {}, undefined>;
    wikipedia: SelectionWrapper<"wikipedia", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRocketArraySelectionInput>
    >;
};

export function makeRocketArraySelectionInput(
    this: any,
): ReturnTypeFromRocketArraySelection {
    return {
        active: new SelectionWrapper(
            "active",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        boosters: new SelectionWrapper(
            "boosters",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        company: new SelectionWrapper(
            "company",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        cost_per_launch: new SelectionWrapper(
            "cost_per_launch",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        country: new SelectionWrapper(
            "country",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        description: new SelectionWrapper(
            "description",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        diameter: DistanceSelection.bind({
            collector: this,
            fieldName: "diameter",
        }),
        engines: RocketEnginesSelection.bind({
            collector: this,
            fieldName: "engines",
        }),
        first_flight: new SelectionWrapper(
            "first_flight",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        first_stage: RocketFirstStageSelection.bind({
            collector: this,
            fieldName: "first_stage",
        }),
        height: DistanceSelection.bind({
            collector: this,
            fieldName: "height",
        }),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        landing_legs: RocketLandingLegsSelection.bind({
            collector: this,
            fieldName: "landing_legs",
        }),
        mass: MassSelection.bind({ collector: this, fieldName: "mass" }),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        payload_weights: RocketPayloadWeightArraySelection.bind({
            collector: this,
            fieldName: "payload_weights",
        }),
        second_stage: RocketSecondStageSelection.bind({
            collector: this,
            fieldName: "second_stage",
        }),
        stages: new SelectionWrapper("stages", "Int", 0, {}, this, undefined),
        success_rate_pct: new SelectionWrapper(
            "success_rate_pct",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        type: new SelectionWrapper("type", "String", 0, {}, this, undefined),
        wikipedia: new SelectionWrapper(
            "wikipedia",
            "String",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeRocketArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeRocketArraySelectionInput>
            >,
    } as const;
}
export const RocketArraySelection = makeSLFN(
    makeRocketArraySelectionInput,
    "RocketArraySelection",
    "Rocket",
    1,
);

type ReturnTypeFromLaunchpadSelection = {
    attempted_launches: SelectionWrapper<
        "attempted_launches",
        "Int",
        0,
        {},
        undefined
    >;
    details: SelectionWrapper<"details", "String", 0, {}, undefined>;
    id: SelectionWrapper<"id", "ID", 0, {}, undefined>;
    location: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLocationSelectionInput>,
            "LocationSelection",
            "Location",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
    status: SelectionWrapper<"status", "String", 0, {}, undefined>;
    successful_launches: SelectionWrapper<
        "successful_launches",
        "Int",
        0,
        {},
        undefined
    >;
    vehicles_launched: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketArraySelectionInput>,
            "RocketArraySelection",
            "Rocket",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    wikipedia: SelectionWrapper<"wikipedia", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchpadSelectionInput>
    >;
};

export function makeLaunchpadSelectionInput(
    this: any,
): ReturnTypeFromLaunchpadSelection {
    return {
        attempted_launches: new SelectionWrapper(
            "attempted_launches",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        details: new SelectionWrapper(
            "details",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        location: LocationSelection.bind({
            collector: this,
            fieldName: "location",
        }),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        status: new SelectionWrapper(
            "status",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        successful_launches: new SelectionWrapper(
            "successful_launches",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        vehicles_launched: RocketArraySelection.bind({
            collector: this,
            fieldName: "vehicles_launched",
        }),
        wikipedia: new SelectionWrapper(
            "wikipedia",
            "String",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLaunchpadSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchpadSelectionInput>
            >,
    } as const;
}
export const LaunchpadSelection = makeSLFN(
    makeLaunchpadSelectionInput,
    "LaunchpadSelection",
    "Launchpad",
    0,
);

type ReturnTypeFromLaunchpadArraySelection = {
    attempted_launches: SelectionWrapper<
        "attempted_launches",
        "Int",
        0,
        {},
        undefined
    >;
    details: SelectionWrapper<"details", "String", 0, {}, undefined>;
    id: SelectionWrapper<"id", "ID", 0, {}, undefined>;
    location: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLocationSelectionInput>,
            "LocationSelection",
            "Location",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
    status: SelectionWrapper<"status", "String", 0, {}, undefined>;
    successful_launches: SelectionWrapper<
        "successful_launches",
        "Int",
        0,
        {},
        undefined
    >;
    vehicles_launched: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketArraySelectionInput>,
            "RocketArraySelection",
            "Rocket",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    wikipedia: SelectionWrapper<"wikipedia", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchpadArraySelectionInput>
    >;
};

export function makeLaunchpadArraySelectionInput(
    this: any,
): ReturnTypeFromLaunchpadArraySelection {
    return {
        attempted_launches: new SelectionWrapper(
            "attempted_launches",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        details: new SelectionWrapper(
            "details",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        location: LocationSelection.bind({
            collector: this,
            fieldName: "location",
        }),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        status: new SelectionWrapper(
            "status",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        successful_launches: new SelectionWrapper(
            "successful_launches",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        vehicles_launched: RocketArraySelection.bind({
            collector: this,
            fieldName: "vehicles_launched",
        }),
        wikipedia: new SelectionWrapper(
            "wikipedia",
            "String",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLaunchpadArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchpadArraySelectionInput>
            >,
    } as const;
}
export const LaunchpadArraySelection = makeSLFN(
    makeLaunchpadArraySelectionInput,
    "LaunchpadArraySelection",
    "Launchpad",
    1,
);

type ReturnTypeFromMissionSelection = {
    description: SelectionWrapper<"description", "String", 0, {}, undefined>;
    id: SelectionWrapper<"id", "ID", 0, {}, undefined>;
    manufacturers: SelectionWrapper<
        "manufacturers",
        "String",
        1,
        {},
        undefined
    >;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
    payloads: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePayloadArraySelectionInput>,
            "PayloadArraySelection",
            "Payload",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    twitter: SelectionWrapper<"twitter", "String", 0, {}, undefined>;
    website: SelectionWrapper<"website", "String", 0, {}, undefined>;
    wikipedia: SelectionWrapper<"wikipedia", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeMissionSelectionInput>
    >;
};

export function makeMissionSelectionInput(
    this: any,
): ReturnTypeFromMissionSelection {
    return {
        description: new SelectionWrapper(
            "description",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        manufacturers: new SelectionWrapper(
            "manufacturers",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        payloads: PayloadArraySelection.bind({
            collector: this,
            fieldName: "payloads",
        }),
        twitter: new SelectionWrapper(
            "twitter",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        website: new SelectionWrapper(
            "website",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        wikipedia: new SelectionWrapper(
            "wikipedia",
            "String",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeMissionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeMissionSelectionInput>
            >,
    } as const;
}
export const MissionSelection = makeSLFN(
    makeMissionSelectionInput,
    "MissionSelection",
    "Mission",
    0,
);

type ReturnTypeFromMissionArraySelection = {
    description: SelectionWrapper<"description", "String", 0, {}, undefined>;
    id: SelectionWrapper<"id", "ID", 0, {}, undefined>;
    manufacturers: SelectionWrapper<
        "manufacturers",
        "String",
        1,
        {},
        undefined
    >;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
    payloads: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePayloadArraySelectionInput>,
            "PayloadArraySelection",
            "Payload",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    twitter: SelectionWrapper<"twitter", "String", 0, {}, undefined>;
    website: SelectionWrapper<"website", "String", 0, {}, undefined>;
    wikipedia: SelectionWrapper<"wikipedia", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeMissionArraySelectionInput>
    >;
};

export function makeMissionArraySelectionInput(
    this: any,
): ReturnTypeFromMissionArraySelection {
    return {
        description: new SelectionWrapper(
            "description",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        manufacturers: new SelectionWrapper(
            "manufacturers",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        payloads: PayloadArraySelection.bind({
            collector: this,
            fieldName: "payloads",
        }),
        twitter: new SelectionWrapper(
            "twitter",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        website: new SelectionWrapper(
            "website",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        wikipedia: new SelectionWrapper(
            "wikipedia",
            "String",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeMissionArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeMissionArraySelectionInput>
            >,
    } as const;
}
export const MissionArraySelection = makeSLFN(
    makeMissionArraySelectionInput,
    "MissionArraySelection",
    "Mission",
    1,
);

type ReturnTypeFromMissionResultSelection = {
    data: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeMissionArraySelectionInput>,
            "MissionArraySelection",
            "Mission",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    result: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeResultSelectionInput>,
            "ResultSelection",
            "Result",
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

export function makeMissionResultSelectionInput(
    this: any,
): ReturnTypeFromMissionResultSelection {
    return {
        data: MissionArraySelection.bind({
            collector: this,
            fieldName: "data",
        }),
        result: ResultSelection.bind({ collector: this, fieldName: "result" }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,
    } as const;
}
export const MissionResultSelection = makeSLFN(
    makeMissionResultSelectionInput,
    "MissionResultSelection",
    "MissionResult",
    0,
);

type ReturnTypeFromPayloadSelection = {
    customers: SelectionWrapper<"customers", "String", 1, {}, undefined>;
    id: SelectionWrapper<"id", "ID", 0, {}, undefined>;
    manufacturer: SelectionWrapper<"manufacturer", "String", 0, {}, undefined>;
    nationality: SelectionWrapper<"nationality", "String", 0, {}, undefined>;
    norad_id: SelectionWrapper<"norad_id", "Int", 1, {}, undefined>;
    orbit: SelectionWrapper<"orbit", "String", 0, {}, undefined>;
    orbit_params: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePayloadOrbitParamsSelectionInput>,
            "PayloadOrbitParamsSelection",
            "PayloadOrbitParams",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    payload_mass_kg: SelectionWrapper<
        "payload_mass_kg",
        "Float",
        0,
        {},
        undefined
    >;
    payload_mass_lbs: SelectionWrapper<
        "payload_mass_lbs",
        "Float",
        0,
        {},
        undefined
    >;
    payload_type: SelectionWrapper<"payload_type", "String", 0, {}, undefined>;
    reused: SelectionWrapper<"reused", "Boolean", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePayloadSelectionInput>
    >;
};

export function makePayloadSelectionInput(
    this: any,
): ReturnTypeFromPayloadSelection {
    return {
        customers: new SelectionWrapper(
            "customers",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        manufacturer: new SelectionWrapper(
            "manufacturer",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        nationality: new SelectionWrapper(
            "nationality",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        norad_id: new SelectionWrapper(
            "norad_id",
            "Int",
            1,
            {},
            this,
            undefined,
        ),
        orbit: new SelectionWrapper("orbit", "String", 0, {}, this, undefined),
        orbit_params: PayloadOrbitParamsSelection.bind({
            collector: this,
            fieldName: "orbit_params",
        }),
        payload_mass_kg: new SelectionWrapper(
            "payload_mass_kg",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        payload_mass_lbs: new SelectionWrapper(
            "payload_mass_lbs",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        payload_type: new SelectionWrapper(
            "payload_type",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        reused: new SelectionWrapper(
            "reused",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makePayloadSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePayloadSelectionInput>
            >,
    } as const;
}
export const PayloadSelection = makeSLFN(
    makePayloadSelectionInput,
    "PayloadSelection",
    "Payload",
    0,
);

type ReturnTypeFromRoadsterSelection = {
    apoapsis_au: SelectionWrapper<"apoapsis_au", "Float", 0, {}, undefined>;
    details: SelectionWrapper<"details", "String", 0, {}, undefined>;
    earth_distance_km: SelectionWrapper<
        "earth_distance_km",
        "Float",
        0,
        {},
        undefined
    >;
    earth_distance_mi: SelectionWrapper<
        "earth_distance_mi",
        "Float",
        0,
        {},
        undefined
    >;
    eccentricity: SelectionWrapper<"eccentricity", "Float", 0, {}, undefined>;
    epoch_jd: SelectionWrapper<"epoch_jd", "Float", 0, {}, undefined>;
    inclination: SelectionWrapper<"inclination", "Float", 0, {}, undefined>;
    launch_date_unix: SelectionWrapper<
        "launch_date_unix",
        "Date",
        0,
        {},
        undefined
    >;
    launch_date_utc: SelectionWrapper<
        "launch_date_utc",
        "Date",
        0,
        {},
        undefined
    >;
    launch_mass_kg: SelectionWrapper<"launch_mass_kg", "Int", 0, {}, undefined>;
    launch_mass_lbs: SelectionWrapper<
        "launch_mass_lbs",
        "Int",
        0,
        {},
        undefined
    >;
    longitude: SelectionWrapper<"longitude", "Float", 0, {}, undefined>;
    mars_distance_km: SelectionWrapper<
        "mars_distance_km",
        "Float",
        0,
        {},
        undefined
    >;
    mars_distance_mi: SelectionWrapper<
        "mars_distance_mi",
        "Float",
        0,
        {},
        undefined
    >;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
    norad_id: SelectionWrapper<"norad_id", "Int", 0, {}, undefined>;
    orbit_type: SelectionWrapper<"orbit_type", "Float", 0, {}, undefined>;
    periapsis_arg: SelectionWrapper<"periapsis_arg", "Float", 0, {}, undefined>;
    periapsis_au: SelectionWrapper<"periapsis_au", "Float", 0, {}, undefined>;
    period_days: SelectionWrapper<"period_days", "Float", 0, {}, undefined>;
    semi_major_axis_au: SelectionWrapper<
        "semi_major_axis_au",
        "Float",
        0,
        {},
        undefined
    >;
    speed_kph: SelectionWrapper<"speed_kph", "Float", 0, {}, undefined>;
    speed_mph: SelectionWrapper<"speed_mph", "Float", 0, {}, undefined>;
    wikipedia: SelectionWrapper<"wikipedia", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRoadsterSelectionInput>
    >;
};

export function makeRoadsterSelectionInput(
    this: any,
): ReturnTypeFromRoadsterSelection {
    return {
        apoapsis_au: new SelectionWrapper(
            "apoapsis_au",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        details: new SelectionWrapper(
            "details",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        earth_distance_km: new SelectionWrapper(
            "earth_distance_km",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        earth_distance_mi: new SelectionWrapper(
            "earth_distance_mi",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        eccentricity: new SelectionWrapper(
            "eccentricity",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        epoch_jd: new SelectionWrapper(
            "epoch_jd",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        inclination: new SelectionWrapper(
            "inclination",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        launch_date_unix: new SelectionWrapper(
            "launch_date_unix",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        launch_date_utc: new SelectionWrapper(
            "launch_date_utc",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        launch_mass_kg: new SelectionWrapper(
            "launch_mass_kg",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        launch_mass_lbs: new SelectionWrapper(
            "launch_mass_lbs",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        longitude: new SelectionWrapper(
            "longitude",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        mars_distance_km: new SelectionWrapper(
            "mars_distance_km",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        mars_distance_mi: new SelectionWrapper(
            "mars_distance_mi",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        norad_id: new SelectionWrapper(
            "norad_id",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        orbit_type: new SelectionWrapper(
            "orbit_type",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        periapsis_arg: new SelectionWrapper(
            "periapsis_arg",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        periapsis_au: new SelectionWrapper(
            "periapsis_au",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        period_days: new SelectionWrapper(
            "period_days",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        semi_major_axis_au: new SelectionWrapper(
            "semi_major_axis_au",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        speed_kph: new SelectionWrapper(
            "speed_kph",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        speed_mph: new SelectionWrapper(
            "speed_mph",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        wikipedia: new SelectionWrapper(
            "wikipedia",
            "String",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeRoadsterSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeRoadsterSelectionInput>
            >,
    } as const;
}
export const RoadsterSelection = makeSLFN(
    makeRoadsterSelectionInput,
    "RoadsterSelection",
    "Roadster",
    0,
);

type ReturnTypeFromRocketsResultSelection = {
    data: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketArraySelectionInput>,
            "RocketArraySelection",
            "Rocket",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    result: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeResultSelectionInput>,
            "ResultSelection",
            "Result",
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

export function makeRocketsResultSelectionInput(
    this: any,
): ReturnTypeFromRocketsResultSelection {
    return {
        data: RocketArraySelection.bind({ collector: this, fieldName: "data" }),
        result: ResultSelection.bind({ collector: this, fieldName: "result" }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,
    } as const;
}
export const RocketsResultSelection = makeSLFN(
    makeRocketsResultSelectionInput,
    "RocketsResultSelection",
    "RocketsResult",
    0,
);

type ReturnTypeFromShipSelection = {
    abs: SelectionWrapper<"abs", "Int", 0, {}, undefined>;
    active: SelectionWrapper<"active", "Boolean", 0, {}, undefined>;
    attempted_landings: SelectionWrapper<
        "attempted_landings",
        "Int",
        0,
        {},
        undefined
    >;
    class: SelectionWrapper<"class", "Int", 0, {}, undefined>;
    course_deg: SelectionWrapper<"course_deg", "Int", 0, {}, undefined>;
    home_port: SelectionWrapper<"home_port", "String", 0, {}, undefined>;
    id: SelectionWrapper<"id", "ID", 0, {}, undefined>;
    image: SelectionWrapper<"image", "String", 0, {}, undefined>;
    imo: SelectionWrapper<"imo", "Int", 0, {}, undefined>;
    missions: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeShipMissionArraySelectionInput>,
            "ShipMissionArraySelection",
            "ShipMission",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    mmsi: SelectionWrapper<"mmsi", "Int", 0, {}, undefined>;
    model: SelectionWrapper<"model", "String", 0, {}, undefined>;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
    position: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeShipLocationSelectionInput>,
            "ShipLocationSelection",
            "ShipLocation",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    roles: SelectionWrapper<"roles", "String", 1, {}, undefined>;
    speed_kn: SelectionWrapper<"speed_kn", "Float", 0, {}, undefined>;
    status: SelectionWrapper<"status", "String", 0, {}, undefined>;
    successful_landings: SelectionWrapper<
        "successful_landings",
        "Int",
        0,
        {},
        undefined
    >;
    type: SelectionWrapper<"type", "String", 0, {}, undefined>;
    url: SelectionWrapper<"url", "String", 0, {}, undefined>;
    weight_kg: SelectionWrapper<"weight_kg", "Int", 0, {}, undefined>;
    weight_lbs: SelectionWrapper<"weight_lbs", "Int", 0, {}, undefined>;
    year_built: SelectionWrapper<"year_built", "Int", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeShipSelectionInput>
    >;
};

export function makeShipSelectionInput(this: any): ReturnTypeFromShipSelection {
    return {
        abs: new SelectionWrapper("abs", "Int", 0, {}, this, undefined),
        active: new SelectionWrapper(
            "active",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        attempted_landings: new SelectionWrapper(
            "attempted_landings",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        class: new SelectionWrapper("class", "Int", 0, {}, this, undefined),
        course_deg: new SelectionWrapper(
            "course_deg",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        home_port: new SelectionWrapper(
            "home_port",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        image: new SelectionWrapper("image", "String", 0, {}, this, undefined),
        imo: new SelectionWrapper("imo", "Int", 0, {}, this, undefined),
        missions: ShipMissionArraySelection.bind({
            collector: this,
            fieldName: "missions",
        }),
        mmsi: new SelectionWrapper("mmsi", "Int", 0, {}, this, undefined),
        model: new SelectionWrapper("model", "String", 0, {}, this, undefined),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        position: ShipLocationSelection.bind({
            collector: this,
            fieldName: "position",
        }),
        roles: new SelectionWrapper("roles", "String", 1, {}, this, undefined),
        speed_kn: new SelectionWrapper(
            "speed_kn",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        status: new SelectionWrapper(
            "status",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        successful_landings: new SelectionWrapper(
            "successful_landings",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        type: new SelectionWrapper("type", "String", 0, {}, this, undefined),
        url: new SelectionWrapper("url", "String", 0, {}, this, undefined),
        weight_kg: new SelectionWrapper(
            "weight_kg",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        weight_lbs: new SelectionWrapper(
            "weight_lbs",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        year_built: new SelectionWrapper(
            "year_built",
            "Int",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeShipSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeShipSelectionInput>>,
    } as const;
}
export const ShipSelection = makeSLFN(
    makeShipSelectionInput,
    "ShipSelection",
    "Ship",
    0,
);

type ReturnTypeFromShipsResultSelection = {
    data: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeShipArraySelectionInput>,
            "ShipArraySelection",
            "Ship",
            1,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    result: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeResultSelectionInput>,
            "ResultSelection",
            "Result",
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

export function makeShipsResultSelectionInput(
    this: any,
): ReturnTypeFromShipsResultSelection {
    return {
        data: ShipArraySelection.bind({ collector: this, fieldName: "data" }),
        result: ResultSelection.bind({ collector: this, fieldName: "result" }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,
    } as const;
}
export const ShipsResultSelection = makeSLFN(
    makeShipsResultSelectionInput,
    "ShipsResultSelection",
    "ShipsResult",
    0,
);

type ReturnTypeFromusersNotNullArrayNotNullSelection = {
    id: SelectionWrapper<"id", "uuid", 0, {}, undefined>;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
    rocket: SelectionWrapper<"rocket", "String", 0, {}, undefined>;
    timestamp: SelectionWrapper<"timestamp", "timestamptz", 0, {}, undefined>;
    twitter: SelectionWrapper<"twitter", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeusersNotNullArrayNotNullSelectionInput>
    >;
};

export function makeusersNotNullArrayNotNullSelectionInput(
    this: any,
): ReturnTypeFromusersNotNullArrayNotNullSelection {
    return {
        id: new SelectionWrapper("id", "uuid", 0, {}, this, undefined),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        rocket: new SelectionWrapper(
            "rocket",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        timestamp: new SelectionWrapper(
            "timestamp",
            "timestamptz",
            0,
            {},
            this,
            undefined,
        ),
        twitter: new SelectionWrapper(
            "twitter",
            "String",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeusersNotNullArrayNotNullSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeusersNotNullArrayNotNullSelectionInput>
            >,
    } as const;
}
export const usersNotNullArrayNotNullSelection = makeSLFN(
    makeusersNotNullArrayNotNullSelectionInput,
    "usersNotNullArrayNotNullSelection",
    "users",
    1,
);

type ReturnTypeFromusers_aggregate_fieldsSelection = {
    count: (
        args: users_aggregate_fieldsCountArgs,
    ) => SelectionWrapper<
        "count",
        "Int",
        0,
        {},
        users_aggregate_fieldsCountArgs
    >;
    max: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusers_max_fieldsSelectionInput>,
            "users_max_fieldsSelection",
            "users_max_fields",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    min: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusers_min_fieldsSelectionInput>,
            "users_min_fieldsSelection",
            "users_min_fields",
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

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeusers_aggregate_fieldsSelectionInput>
    >;
};

export function makeusers_aggregate_fieldsSelectionInput(
    this: any,
): ReturnTypeFromusers_aggregate_fieldsSelection {
    return {
        count: (args: users_aggregate_fieldsCountArgs) =>
            new SelectionWrapper(
                "count",
                "Int",
                0,
                {},
                this,
                undefined,
                args,
                users_aggregate_fieldsCountArgsMeta,
            ),
        max: users_max_fieldsSelection.bind({
            collector: this,
            fieldName: "max",
        }),
        min: users_min_fieldsSelection.bind({
            collector: this,
            fieldName: "min",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeusers_aggregate_fieldsSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeusers_aggregate_fieldsSelectionInput>
            >,
    } as const;
}
export const users_aggregate_fieldsSelection = makeSLFN(
    makeusers_aggregate_fieldsSelectionInput,
    "users_aggregate_fieldsSelection",
    "users_aggregate_fields",
    0,
);

type ReturnTypeFromusers_max_fieldsSelection = {
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
    rocket: SelectionWrapper<"rocket", "String", 0, {}, undefined>;
    timestamp: SelectionWrapper<"timestamp", "timestamptz", 0, {}, undefined>;
    twitter: SelectionWrapper<"twitter", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeusers_max_fieldsSelectionInput>
    >;
};

export function makeusers_max_fieldsSelectionInput(
    this: any,
): ReturnTypeFromusers_max_fieldsSelection {
    return {
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        rocket: new SelectionWrapper(
            "rocket",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        timestamp: new SelectionWrapper(
            "timestamp",
            "timestamptz",
            0,
            {},
            this,
            undefined,
        ),
        twitter: new SelectionWrapper(
            "twitter",
            "String",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeusers_max_fieldsSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeusers_max_fieldsSelectionInput>
            >,
    } as const;
}
export const users_max_fieldsSelection = makeSLFN(
    makeusers_max_fieldsSelectionInput,
    "users_max_fieldsSelection",
    "users_max_fields",
    0,
);

type ReturnTypeFromusers_min_fieldsSelection = {
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
    rocket: SelectionWrapper<"rocket", "String", 0, {}, undefined>;
    timestamp: SelectionWrapper<"timestamp", "timestamptz", 0, {}, undefined>;
    twitter: SelectionWrapper<"twitter", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeusers_min_fieldsSelectionInput>
    >;
};

export function makeusers_min_fieldsSelectionInput(
    this: any,
): ReturnTypeFromusers_min_fieldsSelection {
    return {
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        rocket: new SelectionWrapper(
            "rocket",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        timestamp: new SelectionWrapper(
            "timestamp",
            "timestamptz",
            0,
            {},
            this,
            undefined,
        ),
        twitter: new SelectionWrapper(
            "twitter",
            "String",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeusers_min_fieldsSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeusers_min_fieldsSelectionInput>
            >,
    } as const;
}
export const users_min_fieldsSelection = makeSLFN(
    makeusers_min_fieldsSelectionInput,
    "users_min_fieldsSelection",
    "users_min_fields",
    0,
);

type ReturnTypeFromusers_aggregateNotNullSelection = {
    aggregate: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusers_aggregate_fieldsSelectionInput>,
            "users_aggregate_fieldsSelection",
            "users_aggregate_fields",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    nodes: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusersNotNullArrayNotNullSelectionInput>,
            "usersNotNullArrayNotNullSelection",
            "users",
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

export function makeusers_aggregateNotNullSelectionInput(
    this: any,
): ReturnTypeFromusers_aggregateNotNullSelection {
    return {
        aggregate: users_aggregate_fieldsSelection.bind({
            collector: this,
            fieldName: "aggregate",
        }),
        nodes: usersNotNullArrayNotNullSelection.bind({
            collector: this,
            fieldName: "nodes",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,
    } as const;
}
export const users_aggregateNotNullSelection = makeSLFN(
    makeusers_aggregateNotNullSelectionInput,
    "users_aggregateNotNullSelection",
    "users_aggregate",
    0,
);

type ReturnTypeFromusersSelection = {
    id: SelectionWrapper<"id", "uuid", 0, {}, undefined>;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
    rocket: SelectionWrapper<"rocket", "String", 0, {}, undefined>;
    timestamp: SelectionWrapper<"timestamp", "timestamptz", 0, {}, undefined>;
    twitter: SelectionWrapper<"twitter", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeusersSelectionInput>
    >;
};

export function makeusersSelectionInput(
    this: any,
): ReturnTypeFromusersSelection {
    return {
        id: new SelectionWrapper("id", "uuid", 0, {}, this, undefined),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        rocket: new SelectionWrapper(
            "rocket",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        timestamp: new SelectionWrapper(
            "timestamp",
            "timestamptz",
            0,
            {},
            this,
            undefined,
        ),
        twitter: new SelectionWrapper(
            "twitter",
            "String",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeusersSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeusersSelectionInput>>,
    } as const;
}
export const usersSelection = makeSLFN(
    makeusersSelectionInput,
    "usersSelection",
    "users",
    0,
);

type ReturnTypeFrom_ServiceNotNullSelection = {
    sdl: SelectionWrapper<"sdl", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof make_ServiceNotNullSelectionInput>
    >;
};

export function make_ServiceNotNullSelectionInput(
    this: any,
): ReturnTypeFrom_ServiceNotNullSelection {
    return {
        sdl: new SelectionWrapper("sdl", "String", 0, {}, this, undefined),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                make_ServiceNotNullSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof make_ServiceNotNullSelectionInput>
            >,
    } as const;
}
export const _ServiceNotNullSelection = makeSLFN(
    make_ServiceNotNullSelectionInput,
    "_ServiceNotNullSelection",
    "_Service",
    0,
);

type ReturnTypeFromusers_mutation_responseSelection = {
    affected_rows: SelectionWrapper<"affected_rows", "Int", 0, {}, undefined>;
    returning: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusersNotNullArrayNotNullSelectionInput>,
            "usersNotNullArrayNotNullSelection",
            "users",
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

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeusers_mutation_responseSelectionInput>
    >;
};

export function makeusers_mutation_responseSelectionInput(
    this: any,
): ReturnTypeFromusers_mutation_responseSelection {
    return {
        affected_rows: new SelectionWrapper(
            "affected_rows",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        returning: usersNotNullArrayNotNullSelection.bind({
            collector: this,
            fieldName: "returning",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeusers_mutation_responseSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeusers_mutation_responseSelectionInput>
            >,
    } as const;
}
export const users_mutation_responseSelection = makeSLFN(
    makeusers_mutation_responseSelectionInput,
    "users_mutation_responseSelection",
    "users_mutation_response",
    0,
);

type ReturnTypeFromCapsuleMissionSelection = {
    flight: SelectionWrapper<"flight", "Int", 0, {}, undefined>;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeCapsuleMissionSelectionInput>
    >;
};

export function makeCapsuleMissionSelectionInput(
    this: any,
): ReturnTypeFromCapsuleMissionSelection {
    return {
        flight: new SelectionWrapper("flight", "Int", 0, {}, this, undefined),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeCapsuleMissionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeCapsuleMissionSelectionInput>
            >,
    } as const;
}
export const CapsuleMissionSelection = makeSLFN(
    makeCapsuleMissionSelectionInput,
    "CapsuleMissionSelection",
    "CapsuleMission",
    0,
);

type ReturnTypeFromCoreMissionSelection = {
    flight: SelectionWrapper<"flight", "Int", 0, {}, undefined>;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeCoreMissionSelectionInput>
    >;
};

export function makeCoreMissionSelectionInput(
    this: any,
): ReturnTypeFromCoreMissionSelection {
    return {
        flight: new SelectionWrapper("flight", "Int", 0, {}, this, undefined),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeCoreMissionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeCoreMissionSelectionInput>
            >,
    } as const;
}
export const CoreMissionSelection = makeSLFN(
    makeCoreMissionSelectionInput,
    "CoreMissionSelection",
    "CoreMission",
    0,
);

type ReturnTypeFromDragonThrustSelection = {
    amount: SelectionWrapper<"amount", "Int", 0, {}, undefined>;
    fuel_1: SelectionWrapper<"fuel_1", "String", 0, {}, undefined>;
    fuel_2: SelectionWrapper<"fuel_2", "String", 0, {}, undefined>;
    pods: SelectionWrapper<"pods", "Int", 0, {}, undefined>;
    thrust: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeForceSelectionInput>,
            "ForceSelection",
            "Force",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    type: SelectionWrapper<"type", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeDragonThrustSelectionInput>
    >;
};

export function makeDragonThrustSelectionInput(
    this: any,
): ReturnTypeFromDragonThrustSelection {
    return {
        amount: new SelectionWrapper("amount", "Int", 0, {}, this, undefined),
        fuel_1: new SelectionWrapper(
            "fuel_1",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        fuel_2: new SelectionWrapper(
            "fuel_2",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        pods: new SelectionWrapper("pods", "Int", 0, {}, this, undefined),
        thrust: ForceSelection.bind({ collector: this, fieldName: "thrust" }),
        type: new SelectionWrapper("type", "String", 0, {}, this, undefined),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeDragonThrustSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeDragonThrustSelectionInput>
            >,
    } as const;
}
export const DragonThrustSelection = makeSLFN(
    makeDragonThrustSelectionInput,
    "DragonThrustSelection",
    "DragonThrust",
    0,
);

type ReturnTypeFromLaunchRocketFirstStageCoreSelection = {
    block: SelectionWrapper<"block", "Int", 0, {}, undefined>;
    core: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCoreSelectionInput>,
            "CoreSelection",
            "Core",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    flight: SelectionWrapper<"flight", "Int", 0, {}, undefined>;
    gridfins: SelectionWrapper<"gridfins", "Boolean", 0, {}, undefined>;
    land_success: SelectionWrapper<"land_success", "Boolean", 0, {}, undefined>;
    landing_intent: SelectionWrapper<
        "landing_intent",
        "Boolean",
        0,
        {},
        undefined
    >;
    landing_type: SelectionWrapper<"landing_type", "String", 0, {}, undefined>;
    landing_vehicle: SelectionWrapper<
        "landing_vehicle",
        "String",
        0,
        {},
        undefined
    >;
    legs: SelectionWrapper<"legs", "Boolean", 0, {}, undefined>;
    reused: SelectionWrapper<"reused", "Boolean", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchRocketFirstStageCoreSelectionInput>
    >;
};

export function makeLaunchRocketFirstStageCoreSelectionInput(
    this: any,
): ReturnTypeFromLaunchRocketFirstStageCoreSelection {
    return {
        block: new SelectionWrapper("block", "Int", 0, {}, this, undefined),
        core: CoreSelection.bind({ collector: this, fieldName: "core" }),
        flight: new SelectionWrapper("flight", "Int", 0, {}, this, undefined),
        gridfins: new SelectionWrapper(
            "gridfins",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        land_success: new SelectionWrapper(
            "land_success",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        landing_intent: new SelectionWrapper(
            "landing_intent",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        landing_type: new SelectionWrapper(
            "landing_type",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        landing_vehicle: new SelectionWrapper(
            "landing_vehicle",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        legs: new SelectionWrapper("legs", "Boolean", 0, {}, this, undefined),
        reused: new SelectionWrapper(
            "reused",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLaunchRocketFirstStageCoreSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchRocketFirstStageCoreSelectionInput>
            >,
    } as const;
}
export const LaunchRocketFirstStageCoreSelection = makeSLFN(
    makeLaunchRocketFirstStageCoreSelectionInput,
    "LaunchRocketFirstStageCoreSelection",
    "LaunchRocketFirstStageCore",
    0,
);

type ReturnTypeFromMutationSelection = {
    delete_users: (args: MutationDelete_usersArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusers_mutation_responseSelectionInput>,
            "users_mutation_responseSelection",
            "users_mutation_response",
            0,
            {
                $lazy: (args: MutationDelete_usersArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    insert_users: (args: MutationInsert_usersArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusers_mutation_responseSelectionInput>,
            "users_mutation_responseSelection",
            "users_mutation_response",
            0,
            {
                $lazy: (args: MutationInsert_usersArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    update_users: (args: MutationUpdate_usersArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusers_mutation_responseSelectionInput>,
            "users_mutation_responseSelection",
            "users_mutation_response",
            0,
            {
                $lazy: (args: MutationUpdate_usersArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeMutationSelectionInput(
    this: any,
): ReturnTypeFromMutationSelection {
    return {
        delete_users: (args: MutationDelete_usersArgs) =>
            users_mutation_responseSelection.bind({
                collector: this,
                fieldName: "delete_users",
                args,
                argsMeta: MutationDelete_usersArgsMeta,
            }),
        insert_users: (args: MutationInsert_usersArgs) =>
            users_mutation_responseSelection.bind({
                collector: this,
                fieldName: "insert_users",
                args,
                argsMeta: MutationInsert_usersArgsMeta,
            }),
        update_users: (args: MutationUpdate_usersArgs) =>
            users_mutation_responseSelection.bind({
                collector: this,
                fieldName: "update_users",
                args,
                argsMeta: MutationUpdate_usersArgsMeta,
            }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,
    } as const;
}
export const MutationSelection = makeSLFN(
    makeMutationSelectionInput,
    "MutationSelection",
    "Mutation",
    0,
);

type ReturnTypeFromQuerySelection = {
    capsule: (args: QueryCapsuleArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCapsuleSelectionInput>,
            "CapsuleSelection",
            "Capsule",
            0,
            {
                $lazy: (args: QueryCapsuleArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    capsules: (args: QueryCapsulesArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCapsuleArraySelectionInput>,
            "CapsuleArraySelection",
            "Capsule",
            1,
            {
                $lazy: (args: QueryCapsulesArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    capsulesPast: (args: QueryCapsulesPastArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCapsuleArraySelectionInput>,
            "CapsuleArraySelection",
            "Capsule",
            1,
            {
                $lazy: (args: QueryCapsulesPastArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    capsulesUpcoming: (args: QueryCapsulesUpcomingArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCapsuleArraySelectionInput>,
            "CapsuleArraySelection",
            "Capsule",
            1,
            {
                $lazy: (args: QueryCapsulesUpcomingArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    company: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeInfoSelectionInput>,
            "InfoSelection",
            "Info",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    core: (args: QueryCoreArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCoreSelectionInput>,
            "CoreSelection",
            "Core",
            0,
            {
                $lazy: (args: QueryCoreArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    cores: (args: QueryCoresArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCoreArraySelectionInput>,
            "CoreArraySelection",
            "Core",
            1,
            {
                $lazy: (args: QueryCoresArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    coresPast: (args: QueryCoresPastArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCoreArraySelectionInput>,
            "CoreArraySelection",
            "Core",
            1,
            {
                $lazy: (args: QueryCoresPastArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    coresUpcoming: (args: QueryCoresUpcomingArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCoreArraySelectionInput>,
            "CoreArraySelection",
            "Core",
            1,
            {
                $lazy: (args: QueryCoresUpcomingArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    dragon: (args: QueryDragonArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDragonSelectionInput>,
            "DragonSelection",
            "Dragon",
            0,
            {
                $lazy: (args: QueryDragonArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    dragons: (args: QueryDragonsArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDragonArraySelectionInput>,
            "DragonArraySelection",
            "Dragon",
            1,
            {
                $lazy: (args: QueryDragonsArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    histories: (args: QueryHistoriesArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeHistoryArraySelectionInput>,
            "HistoryArraySelection",
            "History",
            1,
            {
                $lazy: (args: QueryHistoriesArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    historiesResult: (args: QueryHistoriesResultArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeHistoriesResultSelectionInput>,
            "HistoriesResultSelection",
            "HistoriesResult",
            0,
            {
                $lazy: (args: QueryHistoriesResultArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    history: (args: QueryHistoryArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeHistorySelectionInput>,
            "HistorySelection",
            "History",
            0,
            {
                $lazy: (args: QueryHistoryArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    landpad: (args: QueryLandpadArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLandpadSelectionInput>,
            "LandpadSelection",
            "Landpad",
            0,
            {
                $lazy: (args: QueryLandpadArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    landpads: (args: QueryLandpadsArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLandpadArraySelectionInput>,
            "LandpadArraySelection",
            "Landpad",
            1,
            {
                $lazy: (args: QueryLandpadsArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    launch: (args: QueryLaunchArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchSelectionInput>,
            "LaunchSelection",
            "Launch",
            0,
            {
                $lazy: (args: QueryLaunchArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    launchLatest: (args: QueryLaunchLatestArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchSelectionInput>,
            "LaunchSelection",
            "Launch",
            0,
            {
                $lazy: (args: QueryLaunchLatestArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    launchNext: (args: QueryLaunchNextArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchSelectionInput>,
            "LaunchSelection",
            "Launch",
            0,
            {
                $lazy: (args: QueryLaunchNextArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    launches: (args: QueryLaunchesArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchArraySelectionInput>,
            "LaunchArraySelection",
            "Launch",
            1,
            {
                $lazy: (args: QueryLaunchesArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    launchesPast: (args: QueryLaunchesPastArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchArraySelectionInput>,
            "LaunchArraySelection",
            "Launch",
            1,
            {
                $lazy: (args: QueryLaunchesPastArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    launchesPastResult: (args: QueryLaunchesPastResultArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchesPastResultSelectionInput>,
            "LaunchesPastResultSelection",
            "LaunchesPastResult",
            0,
            {
                $lazy: (args: QueryLaunchesPastResultArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    launchesUpcoming: (args: QueryLaunchesUpcomingArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchArraySelectionInput>,
            "LaunchArraySelection",
            "Launch",
            1,
            {
                $lazy: (args: QueryLaunchesUpcomingArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    launchpad: (args: QueryLaunchpadArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchpadSelectionInput>,
            "LaunchpadSelection",
            "Launchpad",
            0,
            {
                $lazy: (args: QueryLaunchpadArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    launchpads: (args: QueryLaunchpadsArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchpadArraySelectionInput>,
            "LaunchpadArraySelection",
            "Launchpad",
            1,
            {
                $lazy: (args: QueryLaunchpadsArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    mission: (args: QueryMissionArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeMissionSelectionInput>,
            "MissionSelection",
            "Mission",
            0,
            {
                $lazy: (args: QueryMissionArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    missions: (args: QueryMissionsArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeMissionArraySelectionInput>,
            "MissionArraySelection",
            "Mission",
            1,
            {
                $lazy: (args: QueryMissionsArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    missionsResult: (args: QueryMissionsResultArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeMissionResultSelectionInput>,
            "MissionResultSelection",
            "MissionResult",
            0,
            {
                $lazy: (args: QueryMissionsResultArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    payload: (args: QueryPayloadArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePayloadSelectionInput>,
            "PayloadSelection",
            "Payload",
            0,
            {
                $lazy: (args: QueryPayloadArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    payloads: (args: QueryPayloadsArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePayloadArraySelectionInput>,
            "PayloadArraySelection",
            "Payload",
            1,
            {
                $lazy: (args: QueryPayloadsArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    roadster: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRoadsterSelectionInput>,
            "RoadsterSelection",
            "Roadster",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    rocket: (args: QueryRocketArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketSelectionInput>,
            "RocketSelection",
            "Rocket",
            0,
            {
                $lazy: (args: QueryRocketArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    rockets: (args: QueryRocketsArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketArraySelectionInput>,
            "RocketArraySelection",
            "Rocket",
            1,
            {
                $lazy: (args: QueryRocketsArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    rocketsResult: (args: QueryRocketsResultArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketsResultSelectionInput>,
            "RocketsResultSelection",
            "RocketsResult",
            0,
            {
                $lazy: (args: QueryRocketsResultArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    ship: (args: QueryShipArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeShipSelectionInput>,
            "ShipSelection",
            "Ship",
            0,
            {
                $lazy: (args: QueryShipArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    ships: (args: QueryShipsArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeShipArraySelectionInput>,
            "ShipArraySelection",
            "Ship",
            1,
            {
                $lazy: (args: QueryShipsArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    shipsResult: (args: QueryShipsResultArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeShipsResultSelectionInput>,
            "ShipsResultSelection",
            "ShipsResult",
            0,
            {
                $lazy: (args: QueryShipsResultArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    users: (args: QueryUsersArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusersNotNullArrayNotNullSelectionInput>,
            "usersNotNullArrayNotNullSelection",
            "users",
            1,
            {
                $lazy: (args: QueryUsersArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    users_aggregate: (args: QueryUsers_aggregateArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusers_aggregateNotNullSelectionInput>,
            "users_aggregateNotNullSelection",
            "users_aggregate",
            0,
            {
                $lazy: (args: QueryUsers_aggregateArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    users_by_pk: (args: QueryUsers_by_pkArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusersSelectionInput>,
            "usersSelection",
            "users",
            0,
            {
                $lazy: (args: QueryUsers_by_pkArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    _service: ReturnType<
        SLFN<
            {},
            ReturnType<typeof make_ServiceNotNullSelectionInput>,
            "_ServiceNotNullSelection",
            "_Service",
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

export function makeQuerySelectionInput(
    this: any,
): ReturnTypeFromQuerySelection {
    return {
        capsule: (args: QueryCapsuleArgs) =>
            CapsuleSelection.bind({
                collector: this,
                fieldName: "capsule",
                args,
                argsMeta: QueryCapsuleArgsMeta,
            }),
        capsules: (args: QueryCapsulesArgs) =>
            CapsuleArraySelection.bind({
                collector: this,
                fieldName: "capsules",
                args,
                argsMeta: QueryCapsulesArgsMeta,
            }),
        capsulesPast: (args: QueryCapsulesPastArgs) =>
            CapsuleArraySelection.bind({
                collector: this,
                fieldName: "capsulesPast",
                args,
                argsMeta: QueryCapsulesPastArgsMeta,
            }),
        capsulesUpcoming: (args: QueryCapsulesUpcomingArgs) =>
            CapsuleArraySelection.bind({
                collector: this,
                fieldName: "capsulesUpcoming",
                args,
                argsMeta: QueryCapsulesUpcomingArgsMeta,
            }),
        company: InfoSelection.bind({ collector: this, fieldName: "company" }),
        core: (args: QueryCoreArgs) =>
            CoreSelection.bind({
                collector: this,
                fieldName: "core",
                args,
                argsMeta: QueryCoreArgsMeta,
            }),
        cores: (args: QueryCoresArgs) =>
            CoreArraySelection.bind({
                collector: this,
                fieldName: "cores",
                args,
                argsMeta: QueryCoresArgsMeta,
            }),
        coresPast: (args: QueryCoresPastArgs) =>
            CoreArraySelection.bind({
                collector: this,
                fieldName: "coresPast",
                args,
                argsMeta: QueryCoresPastArgsMeta,
            }),
        coresUpcoming: (args: QueryCoresUpcomingArgs) =>
            CoreArraySelection.bind({
                collector: this,
                fieldName: "coresUpcoming",
                args,
                argsMeta: QueryCoresUpcomingArgsMeta,
            }),
        dragon: (args: QueryDragonArgs) =>
            DragonSelection.bind({
                collector: this,
                fieldName: "dragon",
                args,
                argsMeta: QueryDragonArgsMeta,
            }),
        dragons: (args: QueryDragonsArgs) =>
            DragonArraySelection.bind({
                collector: this,
                fieldName: "dragons",
                args,
                argsMeta: QueryDragonsArgsMeta,
            }),
        histories: (args: QueryHistoriesArgs) =>
            HistoryArraySelection.bind({
                collector: this,
                fieldName: "histories",
                args,
                argsMeta: QueryHistoriesArgsMeta,
            }),
        historiesResult: (args: QueryHistoriesResultArgs) =>
            HistoriesResultSelection.bind({
                collector: this,
                fieldName: "historiesResult",
                args,
                argsMeta: QueryHistoriesResultArgsMeta,
            }),
        history: (args: QueryHistoryArgs) =>
            HistorySelection.bind({
                collector: this,
                fieldName: "history",
                args,
                argsMeta: QueryHistoryArgsMeta,
            }),
        landpad: (args: QueryLandpadArgs) =>
            LandpadSelection.bind({
                collector: this,
                fieldName: "landpad",
                args,
                argsMeta: QueryLandpadArgsMeta,
            }),
        landpads: (args: QueryLandpadsArgs) =>
            LandpadArraySelection.bind({
                collector: this,
                fieldName: "landpads",
                args,
                argsMeta: QueryLandpadsArgsMeta,
            }),
        launch: (args: QueryLaunchArgs) =>
            LaunchSelection.bind({
                collector: this,
                fieldName: "launch",
                args,
                argsMeta: QueryLaunchArgsMeta,
            }),
        launchLatest: (args: QueryLaunchLatestArgs) =>
            LaunchSelection.bind({
                collector: this,
                fieldName: "launchLatest",
                args,
                argsMeta: QueryLaunchLatestArgsMeta,
            }),
        launchNext: (args: QueryLaunchNextArgs) =>
            LaunchSelection.bind({
                collector: this,
                fieldName: "launchNext",
                args,
                argsMeta: QueryLaunchNextArgsMeta,
            }),
        launches: (args: QueryLaunchesArgs) =>
            LaunchArraySelection.bind({
                collector: this,
                fieldName: "launches",
                args,
                argsMeta: QueryLaunchesArgsMeta,
            }),
        launchesPast: (args: QueryLaunchesPastArgs) =>
            LaunchArraySelection.bind({
                collector: this,
                fieldName: "launchesPast",
                args,
                argsMeta: QueryLaunchesPastArgsMeta,
            }),
        launchesPastResult: (args: QueryLaunchesPastResultArgs) =>
            LaunchesPastResultSelection.bind({
                collector: this,
                fieldName: "launchesPastResult",
                args,
                argsMeta: QueryLaunchesPastResultArgsMeta,
            }),
        launchesUpcoming: (args: QueryLaunchesUpcomingArgs) =>
            LaunchArraySelection.bind({
                collector: this,
                fieldName: "launchesUpcoming",
                args,
                argsMeta: QueryLaunchesUpcomingArgsMeta,
            }),
        launchpad: (args: QueryLaunchpadArgs) =>
            LaunchpadSelection.bind({
                collector: this,
                fieldName: "launchpad",
                args,
                argsMeta: QueryLaunchpadArgsMeta,
            }),
        launchpads: (args: QueryLaunchpadsArgs) =>
            LaunchpadArraySelection.bind({
                collector: this,
                fieldName: "launchpads",
                args,
                argsMeta: QueryLaunchpadsArgsMeta,
            }),
        mission: (args: QueryMissionArgs) =>
            MissionSelection.bind({
                collector: this,
                fieldName: "mission",
                args,
                argsMeta: QueryMissionArgsMeta,
            }),
        missions: (args: QueryMissionsArgs) =>
            MissionArraySelection.bind({
                collector: this,
                fieldName: "missions",
                args,
                argsMeta: QueryMissionsArgsMeta,
            }),
        missionsResult: (args: QueryMissionsResultArgs) =>
            MissionResultSelection.bind({
                collector: this,
                fieldName: "missionsResult",
                args,
                argsMeta: QueryMissionsResultArgsMeta,
            }),
        payload: (args: QueryPayloadArgs) =>
            PayloadSelection.bind({
                collector: this,
                fieldName: "payload",
                args,
                argsMeta: QueryPayloadArgsMeta,
            }),
        payloads: (args: QueryPayloadsArgs) =>
            PayloadArraySelection.bind({
                collector: this,
                fieldName: "payloads",
                args,
                argsMeta: QueryPayloadsArgsMeta,
            }),
        roadster: RoadsterSelection.bind({
            collector: this,
            fieldName: "roadster",
        }),
        rocket: (args: QueryRocketArgs) =>
            RocketSelection.bind({
                collector: this,
                fieldName: "rocket",
                args,
                argsMeta: QueryRocketArgsMeta,
            }),
        rockets: (args: QueryRocketsArgs) =>
            RocketArraySelection.bind({
                collector: this,
                fieldName: "rockets",
                args,
                argsMeta: QueryRocketsArgsMeta,
            }),
        rocketsResult: (args: QueryRocketsResultArgs) =>
            RocketsResultSelection.bind({
                collector: this,
                fieldName: "rocketsResult",
                args,
                argsMeta: QueryRocketsResultArgsMeta,
            }),
        ship: (args: QueryShipArgs) =>
            ShipSelection.bind({
                collector: this,
                fieldName: "ship",
                args,
                argsMeta: QueryShipArgsMeta,
            }),
        ships: (args: QueryShipsArgs) =>
            ShipArraySelection.bind({
                collector: this,
                fieldName: "ships",
                args,
                argsMeta: QueryShipsArgsMeta,
            }),
        shipsResult: (args: QueryShipsResultArgs) =>
            ShipsResultSelection.bind({
                collector: this,
                fieldName: "shipsResult",
                args,
                argsMeta: QueryShipsResultArgsMeta,
            }),
        users: (args: QueryUsersArgs) =>
            usersNotNullArrayNotNullSelection.bind({
                collector: this,
                fieldName: "users",
                args,
                argsMeta: QueryUsersArgsMeta,
            }),
        users_aggregate: (args: QueryUsers_aggregateArgs) =>
            users_aggregateNotNullSelection.bind({
                collector: this,
                fieldName: "users_aggregate",
                args,
                argsMeta: QueryUsers_aggregateArgsMeta,
            }),
        users_by_pk: (args: QueryUsers_by_pkArgs) =>
            usersSelection.bind({
                collector: this,
                fieldName: "users_by_pk",
                args,
                argsMeta: QueryUsers_by_pkArgsMeta,
            }),
        _service: _ServiceNotNullSelection.bind({
            collector: this,
            fieldName: "_service",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,
    } as const;
}
export const QuerySelection = makeSLFN(
    makeQuerySelectionInput,
    "QuerySelection",
    "Query",
    0,
);

type ReturnTypeFromRocketPayloadWeightSelection = {
    id: SelectionWrapper<"id", "String", 0, {}, undefined>;
    kg: SelectionWrapper<"kg", "Int", 0, {}, undefined>;
    lb: SelectionWrapper<"lb", "Int", 0, {}, undefined>;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRocketPayloadWeightSelectionInput>
    >;
};

export function makeRocketPayloadWeightSelectionInput(
    this: any,
): ReturnTypeFromRocketPayloadWeightSelection {
    return {
        id: new SelectionWrapper("id", "String", 0, {}, this, undefined),
        kg: new SelectionWrapper("kg", "Int", 0, {}, this, undefined),
        lb: new SelectionWrapper("lb", "Int", 0, {}, this, undefined),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeRocketPayloadWeightSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeRocketPayloadWeightSelectionInput>
            >,
    } as const;
}
export const RocketPayloadWeightSelection = makeSLFN(
    makeRocketPayloadWeightSelectionInput,
    "RocketPayloadWeightSelection",
    "RocketPayloadWeight",
    0,
);

type ReturnTypeFromShipMissionSelection = {
    flight: SelectionWrapper<"flight", "String", 0, {}, undefined>;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeShipMissionSelectionInput>
    >;
};

export function makeShipMissionSelectionInput(
    this: any,
): ReturnTypeFromShipMissionSelection {
    return {
        flight: new SelectionWrapper(
            "flight",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeShipMissionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeShipMissionSelectionInput>
            >,
    } as const;
}
export const ShipMissionSelection = makeSLFN(
    makeShipMissionSelectionInput,
    "ShipMissionSelection",
    "ShipMission",
    0,
);

type ReturnTypeFromSubscriptionSelection = {
    users: (args: SubscriptionUsersArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusersNotNullArrayNotNullSelectionInput>,
            "usersNotNullArrayNotNullSelection",
            "users",
            1,
            {
                $lazy: (args: SubscriptionUsersArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    users_aggregate: (args: SubscriptionUsers_aggregateArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusers_aggregateNotNullSelectionInput>,
            "users_aggregateNotNullSelection",
            "users_aggregate",
            0,
            {
                $lazy: (args: SubscriptionUsers_aggregateArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    users_by_pk: (args: SubscriptionUsers_by_pkArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusersSelectionInput>,
            "usersSelection",
            "users",
            0,
            {
                $lazy: (args: SubscriptionUsers_by_pkArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeSubscriptionSelectionInput(
    this: any,
): ReturnTypeFromSubscriptionSelection {
    return {
        users: (args: SubscriptionUsersArgs) =>
            usersNotNullArrayNotNullSelection.bind({
                collector: this,
                fieldName: "users",
                args,
                argsMeta: SubscriptionUsersArgsMeta,
            }),
        users_aggregate: (args: SubscriptionUsers_aggregateArgs) =>
            users_aggregateNotNullSelection.bind({
                collector: this,
                fieldName: "users_aggregate",
                args,
                argsMeta: SubscriptionUsers_aggregateArgsMeta,
            }),
        users_by_pk: (args: SubscriptionUsers_by_pkArgs) =>
            usersSelection.bind({
                collector: this,
                fieldName: "users_by_pk",
                args,
                argsMeta: SubscriptionUsers_by_pkArgsMeta,
            }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,
    } as const;
}
export const SubscriptionSelection = makeSLFN(
    makeSubscriptionSelectionInput,
    "SubscriptionSelection",
    "Subscription",
    0,
);

type ReturnTypeFromusers_aggregateSelection = {
    aggregate: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusers_aggregate_fieldsSelectionInput>,
            "users_aggregate_fieldsSelection",
            "users_aggregate_fields",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    nodes: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusersNotNullArrayNotNullSelectionInput>,
            "usersNotNullArrayNotNullSelection",
            "users",
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

export function makeusers_aggregateSelectionInput(
    this: any,
): ReturnTypeFromusers_aggregateSelection {
    return {
        aggregate: users_aggregate_fieldsSelection.bind({
            collector: this,
            fieldName: "aggregate",
        }),
        nodes: usersNotNullArrayNotNullSelection.bind({
            collector: this,
            fieldName: "nodes",
        }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,
    } as const;
}
export const users_aggregateSelection = makeSLFN(
    makeusers_aggregateSelectionInput,
    "users_aggregateSelection",
    "users_aggregate",
    0,
);

type ReturnTypeFrom_ServiceSelection = {
    sdl: SelectionWrapper<"sdl", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof make_ServiceSelectionInput>
    >;
};

export function make_ServiceSelectionInput(
    this: any,
): ReturnTypeFrom_ServiceSelection {
    return {
        sdl: new SelectionWrapper("sdl", "String", 0, {}, this, undefined),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                make_ServiceSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof make_ServiceSelectionInput>
            >,
    } as const;
}
export const _ServiceSelection = makeSLFN(
    make_ServiceSelectionInput,
    "_ServiceSelection",
    "_Service",
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
        mutation: MutationSelection.bind({
            collector: this,
            isRootType: "Mutation",
        }),
        subscription: SubscriptionSelection.bind({
            collector: this,
            isRootType: "Subscription",
        }),

        $directives,
    } as const;
}

function __client__<
    T extends object,
    F extends ReturnType<typeof _makeRootOperationInput>,
>(this: any, s: (selection: F) => T) {
    const root = new OperationSelectionCollector(
        undefined,
        undefined,
        new RootOperation(),
    );
    const rootRef = { ref: root };
    const selection: F = _makeRootOperationInput.bind(rootRef)() as any;

    const r = s(selection);
    const _result = new SelectionWrapper(
        undefined,
        undefined,
        undefined,
        r,
        root,
        undefined,
    ) as unknown as T;
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
            root.execute(headers)
                .then(() => {
                    resolve(result);
                })
                .catch(reject);
        },
    };

    return finalPromise as Promise<TR>;
}

const __init__ = (options: {
    headers?: { [key: string]: string };
    scalars?: {
        [key in keyof ScalarTypeMapDefault]?: (
            v: string,
        ) => ScalarTypeMapDefault[key];
    } & {
        [key in keyof ScalarTypeMapWithCustom]?: (
            v: string,
        ) => ScalarTypeMapWithCustom[key];
    };
}) => {
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

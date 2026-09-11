import z from "zod";

import {
	AGE_MAX,
	AGE_MIN,
	filterAgeEnabledSchema,
	filterAgeSchema,
	filterPositionEnabledSchema,
	filterPositionSchema,
} from "$lib/model/browse/grid/filters";

export {
	filterPositionSchema,
	ageRangeLabel,
} from "$lib/model/browse/grid/filters";

export const filterHostingEnabledSchema = z.boolean();
export const filterHostingSchema = z.boolean();

export const RightNowSort = z.enum(["DISTANCE", "NEWEST"]);
export const filterRightNowSortSchema = RightNowSort;

export const rightNowFiltersSchema = z.object({
	sort: filterRightNowSortSchema.default("DISTANCE"),

	hostingEnabled: filterHostingEnabledSchema.default(false),
	hosting: filterHostingSchema.default(false),

	ageEnabled: filterAgeEnabledSchema.default(false),
	age: filterAgeSchema.default([AGE_MIN, AGE_MAX]),

	positionEnabled: filterPositionEnabledSchema.default(false),
	positions: filterPositionSchema.default([]),
});

export type RightNowFilters = z.infer<typeof rightNowFiltersSchema>;

export const defaultRightNowFilters: RightNowFilters =
	rightNowFiltersSchema.parse({});

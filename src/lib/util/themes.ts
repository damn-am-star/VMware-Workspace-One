import z from "zod";

export const themeSchema = z.enum(["classic", "sky"]);

export type Theme = z.infer<typeof themeSchema>;

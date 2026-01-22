import { integration } from "@prismatic-io/spectral";
import flows from "./flows";
import { configPages } from "./configPages";
import { componentRegistry } from "./componentRegistry";
import documentation from "../README.md";

export { configPages } from "./configPages";
export { componentRegistry } from "./componentRegistry";

export default integration({
  name: "Luminance MCP Tools",
  description:
    "MCP tools for Luminance API: company context, similar MSAs, clause fallbacks, and signing likelihood estimation",
  iconPath: "icon.png",
  documentation,
  flows,
  configPages,
  componentRegistry,
});

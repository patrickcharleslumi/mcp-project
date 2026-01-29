import { integration } from "@prismatic-io/spectral";
import flows from "./flows";
import { configPages } from "./configPages";
import { componentRegistry } from "./componentRegistry";

export { configPages } from "./configPages";
export { componentRegistry } from "./componentRegistry";

export default integration({
  name: "Luminance MCP Tools",
  description:
    "MCP tools for Luminance API: company context, similar MSAs, clause fallbacks, signing likelihood estimation, and Salesforce commercial context",
  iconPath: "icon.png",
  // Documentation is optional - Prismatic CLI will read README.md from the project root if needed
  flows,
  configPages,
  componentRegistry,
});

import { integration } from "@prismatic-io/spectral";
import flows from "./flows";
import { configPages } from "./configPages";

export default integration({
  name: "Paddy MCP",
  description: "Paddy MCP - Simplified Salesforce Commercial Context Tool",
  iconPath: "icon.png",
  flows,
  configPages,
});
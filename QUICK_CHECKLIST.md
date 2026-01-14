# Quick Checklist: Building Luminance MCP Tools Integration

## Setup (Steps 1-2)
- [ ] Clone/copy Prismatic generic MCP template
- [ ] Initialize npm project
- [ ] Install Prismatic dependencies
- [ ] Create directory structure (`src/actions`, `src/types`, `assets`)
- [ ] Create `package.json`, `tsconfig.json`, `webpack.config.js`

## Core Implementation (Steps 3-6)
- [ ] Create `src/client.ts` (Luminance HTTP client)
- [ ] Create `src/connections.ts` (Luminance connection definition)
- [ ] Create `src/actions/getCompanyContext.ts`
- [ ] Create `src/actions/getSimilarMsas.ts`
- [ ] Create `src/actions/getClauseFallbacks.ts`
- [ ] Create `src/actions/estimateSigningLikelihood.ts`
- [ ] Create `src/actions/index.ts` (export all actions)
- [ ] Create `src/index.ts` (main component definition)
- [ ] Add icon to `assets/icon.png`

## Build & Publish (Step 7)
- [ ] Run `npm run build`
- [ ] Test build succeeds
- [ ] Run `npm run generate:manifest:dev` (for local testing)
- [ ] Login to Prismatic CLI: `prism auth:login`
- [ ] Publish component: `npm run publish`

## Prismatic Setup (Steps 8-9)
- [ ] Create new code-native integration in Prismatic UI
- [ ] Select your published component
- [ ] Configure Luminance connection (base URL, API token)
- [ ] Create agent flow: `get_company_context`
- [ ] Create agent flow: `get_similar_msas`
- [ ] Create agent flow: `get_clause_fallbacks`
- [ ] Create agent flow: `estimate_signing_likelihood`

## Connect & Test (Steps 10-11)
- [ ] Get MCP endpoint from Prismatic UI
- [ ] Configure AI agent (Claude, Cursor, etc.)
- [ ] Test agent flows in Prismatic UI
- [ ] Test MCP connection from AI agent
- [ ] Verify all tools appear and work correctly

## Production Readiness
- [ ] Replace placeholder implementations with actual Luminance API calls
- [ ] Add proper error handling
- [ ] Add retry logic for API calls
- [ ] Add logging and monitoring
- [ ] Test with real data
- [ ] Document any limitations or TODOs

---

**Full Guide:** See [STEP_BY_STEP_BUILD.md](./STEP_BY_STEP_BUILD.md) for detailed instructions.

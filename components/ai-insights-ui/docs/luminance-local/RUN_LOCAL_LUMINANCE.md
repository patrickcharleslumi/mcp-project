# Run Luminance Locally (Corporate / AI Insights)

This guide reproduces the exact local setup used for the AI Insights demo, **without** copying the full `web` repo. It assumes each developer has access to the internal `web` repo and can run services locally.

## Prereqs
- macOS (tested), Node.js as required by `web`
- PostgreSQL + Elasticsearch running locally
- Access to `web` repo + ability to run `START_WEB.sh`

## 1) Clone the `web` repo
```bash
git clone gitlab.team.luminance.com:dev/servers/web.git ~/code/web
```

## 2) Create local config (outside repo)
Create: `~/code/luminance-web-local-config.yaml`

Key settings used in this demo (don’t copy secrets; use your own):
```yaml
port: '4000'
base_uri: 'https://localhost:4000'

pg:
  database: luminance
  user: luminance
  password: '12345'
  port: 5432

es:
  port: 9200
  index: luminance
  group_index: luminance_group
  read: false
  refresh: true

file_store:
  type: local
  root: /Users/<you>/dev/luminance-filestore

https:
  key: /Users/<you>/plugin_auth/localhost.key
  cert: /Users/<you>/plugin_auth/localhost.crt

ui:
  app_type: corporate
  v2_ui_enabled: true
  es_enabled: true
  es_for_groups_enabled: true
  contract_tags_enabled: true
```

## 3) Install dependencies
```bash
cd ~/code/web
npm install
```

## 4) Start services
From `~/code/web`:
```bash
./START_WEB.sh
```
If needed:
```bash
./STOP_WEB.sh
```

## 5) Apply local UI changes (minimal patch set)
The demo uses **local-only changes** in the `web` repo. You do not need to copy the whole repo into `mcp-project`.

We have captured the exact modified files in:
```
mcp-project/components/ai-insights-ui/docs/luminance-local/web-patch/
```

You can copy these over the top of a clean `web` checkout (paths are preserved).

### Copy patch files into `web` (step-by-step)
1. Open a terminal in the `mcp-project` repo.
2. Run the following commands (adjust paths if you used different locations):
```bash
cd /Users/<you>/code/mcp-project/components/ai-insights-ui/docs/luminance-local/web-patch
cp -R . /Users/<you>/code/web/
```
3. Confirm the files landed in the correct locations (paths are preserved).
4. Restart web:
```bash
cd /Users/<you>/code/web
./START_WEB.sh
```

Apply the following **file list** (either by cherry‑pick, patch, or manual edits):

### New files
- `src/public/js/views/corporate/group-overview/group-ai-insights-view.ts`
- `src/public/less/views/corporate/group-overview/group-ai-insights-view.less`
- `views/templates/corporate/group-overview/group-ai-insights-view.hbs`
- `tests/component/views/corporate/group-overview/group-ai-insights-view.test.ts`

### Updated files
- `src/public/js/views/corporate/group-overview.ts`
- `src/public/js/views/corporate/group-overview/group-events-view.ts`
- `src/public/js/views/generic-components/tabs/tabs.js`
- `src/public/js/views/generic-components/tabs/tabs.d.ts`
- `views/templates/corporate/group-overview.hbs`
- `views/templates/generic-components/tabs/tabs.hbs`
- `src/public/less/views/corporate/group-overview.less`
- `src/public/less/views/generic-components/tabs/tabs.less`
- `lib/process/sql.js`
- `lib/routers/collection/fields.js`
- `src/public/js/utils/insightHelpers.js`
- `src/public/js/utils/tube_map_aggregation.ts`

### Assets
- `public/icons/salesforce-logo.png`

### Startup script
- `START_WEB.sh` (copied alongside the patch files)

## 6) Seed demo data (Acme Corp matter + tags)
The demo matter is `groups.id = 17` (room 3). If your matter differs, update the ids in the SQL below.

```bash
psql -U luminance -d luminance -c "begin;
select set_current_user_id(2);
update groups set name = 'Acme Corp - MSA' where id = 17;
update group_versions set name = 'Acme Corp - MSA' where group_id = 17 and state = 'active';
delete from group_annotations where group_id=17 and annotation_type_id in (111,112,113,114,115,116,117,118,119,120,121);
insert into group_annotations (group_id, annotation_type_id, content) values
(17,111, jsonb_build_object('value','Acme Corp')),
(17,112, jsonb_build_object('value',2400000)),
(17,113, jsonb_build_object('value','New York')),
(17,114, jsonb_build_object('value','Net 30 days')),
(17,115, jsonb_build_object('value','Aligned to standard Acme Corp playbook; minor redlines outstanding.')),
(17,116, jsonb_build_object('value','High')),
(17,117, jsonb_build_object('value','Send for signing')),
(17,118, jsonb_build_object('value','12 months fees cap; carve-outs for confidentiality')),
(17,119, jsonb_build_object('value','Customer may terminate with 60 days notice')),
(17,120, jsonb_build_object('value','Consent required for change of control')),
(17,121, jsonb_build_object('value','Assignment to affiliates permitted with notice'));
commit;"
```

## 7) Verify in UI
- Open: `https://localhost:4000`
- Navigate to **Corporate → Matters → Acme Corp - MSA**
- AI Insights tab should render with mock insights and AI agent chat.

## Notes / Troubleshooting
- If the UI shows blank: check `/tmp/gulp.log` for TypeScript/LESS errors.
- For “fake table” errors, ensure ES is running and `analyze=true` is used where appropriate.
- Templates only load on server start; restart if you add a new `.hbs`.

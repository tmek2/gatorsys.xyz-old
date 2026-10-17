import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { source } from "./read-source.ts";

const root = path.resolve(import.meta.dirname, "..");

/**
 * A file from the bot repository, wherever it is checked out beside this one
 * (it is cloned under two names). A few assertions check that both sides agree
 * on a payload shape or a status name, and read the bot's source to do it.
 */
async function botSource(relativePath: string) {
  const candidates = [
    process.env.GATORSYS_REPO,
    "../gatorsys",
    "../fdny-systems",
    "../../tmek/fdny-systems",
  ].filter((candidate): candidate is string => Boolean(candidate));
  for (const base of candidates) {
    try {
      return (await readFile(path.join(root, base, relativePath), "utf8")).replace(
        /\r\n/g,
        "\n",
      );
    } catch {
      continue;
    }
  }
  throw new Error(
    `bot repository not found beside this one (looked for ${candidates.join(", ")})`,
  );
}

async function collectSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(entryPath)));
    } else if (/\.(ts|tsx|js)$/.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

test("the logo is a real image, not a PNG wearing an .svg extension", async () => {
  const { statSync, existsSync } = await import("node:fs");

  // The logo files were base64 PNGs wrapped in an SVG (246KB each, no vector
  // paths), which no image pipeline could optimise.
  assert.equal(existsSync("public/gator-logo.svg"), false);
  assert.equal(existsSync("public/gator-icon.svg"), false);

  const logo = statSync("public/gator-logo.png");
  assert.ok(
    logo.size < 40_000,
    `the logo should stay small, got ${logo.size} bytes`,
  );
});

test("one logo asset, referenced everywhere", async () => {
  const layout = await source("src/app/layout.tsx");
  const files = await collectSourceFiles(path.join(root, "src"));

  assert.match(layout, /icon:\s*"\/gator-logo\.png"/);
  // Two URLs for one image meant two downloads and two cache entries.
  for (const file of files) {
    const contents = await readFile(file, "utf8");
    assert.doesNotMatch(contents, /gator-icon\.svg/, file);
    assert.doesNotMatch(contents, /gator-logo\.svg/, file);
  }
});

test("keeps fixed headers outside transformed route wrappers", async () => {
  const css = await source("src/app/globals.css");
  const header = await source("src/components/legacy-header/header-shell.tsx");
  const pageEnter = css.match(/\.page-enter\s*\{[^}]+\}/)?.[0] ?? "";

  assert.match(header, /\bfixed\b[^`"]*\btop-0\b/);
  assert.doesNotMatch(pageEnter, /fadeUp|transform/);
});

test("refreshes only server data without navigating or reloading", async () => {
  const actions = await source("src/components/servers-actions.tsx");
  const content = await source("src/components/servers-content.tsx").catch(() => "");
  const route = await source("src/app/api/mutual/route.ts");

  assert.doesNotMatch(`${actions}\n${content}`, /window\.location\.(?:assign|reload)/);
  assert.match(`${actions}\n${content}`, /fetch\(["'`]\/api\/mutual\?refresh=1["'`]/);
  assert.match(route, /searchParams\.has\(["']refresh["']\)/);
  assert.match(route, /forceRefresh/);
});

test("uses only the current Discord invite and removes the footer Community option", async () => {
  const sourceFiles = await collectSourceFiles(path.join(root, "src"));
  sourceFiles.push(path.join(root, "next.config.js"));
  const inviteUrls = new Set<string>();

  for (const file of sourceFiles) {
    const fileSource = await readFile(file, "utf8");
    for (const match of fileSource.matchAll(/https:\/\/discord\.gg\/[A-Za-z0-9]+/g)) {
      inviteUrls.add(match[0]);
    }
  }

  assert.deepEqual([...inviteUrls], ["https://discord.gg/X87N8qRbzR"]);

  const footer = await source("src/components/site/site-footer.tsx");
  assert.doesNotMatch(footer, /Discord community|>\s*Community\s*</i);
});

test("credits the creator clearly in the footer", async () => {
  const footer = await source("src/components/site/site-footer.tsx");

  assert.match(footer, /const AUTHOR = "https:\/\/discord\.com\/users\/642749164165267466";/);
  assert.match(footer, /href=\{AUTHOR\}/);
  assert.match(footer, /aria-label="The author on Discord"/);
  assert.doesNotMatch(footer, /Built with care for the communities that run on it/);
});

test("keeps white buttons on one continuous light surface while hovering", async () => {
  const css = await source("src/app/globals.css");
  // Anchor to line starts so the light-theme override (":root[data-theme...
  // .btn-peach") earlier in the file is not mistaken for the base rule.
  const base = css.match(/\n\.btn-peach\s*\{[^}]+\}/)?.[0] ?? "";
  const hover = css.match(/\n\.btn-peach:hover\s*\{[^}]+\}/)?.[0] ?? "";

  assert.match(base, /background-color:\s*#(?:ededed|eeeeee|f0f0f0)/i);
  assert.match(hover, /background-color:\s*#ffffff/i);
  assert.doesNotMatch(`${base}\n${hover}`, /background:\s*(?:linear-gradient|#)/i);
});

test("preserves saved Discord button rows in every legacy message editor", async () => {
  const messageDesign = await source("src/components/Manage/message-design.tsx");
  const sessions = await source("src/components/Manage/sections/sessions.tsx");
  const customCommands = await source(
    "src/components/Manage/sections/custom-commands.tsx",
  );

  assert.match(messageDesign, /doc\.components/);
  assert.match(messageDesign, /components:\s*draft\.components/);
  assert.match(messageDesign, /button\?\.row == null/);
  assert.match(sessions, /<LegacyButtonRowsEditor/);
  assert.match(customCommands, /<LegacyButtonRowsEditor/);
  assert.match(customCommands, /buttons=\{editing\.components/);
});

test("custom commands use the shared save prompt and clear it after a manual revert", async () => {
  const commands = await source(
    "src/components/Manage/sections/custom-commands.tsx",
  );

  assert.match(commands, /registerExternalDraft\(editorKey/);
  // Compared by value: a field cleared to `""` where the baseline has no key is
  // not a change.
  assert.match(commands, /!configValuesEqual\(editing, JSON\.parse\(baseline\)\)/);
  assert.doesNotMatch(commands, /JSON\.stringify\(editing\) !== baseline/);
  assert.match(commands, /setExternalDraftDirty\(editorKey, Boolean\(editing && dirty\)\)/);
  assert.doesNotMatch(commands, /Save & sync command/);
});

test("custom commands and templates expose a simpler guided editor", async () => {
  const commands = await source(
    "src/components/Manage/sections/custom-commands.tsx",
  );
  const messageDesign = await source("src/components/Manage/message-design.tsx");

  // One `+ New` menu for both kinds (command and template), and no filter tabs:
  // both are short lists, shown together.
  assert.match(commands, /label: "Slash command"/);
  assert.match(commands, /label: "Message template"/);
  assert.match(commands, /<NewResourceMenu<"command" \| "template">/);
  assert.doesNotMatch(commands, /"templates", "Message templates"/);
  assert.doesNotMatch(commands, /libraryView/);
  assert.match(commands, /"setup", "1", "Setup"/);
  assert.match(commands, /"inputs", "2", "Inputs"/);
  assert.match(commands, /"response", isTemplate \? "2" : "3", "Response"/);
  assert.match(commands, /Discard these changes\?/);
  assert.match(commands, /Your unsaved edits will be lost/);
  assert.doesNotMatch(messageDesign, /\{\s*value:\s*"forum"/);
});

test("custom command AI can draft full messages, forms, buttons, and workflows", async () => {
  const editor = await source(
    "src/components/Manage/sections/custom-commands.tsx",
  );
  const forms = await source("src/components/Manage/message-design.tsx");

  assert.match(editor, /command,\s*\}\),/);
  assert.match(editor, /suggestion\.components/);
  assert.match(editor, /suggestion\.v2_layout/);
  assert.match(editor, /suggestion\.permissionroles/);
  assert.match(editor, /message, fields, buttons, forms, and workflows/);
  assert.match(forms, /reviewedFormActions/);
  assert.match(forms, /approval_kind:\s*checked \? "reviewed_form"/);
});

test("the department workspace reports which tab is open", async () => {
  const workspace = await source(
    "src/components/Manage/department-workspace.tsx",
  );

  assert.match(workspace, /onTabChange\?\.\(item\.id\)/);
});

test("scheduled announcements close their editor and remain visibly marked", async () => {
  const workspace = await source(
    "src/components/Manage/department-workspace.tsx",
  );

  assert.match(workspace, /setScheduleOpen\(false\)/);
  assert.match(workspace, /Scheduled/);
  assert.match(workspace, /scheduled_for/);
});

test("dashboard notices wrap instead of cutting their message off", async () => {
  const saveBar = await source("src/components/Manage/save-bar.tsx");
  const win = await source("src/components/Manage/manage-window.css");

  assert.match(saveBar, /title: "gw-toast-say"/);
  assert.match(win, /\.gw-toast-say \{[^}]*overflow-wrap: anywhere/);
  assert.doesNotMatch(win, /\.gw-toast-say \{[^}]*text-overflow/);
  assert.doesNotMatch(saveBar, /className="truncate/);
});

test("audit command rows expose status, timing, arguments, and failures", async () => {
  const audit = await source("src/components/Manage/sections/audit.tsx");

  assert.match(audit, /entry\.status/);
  assert.match(audit, /entry\.duration_ms/);
  assert.match(audit, /entry\.arguments/);
  assert.match(audit, /entry\.error/);
});

test("department application question menu stays above the full-screen editor", async () => {
  const applicationEditor = await source(
    "src/components/Manage/application-editor.tsx",
  );
  const workspace = await source(
    "src/components/Manage/department-workspace.tsx",
  );

  assert.match(applicationEditor, /fixed z-\[220\].*QUESTION_TYPE_MENU/s);
  assert.match(applicationEditor, /maxHeight: coords\.maxHeight/);
  assert.match(applicationEditor, /window\.innerHeight - maxHeight - margin/);
  assert.match(workspace, /<QuestionList[\s\S]*resource\.questions/);
  assert.match(workspace, /Copy application link/);
  assert.match(workspace, /Copy join link/);
});

test("co-owner assignment uses a live shared multi-picker and excludes existing owners", async () => {
  const workspace = await source(
    "src/components/Manage/department-workspace.tsx",
  );
  const coOwnerArea = workspace.slice(
    workspace.indexOf('title="Department Co-owners"'),
    workspace.indexOf('title="Department Icon"'),
  );

  assert.match(coOwnerArea, /<MultiSelectField/);
  assert.doesNotMatch(coOwnerArea, /<select/);
  assert.match(coOwnerArea, /!member\.owner/);
  assert.match(coOwnerArea, /!coOwnerIds\.includes/);
  assert.match(workspace, /await refreshConfig\(\);/);
});

test("scheduled shouts expose the local date and timezone on hover", async () => {
  const workspace = await source(
    "src/components/Manage/department-workspace.tsx",
  );

  assert.match(workspace, /group-hover:block group-focus:block/);
  assert.match(workspace, /timeZoneName: "short"/);
  assert.match(workspace, /Scheduled for \{new Intl\.DateTimeFormat/);
});

test("points stages use the shared styled picker", async () => {
  const points = await source("src/components/Manage/department-points.tsx");

  assert.match(points, /<SelectField/);
  assert.doesNotMatch(points, /<select/);
});

test("activity waves can be started explicitly and rank sync can be confirmed", async () => {
  const workspace = await source(
    "src/components/Manage/department-workspace.tsx",
  );

  assert.match(workspace, /"wave_start" : "wave_schedule"/);
  assert.match(workspace, /wave_cancel/);
  assert.match(workspace, /discord_role_sync_unavailable/);
  assert.match(workspace, /Continue without Discord role/);
  assert.match(workspace, /ignore_discord_role_sync/);
});

test("API management tab and route are removed", async () => {
  const shell = await source("src/components/Manage/manage-shell.tsx");
  const apiRoute = await source("src/app/api/manage/[id]/apikeys/route.ts").catch(
    () => "",
  );

  assert.doesNotMatch(shell, /api-keys|ApiKeysSection/);
  assert.equal(apiRoute, "");
});

test("a picker can keep its menu fixed with search at the bottom", async () => {
  const fields = await source("src/components/Manage/fields.tsx");

  assert.match(fields, /searchPosition === "bottom"/);
  assert.match(fields, /if \(repositionOnScroll\) window\.addEventListener\("scroll"/);
});

test("roster no-op updates do not produce a notification", async () => {
  const workspace = await source(
    "src/components/Manage/department-workspace.tsx",
  );

  assert.match(workspace, /!message\.toLowerCase\(\)\.startsWith\("no changes"\)/);
});

test("manage window uses the unified Gator canvas and shareable sections", async () => {
  const shell = await source("src/components/Manage/manage-shell.tsx");
  const overview = await source("src/components/Manage/sections/overview.tsx");
  const css = await source("src/app/globals.css");
  const manageCss = await source("src/components/Manage/manage-restyle.css");
  const landingHeader = await source("src/components/legacy-header/header-shell.tsx");
  const themeToggle = await source("src/components/Manage/theme-toggle.tsx");

  // The dashboard is the landing's window: the site's own header component, the
  // window chrome under it, and the page's ground around it.
  assert.match(shell, /from "@\/components\/site\/command-palette"/);
  assert.match(shell, /from "@\/components\/site\/theme-toggle"/);
  assert.match(shell, /from "@\/components\/site\/gator-logo"/);
  assert.match(shell, /className="gw"/);
  assert.match(shell, /className="gw-bar"/);
  assert.match(shell, /className="gw-pane manage-content"/);
  assert.match(shell, /className="gw-foot"/);
  assert.match(shell, /`\/manage\/\$\{guildId\}\/\$\{next\}`/);
  assert.match(shell, /window\.history\.pushState/);
  assert.match(shell, /hidden=\{section === "resources"\}/);
  assert.match(overview, /overview-page/);
  // The stats render inside the hero's right half, not in a separate band below
  // it.
  assert.match(overview, /<header className="overview-intro"[\s\S]{0,500}<h2>Overview<\/h2>/);
  assert.doesNotMatch(overview, /OverviewStat|overview-status/);
  assert.match(overview, /variant="overview"/);
  const windowCss = await source("src/components/Manage/manage-window.css");
  assert.match(windowCss, /\.manage-root \.gw-mods/);
  // The frame is drawn out of the site's own tokens rather than a second
  // palette kept in step by hand.
  assert.match(windowCss, /var\(--mac-pane-bg\)/);
  assert.match(manageCss, /--manage-tab: #0b0b0b/);
  assert.match(landingHeader, /<ThemeToggle \/>/);
  assert.doesNotMatch(landingHeader, /root\.dataset\.theme = "dark"/);
  assert.match(themeToggle, /localStorage\.setItem\("gator-theme"/);
});

test("resources autosave and spreadsheet uses the Univer editor with live collaboration", async () => {
  const resources = await source("src/components/Manage/sections/resources.tsx");
  const applications = await source("src/components/Manage/application-editor.tsx");
  const spreadsheet = await source("src/components/Manage/department-spreadsheet-editor.tsx");

  assert.match(resources, /save\("Resources"\)/);
  assert.match(applications, /save\("Applications"\)/);
  // Univer powers the grid (full feature set, true fills, Excel-style white).
  assert.match(spreadsheet, /createUniver/);
  assert.match(spreadsheet, /darkMode: dark/);
  assert.match(spreadsheet, /CommandExecuted/);
  // Live collaboration: local mutations are relayed and remote ones re-applied.
  assert.match(spreadsheet, /spreadsheet_op/);
  assert.match(spreadsheet, /syncExecuteCommand/);
  assert.match(spreadsheet, /fromCollab/);
  assert.match(spreadsheet, /deptsheetops/);
  assert.match(resources, /action: "save", resource/);
});

test("server resources open as dedicated editor pages", async () => {
  const shell = await source("src/components/Manage/manage-shell.tsx");
  const route = await source("src/app/manage/[id]/[[...section]]/page.tsx");
  const resourceRoute = await source(
    "src/app/manage/[id]/resources/[resourceId]/page.tsx",
  );
  const resourceClient = await source(
    "src/app/manage/[id]/resources/[resourceId]/server-resource-client.tsx",
  );
  const resources = await source(
    "src/components/Manage/sections/resources.tsx",
  );
  const css = await source("src/app/globals.css");

  assert.match(route, /initialPath=\{section\.join\("\/"\)\}/);
  assert.match(shell, /slice\(2\)\s*\.join\("\/"\)/);
  assert.match(
    resources,
    /href=\{`\/manage\/\$\{guildId\}\/resources\/\$\{document\.id\}`\}/,
  );
  assert.match(
    resources,
    /window\.location\.assign\(`\/manage\/\$\{guildId\}\/resources\/\$\{resource\.id\}`\)/,
  );
  assert.doesNotMatch(resources, /editingDocument|initialResourceId/);
  assert.match(resourceRoute, /<ServerResourceClient/);
  assert.match(resourceClient, /<DepartmentDocumentEditor/);
  assert.match(resourceClient, /<DepartmentSpreadsheetEditor/);
  // The share link is `/document/<slug>`, built by the helper; the old
  // `/docs/shared/<guild>/<resource>` path redirects to it.
  assert.match(
    resourceClient,
    /resourceLink\("document", guildId, resource\.id\)/,
  );
  assert.match(resources, /resource-workspace-hero/);
  assert.match(css, /\.resource-workspace-hero/);
});

test("question builders use spring reordering with a branded placement line", async () => {
  const hook = await source("src/components/Manage/use-spring-reorder.ts");
  const applications = await source("src/components/Manage/application-editor.tsx");
  const departments = await source("src/components/Manage/department-workspace.tsx");
  const resources = await source("src/components/Manage/sections/resources.tsx");
  const css = await source("src/app/globals.css");

  assert.match(hook, /createSwapy/);
  assert.match(hook, /animation: "spring"/);
  assert.match(hook, /autoScrollOnDrag: true/);
  assert.match(applications, /data-swapy-slot/);
  assert.match(departments, /data-swapy-slot/);
  assert.match(resources, /data-swapy-handle/);
  assert.match(css, /\.swapy-list-slot\[data-swapy-highlighted\]::after/);
  assert.match(css, /background: var\(--accent-peach\)/);
});

test("department applications use the shared editor and public submission route", async () => {
  const workspace = await source("src/components/Manage/department-workspace.tsx");

  assert.match(workspace, /\/applications\/\$\{application\.id\}\?department=/);
  // `/form/<id>`, built by the helper from the application's public id (the
  // number the bot allocated), so the link survives a rename.
  assert.match(
    workspace,
    /formLink\(guildId, application\.id, application\.public_id\)/,
  );
  assert.match(workspace, /resource\.kind !== "application"/);
  assert.match(workspace, /profile\.application_id \|\| feature\.join_application_id/);
});

test("department joining stays in a dashboard modal, including applications", async () => {
  const servers = await source("src/components/servers-content.tsx");
  const joinPage = await source("src/app/departments/join/page.tsx");
  const joinConfirm = await source(
    "src/app/departments/join/[code]/join-confirm.tsx",
  );
  const joinForm = await source(
    "src/app/departments/join/department-join-form.tsx",
  );
  const applicationForm = await source("src/components/application-form.tsx");

  assert.match(joinPage, /redirect\("\/servers\?join=1"\)/);
  assert.match(servers, /role="dialog"/);
  assert.match(servers, /<DepartmentJoinForm[\s\S]*embedded[\s\S]*autoSubmit/);
  assert.match(joinConfirm, /onApplicationRequired/);
  assert.match(joinForm, /embedded\?: boolean/);
  assert.match(joinForm, /gate\?\.application\.source === "standard"/);
  assert.match(joinForm, /<ApplicationForm/);
  assert.match(applicationForm, /onSubmitted\?: \(\) => void/);
});

test("department applications stay scoped to their department workspace", async () => {
  const resources = await source("src/components/Manage/sections/resources.tsx");
  const editor = await source("src/components/Manage/application-editor.tsx");

  assert.match(resources, /application\.scope !== "department"/);
  assert.match(resources, /const departmentApplications = allApplications\.filter/);
  assert.match(editor, /Department join application/);
  assert.match(editor, /const backHref = portalBase/);
  assert.match(editor, /departmentMode && departmentId/);
  assert.ok(
    editor.indexOf('title="Department join application"') <
      editor.indexOf('title="General"'),
  );
});

test("department infractions expose attached proof", async () => {
  const workspace = await source("src/components/Manage/department-workspace.tsx");

  assert.match(workspace, /setProofRecord\(record\)/);
  assert.match(workspace, /Attached proof/);
  assert.match(workspace, /View attached proof/);
  assert.match(workspace, /data:video/);
});

test("resource editors keep their working formatting integrations", async () => {
  const documentEditor = await source(
    "src/components/Manage/department-document-editor.tsx",
  );
  const spreadsheet = await source(
    "src/components/Manage/department-spreadsheet-editor.tsx",
  );

  // Documents run on Tiptap (ProseMirror): marks toggle reliably and
  // formatting never leaks into the next line the way execCommand did.
  assert.match(documentEditor, /useEditor\(/);
  assert.match(documentEditor, /toggleItalic\(\)/);
  assert.match(documentEditor, /toggleHeading\(\{ level/);
  assert.doesNotMatch(documentEditor, /document\.execCommand/);
  // Sheet runs on Univer with darkMode off so fills render exactly as picked.
  assert.match(spreadsheet, /darkMode: dark/);
});

test("department points and manage chrome match the polished settings design", async () => {
  const points = await source("src/components/Manage/department-points.tsx");
  const globals = await source("src/app/globals.css");

  assert.match(points, /Configuration &amp; preview/);
  assert.match(points, /Decrease preview points/);
  assert.match(points, /Increase preview points/);
  assert.match(points, /<Toggle/);
  assert.match(globals, /--manage-chrome: #131415/);
});

test("message editors use the branded color picker without pink text-field outlines", async () => {
  const globals = await source("src/app/globals.css");
  const embedEditor = await source("src/components/Manage/embed-editor.tsx");
  const sessions = await source("src/components/Manage/sections/sessions.tsx");
  const autoResponse = await source("src/components/Manage/sections/auto-response.tsx");
  const focusRule =
    globals.match(/:where\([^)]+\):focus-visible\s*\{[^}]+\}/)?.[0] ?? "";

  assert.doesNotMatch(focusRule, /\binput\b|\btextarea\b/);
  assert.doesNotMatch(`${embedEditor}\n${sessions}\n${autoResponse}`, /type="color"/);
  assert.match(embedEditor, /<ColorPicker[\s\S]*label="Choose embed color"/);
  assert.match(sessions, /<ColorPicker[\s\S]*label="Choose session embed color"/);
  assert.match(autoResponse, /<ColorPicker[\s\S]*label="Choose role color"/);
});

test("auto responses show saved actions and open from the response row", async () => {
  const autoResponse = await source("src/components/Manage/sections/auto-response.tsx");
  const route = await source("src/app/api/manage/[id]/autoresponders/route.ts");

  assert.match(autoResponse, /Click anywhere to edit/);
  assert.match(autoResponse, /\(responder\.actions \|\| \[\]\)\.slice\(0, 4\)/);
  assert.doesNotMatch(autoResponse, /IconPencil/);
  assert.match(autoResponse, /SIMILARITY_LEVELS = \[1, 2, 3, 4, 5\]/);
  assert.match(autoResponse, /Similarity from 1 broad to 5 exact/);
  assert.match(autoResponse, /level \{similarityLevel\(responder\.similarity\)\}\/5/);
  assert.doesNotMatch(autoResponse, /type="range"|% match/);
  for (const action of [
    "wait",
    "reply_message",
    "add_reaction",
    "create_thread",
    "pin_message",
    "clear_timeout",
  ]) {
    assert.match(autoResponse, new RegExp(`value: "${action}"`));
  }
  assert.match(route, /\.\.\.body/);
});

test("dashboard joke has a hydration-safe initial line", async () => {
  const shell = await source("src/components/Manage/manage-shell.tsx");
  const resources = await source("src/components/Manage/sections/resources.tsx");
  // The joke moved out of the rail and into the status strip, where it is the
  // mark in the corner and the line is what it says when you press it.
  const start = shell.indexOf("function GatorPun()");
  assert.ok(start > 0, "the pun should still be here");
  const joke = shell.slice(start, shell.indexOf("function ShellInner"));

  assert.match(joke, /const \[index, setIndex\] = useState\(0\)/);
  assert.doesNotMatch(joke, /useState\(\(\) => Math\.floor\(Math\.random/);
  assert.doesNotMatch(shell, /🐊/);
  assert.doesNotMatch(resources, /🐊/);
});

test("bulk approve/deny sends one shared reason and reports partial failures", async () => {
  const list = await source("src/components/Manage/sections/resources.tsx");
  const modal = await source("src/components/Manage/bulk-decision-modal.tsx");
  const route = await source(
    "src/app/api/manage/[id]/applicationdecisionbulk/route.ts",
  );

  // One request for the batch, carrying the shared reason.
  assert.match(list, /applicationdecisionbulk/);
  assert.match(list, /JSON\.stringify\(\{ ids, decision, reason \}\)/);

  // A blocked submission must be surfaced, not silently left pending.
  assert.match(list, /json\.failed/);
  assert.match(list, /could not be processed/);

  // Changing tabs clears the selection so nothing off-screen gets swept up.
  assert.match(list, /setStatusFilter\(t\.id\);[\s\S]{0,220}setSelected\(new Set\(\)\)/);

  // The reason field is owned by the modal — storing it in ConfirmState would
  // read a stale value, since that dialog keeps its body as a stored node.
  assert.match(modal, /useState\(""\)/);
  assert.match(modal, /onConfirm\(reason\.trim\(\)\)/);

  assert.match(route, /Select at least one response/);
  assert.match(route, /decision !== "approve" && decision !== "deny"/);
});

test("version history restores content without dragging permissions back", async () => {
  const panel = await source("src/components/Manage/version-history.tsx");
  const doc = await source("src/components/Manage/department-document-editor.tsx");
  const sheet = await source(
    "src/components/Manage/department-spreadsheet-editor.tsx",
  );
  const restore = await source(
    "src/app/api/manage/[id]/resourceversionrestore/route.ts",
  );

  // Both editors expose it, and both feed the restored content back through
  // their existing onChange rather than reloading the page.
  for (const editor of [doc, sheet]) {
    assert.match(editor, /<VersionHistory/);
    assert.match(editor, /onRestored=\{/);
  }
  assert.match(doc, /kind="document"/);
  assert.match(sheet, /kind="spreadsheet"/);

  // Restoring is itself undoable, so the confirmation must say so.
  assert.match(panel, /saved to history first/);
  assert.match(panel, /Sharing and permissions are not affected/);

  assert.match(restore, /Missing resource or version/);
});

test("manage states its palette once, over the duplicates in globals", async () => {
  const restyle = await source("src/components/Manage/manage-restyle.css");
  const shell = await source("src/components/Manage/manage-shell.tsx");

  const restyleAt = shell.indexOf('import "./manage-restyle.css"');
  assert.ok(restyleAt > 0);
  assert.ok(
    restyleAt > shell.lastIndexOf('from "./nav-groups"'),
  );
});

test("manage is usable on a phone", async () => {
  const restyle = await source("src/components/Manage/manage-restyle.css");
  const shell = await source("src/components/Manage/manage-shell.tsx");

  // The rail overlays the pane on a phone, so it closes after a tap; otherwise
  // it hides the tab just opened.
  assert.match(
    shell,
    /onNavigate\(next\);[\s\S]{0,360}min-width:\s*1024px[\s\S]{0,80}setRail\(false\)/,
  );
  // And it slides off the edge rather than collapsing to nothing in the
  // layout, because at these widths it is a panel over the pane.
  const windowCss = await source("src/components/Manage/manage-window.css");
  assert.match(
    windowCss,
    /@media \(max-width: 1023px\)[\s\S]{0,900}transform: translateX\(-100%\)/,
  );

  assert.match(restyle, /font-size:\s*16px/);
  assert.match(restyle, /overflow-x:\s*clip/);
  assert.match(restyle, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/);
});

test("motion is one system, and only animates composited properties", async () => {
  const motion = await source("src/styles/motion.css");
  const hook = await source("src/components/motion.tsx");
  const globals = await source("src/app/globals.css");

  assert.match(globals, /@import "\.\.\/styles\/motion\.css"/);

  // Only opacity and transform. Animating filter, box-shadow or box-model
  // properties is what turns "smooth" into dropped frames.
  const transitions = motion.match(/transition:[^;]+;/g) || [];
  for (const rule of transitions) {
    assert.doesNotMatch(rule, /\b(filter|box-shadow|width|height|top|left|margin)\b/);
  }

  // Exit animations exist at all — the old surfaces animated in and then
  // vanished on the frame they unmounted.
  assert.match(hook, /setMounted\(false\)/);
  assert.match(hook, /duration/);
  // Two frames, so the browser always has a state to transition from.
  assert.match(hook, /requestAnimationFrame\([\s\S]{0,120}requestAnimationFrame/);

  assert.match(motion, /prefers-reduced-motion: reduce/);
});

test("the sidebar groups are four to six items, like the reference", async () => {
  const nav = await source("src/components/Manage/nav-groups.tsx");
  const groups = nav.slice(nav.indexOf("export const NAV_GROUPS"));

  const sizes = [...groups.matchAll(/items: \[([\s\S]*?)\n    \],/g)].map(
    (match) => (match[1].match(/\{ id:/g) || []).length,
  );
  // Groups are kept between two and ten items. The floor is not padded with
  // rows that go nowhere: Integrations is honestly two items (ERLC and Roblox).
  assert.ok(Math.min(...sizes) >= 2, `a group has only ${Math.min(...sizes)} items`);
  assert.ok(Math.max(...sizes) <= 7, `a group has ${Math.max(...sizes)} items`);

  const titles = [...groups.matchAll(/title: "([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(titles, [
    "Staff",
    "Moderation",
    "Requests",
    "Community",
    "Integrations",
    "Content",
  ]);
});

test("the manage palette is stated in hex, not tokens that resolve to itself", async () => {
  const restyle = await source("src/components/Manage/manage-restyle.css");

  // The restyle is written in `--manage-*` tokens, which are the ones that
  // change the colours on screen.
  assert.match(restyle, /--manage-tab: #0b0b0b/);
  assert.match(restyle, /--manage-panel: #101010/);
  assert.match(restyle, /--manage-control: #101010/);
  assert.match(restyle, /background: #1c1d1e !important/);

  // Controls are recessed below the card they sit on, so a field reads as a
  // recess rather than another card.
  assert.match(restyle, /\.gator-control[\s\S]{0,400}var\(--manage-control\)/);

  // The stat icons are the hero's hand-drawn blob, not tinted rounded squares.
  const globalsCss = await source("src/app/globals.css");
  assert.doesNotMatch(globalsCss, /\.overview-stat-icon/);
  assert.doesNotMatch(restyle, /\.overview-stat-icon/);
});

test("the sidebar has the page's scrollbar, and keeps it while scrolling", async () => {
  const restyle = await source("src/components/Manage/manage-restyle.css");
  const shell = await source("src/components/Manage/manage-shell.tsx");
  const win = await source("src/components/Manage/manage-window.css");

  /* It used to appear only while moving, and a rule that hid every
     `[data-scrolling]` thumb made it vanish exactly then. It is now the same
     thin thumb as the page's, always there. */
  assert.doesNotMatch(shell, /dataset\.scrolling/);
  assert.doesNotMatch(restyle, /data-scrolling/);
  assert.match(win, /:root \.gw-nav::-webkit-scrollbar-thumb,/);
  /* `:root` so globals.css's light-mode `scrollbar-color` on
     `:root[data-theme="light"] *` cannot win and bring back the thick
     Windows bar with arrows. */
  assert.match(win, /:root \.gw-nav,\n/);
});

test("GatorAI's three dials are separate settings with visible consequences", async () => {
  const section = await source("src/components/Manage/sections/gator-ai.tsx");
  const shell = await source("src/components/Manage/manage-shell.tsx");

  assert.match(shell, /case "ai":\s*\n\s*return <GatorAiSection[^>]*\/>/);

  // Tone and subject matter are independent, so they are independent controls.
  assert.match(section, /onChange=\{\(personality\) => patch\(\{ personality \}\)\}/);
  assert.match(section, /onChange=\{\(age\) => patch\(\{ age \}\)\}/);
  assert.match(section, /onChange=\{\(filter\) => patch\(\{ filter \}\)\}/);
  for (const tier of ["friendly", "balanced", "unfiltered"]) {
    assert.match(section, new RegExp(`id: "${tier}"`), tier);
  }
  // Voice age: register only, and named for what it sets rather than for a
  // generation that dates the moment it ships.
  for (const tier of ["online", "everyday", "formal"]) {
    assert.match(section, new RegExp(`id: "${tier}"`), tier);
  }
  assert.doesNotMatch(section, /id: "(genz|old ?english)"/i);

  /* What the three add up to is shown, not described: a member asks
     something and it answers in the picked manner, again as a dial moves.
     Every personality and filter has its own answer, and the voice is
     applied to it. */
  assert.match(section, /type Answers = Record<Personality, Record<Filter, string>>;/);
  assert.match(section, /function voiced\(text: string, age: Age\): string/);
  assert.match(section, /<AiPreview personality=\{draft\.personality\} age=\{draft\.age\} filter=\{draft\.filter\} \/>/);
  assert.doesNotMatch(section, /describeCombination|gw-ai-sum/);
  // The people in it are the site's sample people.
  assert.match(section, /who: "\.tmek"/);

  // The limits are stated in one plain sentence (slurs, sexual content and
  // politics included), so nobody picks Unfiltered expecting none.
  assert.match(section, /Whatever you pick, it never uses slurs, never makes sexual content, and never takes a\s+side on politics or religion\./);
  assert.doesNotMatch(section, /block_sensitive/);

  // It is a reply, not a mention.
  assert.match(section, /respond_to_replies/);
  assert.doesNotMatch(section, /respond_to_mentions/);
  assert.match(section, /label="Replies"/);

  // A cooldown under thirty seconds is a flood.
  assert.match(section, /MIN_COOLDOWN_SECONDS = 30/);
  assert.match(section, /min=\{MIN_COOLDOWN_SECONDS\}/);
  assert.match(section, /label="Images"/);
  assert.match(section, /checked=\{draft\.image_generation\}/);

  const gatorRoute = await source("src/app/api/manage/[id]/gatorai/route.ts");
  assert.match(gatorRoute, /MIN_GATORAI_COOLDOWN_SECONDS = 30/);
  assert.match(gatorRoute, /Math\.max\(\s*MIN_GATORAI_COOLDOWN_SECONDS/);

  // No per-page save button: save and discard go through the dashboard's save
  // prompt, and dirtiness is compared with what is stored, so undoing an edit
  // dismisses the prompt.
  assert.doesNotMatch(section, /Saving…/);
  assert.match(section, /registerExternalDraft\("gatorai"/);
  assert.match(section, /discard: \(\) => setDraft\(savedRef\.current\)/);
  assert.match(section, /!configValuesEqual\(saved, draft\)/);

  // Ticket-side behaviour moved to Tickets, where it applies. The field stays
  // in the payload type — it is the same record — but is not edited here.
  assert.doesNotMatch(section, /patch\(\{ escalate_after_turns/);
  assert.doesNotMatch(section, /Escalate after/);
  const tickets = await source("src/components/Manage/sections/tickets.tsx");
  assert.match(tickets, /<TicketAiBehaviour \/>/);
});

test("bot-owner notices are reversible and scoped to what was asked", async () => {
  const panel = await source("src/components/owner-context.tsx");
  const owner = await source("src/components/owner-panel.tsx");
  const route = await source("src/app/api/owner/context/route.ts");

  // A second tab, so the servers list and the AI context are separate jobs.
  assert.match(owner, /<OwnerContext \/>/);
  assert.match(owner, /"servers" \| "context"/);

  // The point of the feature: turning it off restores normal behaviour with no
  // cleanup step.
  assert.match(panel, /back to the\s*\n?\s*documentation/);
  assert.match(panel, /action: "delete"/);
  // Editing and toggling reuse the same notice rather than retyping it.
  assert.match(panel, /active: !notice\.active/);
  assert.match(panel, /setDraft\(\{\s*\n?\s*id: notice\.id/);

  // Topic scoping, so an outage about one feature is not recited everywhere.
  assert.match(panel, /Leave empty to apply to everything/);

  assert.match(route, /dashboard_globalcontext/);
});

test("overlays animate out too, without every modal hoisting its conditional", async () => {
  const exit = await source("src/components/overlay-exit.tsx");
  const layout = await source("src/app/layout.tsx");

  assert.match(layout, /<OverlayExit \/>/);

  // A modal mounted conditionally is gone the frame it closes. React has
  // already detached the node, so it can be re-inserted and faded out.
  assert.match(exit, /MutationObserver/);
  assert.match(exit, /removedNodes/);
  assert.match(exit, /document\.body\.appendChild/);
  // Subtree removals count: the overlay often goes with its parent.
  assert.match(exit, /querySelectorAll\?\.\(["'`]\.gator-overlay/);

  // The ghost is a picture of a modal, not a modal.
  assert.match(exit, /pointerEvents = "none"/);
  assert.match(exit, /aria-hidden/);
  // And the entrance must be cancelled, or it flashes back in before leaving.
  assert.match(exit, /style\.animation = "none"/);

  // It can never leave a stranded overlay on the page.
  assert.match(exit, /setTimeout\(cleanup/);
  assert.match(exit, /prefers-reduced-motion/);
});

test("overlays animate in rather than appearing from nowhere", async () => {
  const motion = await source("src/styles/motion.css");
  assert.match(motion, /\.gator-overlay\b/);
  assert.match(motion, /@keyframes gator-panel-in/);

  // The scrim fades, the panel moves. Animating both identically makes the
  // backdrop feel detached from the dialog.
  assert.match(motion, /\.gator-overlay > :not\(button\)/);

  for (const file of [
    "src/components/Manage/department-ranks.tsx",
    "src/components/Manage/sections/permissions.tsx",
    "src/components/Manage/application-editor.tsx",
    "src/components/Manage/department-workspace.tsx",
  ]) {
    const source_ = await source(file);
    assert.match(source_, /className="gator-overlay fixed inset-0/, file);
  }
});

test("a stretched button rule no longer deforms the toggle switches", async () => {
  const restyle = await source("src/components/Manage/manage-restyle.css");
  // The mobile tap-target rule skips switches; it used to stretch them into
  // tall ovals.
  assert.match(restyle, /button:not\(\.sidebar-item\)[\s\S]{0,160}:not\(\[role="switch"\]\)/);
  // Keyed on the `Toggle` component's own class, not on the role: a role is
  // not a shape, and the module card and every option tile are switches too.
  assert.match(restyle, /\.manage-content \.gator-switch \{[^}]*height: 28px/s);
  // A 48x18 target under a thumb was the other half of the old fix; the
  // collar takes the pressable area to 44 without changing what is drawn.
  assert.match(restyle, /\.manage-content \.gator-switch::after \{[^}]*inset: -8px;/s);
  assert.doesNotMatch(restyle, /\.manage-content \[role="switch"\][^,{]*\{[^}]*height: 18px/s);
});

test("ticket panels can actually be sent to a channel", async () => {
  const modal = await source("src/components/Manage/send-panel-modal.tsx");
  const tickets = await source("src/components/Manage/sections/tickets.tsx");
  const route = await source(
    "src/app/api/manage/[id]/ticketpanelsend/route.ts",
  );

  // There was no way to post a panel from the dashboard at all.
  assert.match(tickets, /<SendPanelModal/);
  assert.match(tickets, /Send panel/);
  assert.match(route, /dashboard_ticketpanelsend/);

  // The channel is picked at send time, because sending is an action rather
  // than a setting and the same panel gets posted more than once.
  assert.match(modal, /Search channels…/);
  assert.match(modal, /panelType/);
  // Sending a panel with unsaved edits would post the old version.
  assert.match(tickets, /disabled=\{busy \|\| dirty\}/);
});

test("applications flag how each answer was written, per question", async () => {
  const integrity = await source("src/components/application-integrity.ts");
  const form = await source("src/components/application-form.tsx");
  const responses = await source("src/components/Manage/sections/resources.tsx");
  const notes = await source("src/components/Manage/authorship-notes.tsx");

  // The old signal was one number for a whole submission, and the public form
  // captured nothing at all — so there was no per-question data to show.
  assert.match(form, /createIntegrityTracker/);
  assert.match(form, /onPaste:/);
  assert.match(form, /integrity: integrity\.current\.snapshot\(\)/);
  // A paste also fires onChange; those characters must not count as typed too.
  assert.match(form, /integrity\.current\.typed\(q\.id, -text\.length\)/);

  // Short answers say nothing, so they are not flagged.
  assert.match(integrity, /if \(total < 40 \|\| answerLength < 40\) return null/);
  // "Typed" and "reads as written" are the expected cases, so neither renders
  // anything — an absent signal has to look like nothing.
  assert.match(notes, /if \(!showPaste && !showAi\) return null/);
  // Both signals sit on the question they describe, in the tag row and in the
  // note under the answer.
  assert.match(responses, /<AuthorshipTags/);
  assert.match(responses, /<AuthorshipNotes/);
  // It is a hint, not an accusation.
  assert.match(integrity, /may just mean it was drafted elsewhere/);
});

test("the department review panel flags answers per question, not per submission", async () => {
  const workspace = await source("src/components/Manage/department-workspace.tsx");
  const card = await source("src/components/form-question-field.tsx");

  // This surface had only the whole-submission summary: a paste percentage for
  // a twelve-question form, which cannot say which answer it means.
  assert.match(workspace, /<AuthorshipTags/);
  assert.match(workspace, /<AuthorshipNotes/);
  // Signals are attributed to a question by the marker on the card, because
  // the form captures keystrokes and pastes at the container.
  assert.match(card, /data-question-id=\{question\.id\}/);
  assert.match(workspace, /data-question-id/);
  assert.match(workspace, /questions: perQuestion\.snapshot\(\)/);
  // Timing needs focus and blur, or "faster than anyone types" is undetectable.
  assert.match(workspace, /onFocusCapture=\{integrity\.current\.onFocusCapture\}/);
});

test("an AI scan is something a reviewer asks for, on one submission", async () => {
  const responses = await source("src/components/Manage/sections/resources.tsx");
  const workspace = await source("src/components/Manage/department-workspace.tsx");
  const integrity = await source("src/components/application-integrity.ts");

  // A button, not something that runs on open: every scan is a model request
  // made about a real person's writing.
  assert.match(responses, /<AiScanButton/);
  assert.match(responses, /applicationaiscan/);
  assert.match(workspace, /applicationaiscan/);
  // Per question, never one verdict for the submission.
  assert.match(integrity, /questions: Record<string, AiQuestionFlag>/);
  // "Nothing looked generated" and "the model was unavailable" are different
  // answers and must not read as the same one.
  assert.match(responses, /model_available === false/);
  // And it decides nothing on its own.
  assert.match(integrity, /Worth reading closely, but it is not proof/);
});

test("a settings tab does not open with a list of slash commands", async () => {
  const section = await source("src/components/Manage/schema-section.tsx");
  const schema = await source("src/components/Manage/schema.ts");

  // No table of the module's commands at the top of a settings tab; the tab
  // opens on its settings.
  assert.doesNotMatch(section, /section\.commands/);
  assert.doesNotMatch(section, /Available in Discord after this module is enabled/);
  // And the data behind it is gone too, rather than left to rot unrendered.
  assert.doesNotMatch(schema, /commands\?: \{ name: string/);
  assert.doesNotMatch(schema, /\{ name: "\/shift start"/);
});

test("the dashboard's chrome is the site's, and there is one of it", async () => {
  const css = await source("src/components/Manage/manage-restyle.css");
  const windowCss = await source("src/components/Manage/manage-window.css");
  const shell = await source("src/components/Manage/manage-shell.tsx");

  // One bar: no bespoke top bar and no second bar under the site header.
  assert.doesNotMatch(shell, /manage-topbar/);
  assert.match(shell, /<CommandPalette/);
  assert.match(shell, /<ThemeToggle \/>/);
  assert.match(shell, /<GatorLogo/);
  assert.equal((shell.match(/className="gw-bar"/g) || []).length, 1);

  // The page does not scroll: the window is the viewport and the pane scrolls,
  // so the scrollbar is inside the window.
  assert.match(windowCss, /\.manage-root \{[\s\S]{0,2000}position: fixed;[\s\S]{0,200}overflow: hidden;/);
  assert.match(windowCss, /\.manage-root \.gw-pane \{[\s\S]{0,400}overflow-y: auto/);
  // Nothing in the chrome sticks, because nothing under it moves. (A settings
  // group's margin note does stick beside its rows; that is content in the
  // scrolling pane.)
  for (const block of ["\\.gw-bar", "\\.gw-foot", "\\.gw-side"]) {
    const rule = new RegExp(`\n${block} \\{([^}]*)\\}`).exec(windowCss);
    assert.ok(rule, `${block} should exist`);
    assert.doesNotMatch(rule[1], /position: sticky/);
  }

  // The one search covers the whole product rather than two fields each
  // covering half of it.
  assert.match(shell, /extra=\{paletteRows\}/);
  assert.doesNotMatch(shell, /gw-search|gw-jump/);

  // Light mode is designed rather than left over, and it is paper rather than
  // cold grey: the same beige family the landing page uses.
  assert.match(css, /:root\[data-theme="light"\] \.manage-root \{[^}]*--manage-panel: #fdf8f2/);
  assert.doesNotMatch(css, /--manage-panel: #ffffff/);

  const toggle = await source("src/components/Manage/theme-toggle.tsx");
  assert.match(toggle, /function themeApplies/);
  assert.match(toggle, /pathname\.startsWith\("\/manage"\)/);
  assert.doesNotMatch(css, /^html:root \.manage-root/m);
  assert.doesNotMatch(css, /^:root \.manage-root/m);
});

test("a tab change is not a page change, and gets no loading screen", async () => {
  const shell = await source("src/components/Manage/manage-shell.tsx");

  // Changing tab swaps a panel inside an open page: no loading screen over the
  // viewport.
  assert.doesNotMatch(shell, /<SiteLoader/);
  assert.doesNotMatch(shell, /<RouteLoading/);
  assert.doesNotMatch(shell, /COVER_AT_MS/);
  // The settings arriving a moment after the shell is a panel filling in, so it
  // gets a placeholder rather than a screen.
  assert.match(shell, /\{loading \? \(/);
});

test("the server picker shows what each server actually is", async () => {
  const mutual = await source("src/utils/mutual-servers.ts");
  const card = await source("src/components/server-card.tsx");
  const types = await source("src/types/discord.ts");

  /* Cards use the server's banner, else Discord's invite splash, else a plain
     band of the same size and shape, so every card is the same shape. */
  assert.match(types, /banner\?: string \| null;/);
  assert.match(mutual, /banner: partialGuild\.banner \?\? null/);
  assert.match(mutual, /splash: partialGuild\.splash \?\? null/);
  // Adding fields to the payload has to invalidate the cache, or a stored
  // entry keeps serving cards with no artwork for as long as it lives.
  assert.match(mutual, /servers_and_mutuals:v5/);
  assert.match(card, /bannerUrl \|\| splashUrl/);

  // The card has no copy button: the id row took a third of a small card.
  assert.doesNotMatch(card, /navigator\.clipboard/);

  /* One count under the name: how many members the server has. */
  assert.match(card, /memberCount === 1 \? "member" : "members"/);
  assert.match(card, /className="sv-sub"/);
  assert.doesNotMatch(card, /moduleCount === 1 \? "module" : "modules"/);
});

test("copying an invite either lands or says it did not", async () => {
  const helper = await source("src/utils/copy-to-clipboard.ts");
  const panel = await source("src/components/owner-panel.tsx");

  // `navigator.clipboard?.writeText(x)` hides a missing API and a rejection, so
  // the panel could say "copied" while the clipboard still held something else.
  // The shared copy helper reports the real outcome.
  assert.doesNotMatch(panel, /navigator\.clipboard\?\.writeText/);
  assert.match(panel, /const copied = await copyToClipboard\(json\.invite\)/);
  assert.match(panel, /blocked the copy/);
  assert.match(helper, /execCommand\("copy"\)/);
  assert.match(helper, /Promise<boolean>/);

  // The bot names the guild it built the invite for, and the panel refuses to
  // copy anything that does not belong to the row that was clicked.
  assert.match(panel, /madeFor !== server\.id/);
  assert.match(panel, /Nothing was copied/);
});

test("an application page will not advance until it is answered", async () => {
  const form = await source("src/components/application-form.tsx");

  // Google Forms says what the asterisks mean; this form did not.
  assert.match(form, /Indicates required question/);
  assert.match(form, /const pageHasRequired/);

  // Next checks the current page first, so a page cannot be skipped empty and
  // only surface errors on submit.
  assert.match(form, /const currentPageIssues/);
  assert.match(form, /if \(currentPageIssues\.length\) \{\s*\n\s*setShowIssues\(true\);/);
  assert.match(form, /to fix on this page/);

  // Both rules had a description but no check, so out-of-range numbers and
  // under-length essays passed validation.
  assert.match(form, /case "number_range": \{/);
  assert.match(form, /case "minimum_words": \{/);
});

test("the save mark is a cloud, not a floppy disk", async () => {
  const icon = await source("src/components/Manage/save-cloud-icon.tsx");
  const bar = await source("src/components/Manage/save-bar.tsx");
  const tickets = await source("src/components/Manage/sections/tickets.tsx");

  // A 3.5" diskette is a picture of hardware, and it says "write to this
  // machine" when the write goes to a server.
  assert.doesNotMatch(bar, /IconDeviceFloppy/);
  assert.doesNotMatch(tickets, /IconDeviceFloppy/);
  // The prompt says it in words: no mark at all on its buttons, and no dot.
  assert.doesNotMatch(bar, /SaveCloudIcon|IconRotate|gw-save-dot/);
  assert.match(bar, /\{saving \? "Saving" : "Save"\}/);

  // Inlined rather than imported from an icon package: the save bar can appear
  // on the first interaction with a page, so it should not wait on a chunk.
  assert.match(icon, /const CLOUD =/);
  assert.doesNotMatch(icon, /@tabler\/icons-react/);
  assert.match(icon, /state === "saved"/);
});

test("the account menu opens on the first tap", async () => {
  const menu = await source("src/components/user-menu.tsx");

  // Hover opening is guarded: a touch browser fires mouseenter before click, so
  // the menu opened and the click shut it again.
  assert.doesNotMatch(menu, /onMouseEnter=\{openOnHover \? openMenu : undefined\}/);
  assert.doesNotMatch(menu, /onMouseEnter=\{openMenu\}/);
  assert.match(menu, /event\.pointerType === "mouse"/);
});

test("ticket questions can say what kind of answer they want", async () => {
  const tickets = await source("src/components/Manage/sections/tickets.tsx");

  // The bot already read min and max off every question; there was nowhere in
  // the editor to set them, and no way to ask for a paragraph.
  assert.match(tickets, /style\?: "short" \| "paragraph";/);
  assert.match(tickets, /label: "Paragraph"/);
  assert.match(tickets, /placeholder="Min length"/);
  assert.match(tickets, /placeholder="Max length"/);
  // Switching to a short answer must not leave a 4000 max behind; the clamp
  // moved into the kind picker when Paragraph became one of its options.
  assert.match(tickets, /Math\.min\(question\.max, 1000\)/);
  assert.match(tickets, /Minimum is above the maximum/);
});

test("the owner panel fits a phone", async () => {
  const panel = await source("src/components/owner-panel.tsx");
  const css = await source("src/app/owner/owner.css");

  /* On a phone the row is the control and the actions live in what it opens,
     two by two at the foot of the card; a single row of five buttons overflowed
     at 390px. */
  assert.ok(!/sm:flex-row sm:flex-wrap sm:items-center/.test(panel), "the old row is back");
  assert.match(css, /@media \(max-width: 640px\)[\s\S]{0,700}\.owner-acts > \* \{\s*flex: 1 1 calc\(50% - 4px\)/);
  // And the two page-level actions share the width rather than overflowing it.
  assert.match(css, /\.owner-head-actions \{\s*width: 100%;\s*\}\s*\.owner-head-actions > \* \{\s*flex: 1/);

  /* A name long enough to need it gets an ellipsis rather than pushing the
     caret off the end. */
  assert.match(css, /\.owner-name > span:first-child \{[\s\S]{0,140}text-overflow: ellipsis/);
});

test("the dashboard reuses data instead of refetching on every visit", async () => {
  const context = await source("src/components/Manage/manage-context.tsx");
  const meta = await source("src/app/api/manage/[id]/meta/route.ts");

  // Coming back to /manage reuses fresh meta and config already on screen
  // instead of refetching both.
  assert.match(context, /isFresh\(metaUrl\) && isFresh\(configUrl\)/);
  // `force` is the retry flag: a first attempt reads through the cache, and a
  // Try again after a failure has to go past it.
  assert.match(context, /cachedJson<GuildMeta>\(metaUrl, \{ force: attempt > 0 \}\)/);
  // A write must drop the reads, or the user sees the value they just replaced.
  assert.match(context, /invalidateCache\(`\/api\/manage\/\$\{guildId\}`\)/);
  // An explicit refresh cannot be answered from cache.
  assert.match(context, /force: true/);

  // dashboard_meta is cached per user, because the payload carries that user's
  // permissions.
  const cacheKeys = await source("src/utils/manage-cache.ts");
  assert.match(cacheKeys, /manage:meta:v2:\$\{guildId\}:\$\{generation\}:\$\{userId\}/);
  // Keyed by guild, user and generation — and by whether the member list was
  // asked for, since that is now opt-in.
  assert.match(meta, /manageMetaKey\(\s*id,\s*session\.user\.id,\s*await readManageGeneration\(id\),\s*withMembers,\s*\)/);
  assert.match(meta, /const withMembers = new URL\(request\.url\)\.searchParams\.has\("members"\)/);
  assert.match(meta, /if \(response\.ok\)/);
  assert.match(meta, /searchParams\.has\("refresh"\)/);

  // The config document is cached too.
  const config = await source("src/app/api/manage/[id]/config/route.ts");
  assert.match(config, /manageConfigKey\(id, session\.user\.id, generation\)/);
  assert.match(config, /if \(response\.ok\)/);
  assert.match(config, /searchParams\.has\("refresh"\)/);

  // Both are cached per user, so a write bumps a shared generation in the key,
  // retiring everyone's copy at once. It is shared because `meta` carries
  // module state stored in the config document.
  assert.match(cacheKeys, /export function invalidateManageCache/);
  // Attached to the one function every write already goes through, rather than
  // to each of the sixty routes that would otherwise have to remember.
  const api = await source("src/utils/manage-api.ts");
  assert.match(api, /await invalidateManageCache\(String\(guildId\)\)/);
});

test("ticket questions can be any component a modal supports", async () => {
  const tickets = await source("src/components/Manage/sections/tickets.tsx");

  // Ticket form questions can be dropdowns, checkboxes and read-only text, as
  // Discord modals allow.
  assert.match(tickets, /kind\?: "text" \| "select" \| "checkbox" \| "display";/);
  assert.match(tickets, /label: "Dropdown"/);
  assert.match(tickets, /label: "Checkbox"/);
  assert.match(tickets, /label: "Text block"/);
  // Paragraph is a style on a text question, not a fifth kind — the bot knows
  // four, so the picker maps its own option back onto them.
  assert.match(tickets, /if \(next === "paragraph-kind"\)/);
  // A dropdown needs its options, and says so when it has none.
  assert.match(tickets, /Add option/);
  assert.match(tickets, /A dropdown with no options cannot be shown/);
  assert.match(tickets, /placeholder="Min picks"/);
});

test("headers do not crush their description into one word per line", async () => {
  const header = await source("src/components/Manage/section-header.tsx");
  const tickets = await source("src/components/Manage/sections/tickets.tsx");

  // The description has a 16rem floor; as a bare flex item beside a wide button
  // it could shrink to its longest word.
  assert.match(header, /<div className="min-w-\[16rem\] flex-1">/);
  assert.match(header, /actions \? <div className="gw-hero-acts shrink-0">\{actions\}<\/div> : null/);
  assert.doesNotMatch(tickets, /className="flex items-center justify-between">\s*\n\s*<div>/);
  // The Tickets groups put their heading and action in a panel header, which
  // wraps before the words crush.
  const css = await source("src/components/Manage/manage-window.css");
  assert.match(tickets, /<TicketGroup/);
  assert.match(css, /\.gw-tk \.gw-set-head \{\s*flex-wrap: wrap;/);
  assert.match(css, /\.gw-tk \.gw-set-head-copy \{\s*flex: 1 1 16rem;/);
});

test("server cards do not stamp ADMIN on artwork", async () => {
  const card = await source("src/components/server-card.tsx");

  // Every card in the picker is a server this account can already manage — the
  // grid does not show the others — so the badge said nothing.
  assert.doesNotMatch(card, /servers-server-access/);
  assert.doesNotMatch(card, /\{access\}/);
});

test("a module is on or off by one definition, shared by every reader", async () => {
  const status = await source("src/components/Manage/module-status.ts");
  const shell = await source("src/components/Manage/manage-shell.tsx");
  const gate = await source("src/components/Manage/module-gate.tsx");
  const modules = await source("src/components/Manage/sections/modules.tsx");
  const overview = await source("src/components/Manage/sections/overview.tsx");

  // A missing module key means disabled, as in the bot
  // (`bool(modules.get(key))`). The sidebar used to treat missing as enabled
  // and lit tabs the bot had off.
  assert.doesNotMatch(shell, /Modules\.\$\{item\.moduleKey\}`\) !== false/);
  assert.match(shell, /isModuleEnabled\(value, item\.moduleKey\)/);

  // One definition of "module enabled", shared by every reader.
  assert.match(status, /export function isModuleEnabled/);
  assert.match(gate, /isModuleEnabled\(value, moduleKey\)/);
  assert.match(modules, /return isModuleEnabled\(value, key\)/);
  assert.match(overview, /<ModuleToggleGrid/);
  assert.doesNotMatch(
    overview,
    /Modules\./,
    "overview must not grow its own module-state read back",
  );

  // Staff's legacy aliases still count, and only in the shared helper.
  assert.match(status, /STAFF_MODULE_ALIASES/);
  assert.doesNotMatch(gate, /STAFF_MODULE_ALIASES/);
});

test("a variable shared by several features is not labelled as one feature's", async () => {
  const registry = await source("src/config/variable-registry.ts");
  const editor = await source("src/components/Manage/embed-editor.tsx");

  // `{reason}` is a shared variable (tickets, infractions, promotions,
  // suggestions), so the picker does not label it as tickets-only.
  assert.match(registry, /"shared" \| "module"/);
  assert.match(registry, /\.\.\.G\("Shared", "shared", \{/);
  assert.match(registry, /"\{reason\}": "The reason given/);
  assert.doesNotMatch(
    registry,
    /\.\.\.G\("Ticket", "module", \{\n\s*"\{ticket\.id\}": "Ticket ID",\n\s*"\{reason\}"/,
  );
  // Moving it to "global" would have been equally wrong, so the chip has a
  // third state rather than a forced choice between two.
  assert.match(editor, /"Shared"/);
  assert.match(editor, /Provided by more than one feature/);
});

test("the manage window and top bar have one shape, not one per theme", async () => {
  const css = await source("src/components/Manage/manage-restyle.css");

  // Geometry is not themed; only colour is. Shape rules sit outside the
  // dark-theme selector so light mode gets the same shape.
  assert.match(css, /\n  \.manage-root \.manage-window \{/);
  assert.doesNotMatch(css, /:root:not\(\[data-theme="light"\]\) \.manage-root \.manage-window \{/);

  // Flush right: globals' drop shadow drew a dark strip down the free edge.
  assert.match(css, /box-shadow: none !important;/);

  // The server switcher uses the panel token in both themes.
  assert.match(css, /\.manage-root \.server-switcher \{[\s\S]*?background: var\(--manage-panel\) !important;/);
});

test("GatorAI is a module like the others", async () => {
  const status = await source("src/components/Manage/module-status.ts");
  const schema = await source("src/components/Manage/schema.ts");
  const nav = await source("src/components/Manage/nav-groups.tsx");

  assert.match(nav, /id: "ai", label: "GatorAI".*moduleKey: "GatorAI"/);
  assert.match(schema, /\{ key: "GatorAI", label: "GatorAI"/);

  // It predates the Modules map and carries its own enabled flag, so "missing
  // means off" would read as disabled in every server already using it.
  assert.match(status, /moduleKey === "GatorAI"/);
  assert.match(status, /value\("GatorAI\.enabled"\) !== false/);
});

test("manage controls are one system, driven by theme tokens", async () => {
  const css = await source("src/components/Manage/manage-restyle.css");

  // Controls use the `--manage-*` tokens both palettes define, so fields are
  // right in either theme (fields.tsx hard-codes dark values).
  assert.match(css, /--manage-control-h:/);
  assert.match(css, /background: var\(--manage-control\) !important;/);
  assert.match(css, /color: var\(--manage-text\) !important;/);
  assert.match(css, /:root\[data-theme="light"\] \.manage-root \{\n\s*--manage-text: #2a1d14;/);

  // Heights ran h-8/h-9/h-10 and radii rounded-md/lg/xl/2xl/full inside one
  // file. One height, one radius.
  assert.match(css, /min-height: var\(--manage-control-h\);/);
  assert.match(css, /border-radius: var\(--manage-radius-control\) !important;/);

  // A visible 3px focus ring, not a 1px border tint.
  assert.match(css, /:focus-visible[\s\S]*?box-shadow: 0 0 0 3px/);
  assert.match(css, /\.manage-root button:focus-visible/);

  // One motion pair; the dashboard had 160/220/240/300/400ms side by side.
  assert.match(css, /--manage-motion: 170ms;/);
  assert.match(css, /prefers-reduced-motion/);

  // A 36px control is small under a thumb.
  assert.match(css, /@media \(pointer: coarse\)[\s\S]*?--manage-control-h: 2\.75rem;/);
});

test("lists inside the window are not given invisible scrollbars", async () => {
  const css = await source("src/components/Manage/manage-restyle.css");
  /* The restyle hid every list's thumb until `data-scrolling` was set, which
     only the rail ever did: the lists in a tab had no scrollbar at all. */
  assert.doesNotMatch(css, /--manage-scroll-thumb/);
  assert.doesNotMatch(css, /scrollbar-color: transparent transparent/);
});

test("the dashboard has one empty state, not sixteen", async () => {
  // One shared empty state for every list on /manage, which is most of what a
  // new admin sees. Hand-written copies had drifted in spacing, mark size and
  // copy.
  const files = [
    "src/components/Manage/sections/tickets.tsx",
    "src/components/Manage/sections/auto-response.tsx",
    "src/components/Manage/sections/connection-roles.tsx",
    "src/components/Manage/sections/custom-commands.tsx",
    "src/components/Manage/sections/resources.tsx",
    "src/components/Manage/sections/audit.tsx",
  ];

  for (const file of files) {
    const code = await source(file);
    // Matches the duplicated layout (a centred column with the gator mark), not
    // the asset, which avatars and error pages also use.
    assert.doesNotMatch(
      code,
      /flex flex-col items-center[^"]*text-center[\s\S]{0,200}gator-logo\.png/,
      `${file} hand-rolls an empty state`,
    );
    assert.match(code, /<EmptyState/, `${file} has no empty state at all`);
  }

  const component = await source("src/components/Manage/empty-state.tsx");
  // The action belongs inside the state that is asking for it.
  assert.match(component, /action\?: React\.ReactNode/);
});

test("a lone card does not stretch across a three-column grid", async () => {
  const css = await source("src/components/Manage/manage-restyle.css");

  // No `:only-child` full-span rule: in the three-column module grid it
  // stretched single-module categories to the full width. Size is the loudest
  // thing a grid says.
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(rules, /\.grid\s*>\s*:only-child/);
});

test("overview feature cards use direct configure and enable actions", async () => {
  const modules = await source("src/components/Manage/sections/modules.tsx");
  const fields = await source("src/components/Manage/fields.tsx");
  const applications = await source("src/components/Manage/application-editor.tsx");

  assert.match(modules, /<Toggle[\s\S]*checked=\{enabled\}[\s\S]*onChange=\{onToggle\}/);
  // The card is the switch (`role="switch"`), and settings is the cog.
  assert.match(modules, /role="switch"\s*\n\s*aria-checked=\{enabled\}\s*\n\s*aria-label=\{module\.label\}\s*\n\s*className="gw-mod-toggle"/);
  assert.match(modules, /className="gw-mod-cog"/);
  assert.match(modules, /<IconSettings size=\{18\}/);
  assert.doesNotMatch(modules, /className="gw-mod-power"|className="gw-mod-open"|className="gw-mod-go"/);
  assert.doesNotMatch(modules, /\{enabled \? "Running"|className="gw-mod-lamp"/);
  // The state is a fill that sweeps across the card, and under a pointer the
  // card says what a press would do, in two words.
  assert.match(modules, /className="gw-mod-fill"/);
  assert.match(modules, /\{enabled \? "Turn off" : "Turn on"\}/);
  // And no icon sits in a box: the mark alone beside the name.
  assert.match(modules, /className="gw-mod-head"/);
  assert.doesNotMatch(modules, /<Toggle[\s\S]{0,200}gw-mod/);
  assert.doesNotMatch(modules, /overview-feature-disable|overview-feature-enable/);

  // Every module has its own glyph; none share the fallback.
  const glyphs = [...modules.matchAll(/^  [\w"' ]+: <(Icon\w+) size=\{20\} \/>,$/gm)].map(
    (match) => match[1],
  );
  assert.ok(glyphs.length >= 25, `only ${glyphs.length} modules carry a glyph`);
  assert.equal(new Set(glyphs).size, glyphs.length, "two modules share a glyph");
  assert.match(applications, /<Toggle/);
  assert.match(fields, /h-7 w-12/);
  assert.match(fields, /checked \? "translate-x-5" : "translate-x-0"/);

});

test("the overview leads directly with dense grouped feature cards", async () => {
  const overview = await source("src/components/Manage/sections/overview.tsx");
  const css = await source("src/components/Manage/manage-restyle.css");

  assert.doesNotMatch(overview, /overview-status|OverviewStat/);
  assert.doesNotMatch(overview, /HeroStat|DoodleMark|overview-hero/);
  const windowCss = await source("src/components/Manage/manage-window.css");
  assert.match(
    windowCss,
    /\.manage-root \.gw-mods \{[\s\S]{0,200}grid-template-columns: repeat\(auto-fill/,
  );
  // The column count comes from one interpolating number: one card across a
  // phone up to four across a wide desktop, with no breakpoints.
  assert.match(windowCss, /--gw-card: clamp\(\d+px, [\d.]+vw, \d+px\)/);
  // The module's own mark, large and nearly invisible behind the card, as on
  // the landing's module wall.
  assert.match(windowCss, /\.gw-mod-ghost \{/);
});

test("the variable picker only calls a variable global if it is", async () => {
  const registry = await source("src/config/variable-registry.ts");

  // The Global group lists only variables the bot resolves in every message
  // (`global_message_vars`: author, guild, channel and time, plus member/server
  // synonyms). Module-specific aliases belong to their module, since the badge
  // tells an admin where a token works. The bot's
  // tests/test_variable_documentation.py checks the other direction.
  const globalBlock = registry.slice(
    registry.indexOf('...G("Global", "global", {'),
    registry.indexOf("}),", registry.indexOf('...G("Global", "global", {')),
  );
  const keys = [...globalBlock.matchAll(/"(\{[^"]+\})"/g)].map((m) => m[1]);

  assert.ok(keys.length > 0, "Global group not found");
  for (const key of keys) {
    assert.match(
      key,
      /^\{(author|guild|channel|time|member|server)\./,
      `${key} is badged global and is not produced by global_message_vars`,
    );
  }

  // The demoted ones are still offered, under a scope that is true.
  assert.match(registry, /\{user\.mention\}[^\n]*Invoking user mention/);
  assert.match(registry, /"\{opener\.mention\}": "Ticket opener mention"/);

  // `member.` and `server.` resolve to their `author.` and `guild.` entries,
  // the bot's synonym rule, so a variable is described the same way under
  // either name.
  assert.match(registry, /const SYNONYM_PREFIXES: \[string, string\]\[\]/);
  assert.match(registry, /VARIABLE_REGISTRY\[canonicalVariable\(key\)\]/);
});

test("a textarea config can offer the variables it resolves", async () => {
  const schema = await source("src/components/Manage/schema.ts");
  const section = await source("src/components/Manage/schema-section.tsx");

  // Welcome's message variables come from the picker's declared list, not a
  // sentence in the description, so the names cannot drift from the resolver.
  assert.doesNotMatch(schema, /\{user\.mention\}/);
  assert.match(schema, /variables\?: string\[\]/);

  // Welcome uses the full message editor, whose variables are a declared list
  // (the list the resolver is tested against).
  assert.match(schema, /path: "Welcome\.message"/);
  assert.match(schema, /"\{member\.mention\}"/);
  assert.match(schema, /content: "Welcome \{member\.mention\} to \*\*\{server\.name\}\*\*!"/);

  // And plain textarea fields still get the picker, which is what was missing.
  assert.match(section, /<VariableChips variables=\{field\.variables\}/);
});

test("a header row with a button gives way before the words do", async () => {
  const tickets = await source("src/components/Manage/sections/tickets.tsx");
  const css = await source("src/components/Manage/manage-window.css");

  // Every Tickets group goes through one header that wraps, so on a phone the
  // action drops under the words instead of the text collapsing to its longest
  // word.
  const groups = [...tickets.matchAll(/<TicketGroup\b/g)];
  assert.ok(groups.length >= 3, "expected the Subjects/Panels/AI groups");
  assert.match(css, /\.gw-tk \.gw-set-head \{\s*flex-wrap: wrap;/);
  // The one hand-drawn heading row left, over a subject's form questions.
  assert.match(css, /\.gw-tk-sub-head \{[\s\S]*?justify-content: space-between;/);
});


test("floating panels are opaque, in both themes", async () => {
  const css = await source("src/components/Manage/manage-restyle.css");

  // The tokens are declared on `:root` too: Radix portals popovers to the body,
  // outside `.manage-root`, and an unresolvable `var()` invalidates the whole
  // declaration (here an `!important` background), which made every floating
  // panel transparent.
  assert.match(css, /^:root,\n\.manage-root \{/m);
  assert.match(css, /^:root\[data-theme="light"\],\n:root\[data-theme="light"\] \.manage-root \{/m);

  // And the rule that paints them carries a literal fallback, so a future
  // token rename degrades to a dark panel rather than to nothing.
  assert.match(css, /background: var\(--manage-control, #101010\) !important/);
});

test("the dashboard's cards are the colour the palette says they are", async () => {
  const css = await source("src/components/Manage/manage-restyle.css");
  const globals = await source("src/app/globals.css");

  // Cards use `--manage-panel`: globals.css paints `.glass-panel,
  // .feature-card, .editor-panel` with `--gator-surface` `!important`, which
  // this file has to override.
  assert.match(globals, /--gator-surface: #121212/);

  const rule = css.slice(css.indexOf(".manage-root :is(\n    .glass-panel,"));
  const body = rule.slice(0, rule.indexOf("}") + 1);
  assert.ok(body.length > 0, "the panel rule is missing");
  assert.match(body, /background: var\(--manage-panel\) !important/);
  // The raw hexes the editors use (`bg-[#121212]`, `bg-[#131415]`) map to the
  // token too, so no surface can disagree with the palette.
  assert.match(body, /\.bg-\\\[\\#121212\\\]/);
});

test("a department on the parent server still gets the parent's channels", async () => {
  const workspace = await source("src/components/Manage/department-workspace.tsx");

  // The channel and role pickers ask the same question as the linked-server
  // card ("did we resolve a linked server?") and fall back to the parent server
  // otherwise. Asking "does the profile carry a guild id?" instead gave a
  // Connected card with empty pickers for a department pointing at the parent
  // or at an unreachable server.
  assert.doesNotMatch(workspace, /const hasLinkedServer/);
  assert.match(
    workspace,
    /const departmentChannels = linkedServer\?\.channels \|\| meta\?\.channels \|\| \[\];/,
  );
  assert.match(
    workspace,
    /const departmentRoles = linkedServer\?\.roles \|\| meta\?\.roles \|\| \[\];/,
  );
});


test("a roster column can name the ranks allowed to edit it", async () => {
  const workspace = await source("src/components/Manage/department-workspace.tsx");

  // Roster columns are restricted by department rank, not Discord role: ranks
  // are what the rest of the page uses.
  assert.match(workspace, /const rankRoleOptions: ManagedRole\[\] = ranks\.map/);
  assert.match(workspace, /roles=\{rankRoleOptions\}/);

  // The viewer's rank comes from the unfiltered roster, so searching for
  // someone else cannot change what you may edit.
  assert.match(workspace, /const viewerRankId[\s\S]{0,160}roster\?\.memberRows/);

  // No ranks named means anyone who can already edit the roster. Administrators
  // are never locked out.
  assert.match(workspace, /if \(!allowed\.length \|\| can\(\)\) return true;/);

  // The gate applies to the cells, not just the settings screen.
  assert.match(workspace, /const canEdit = canEditColumn\(column\);/);
  assert.doesNotMatch(workspace, /disabled=\{!canMembers\}[\s\S]{0,200}saveCell/);
});

test("the department portal knows what server it is attached to", async () => {
  const portal = await source("src/components/department-member-workspace.tsx");

  // In the portal the department payload carries the parent server's roles and
  // channels (the dashboard gets them from dashboard_meta), so a department
  // without its own server still has a linked-server card and filled pickers.
  // Comments are stripped because the note above quotes the string this
  // forbids.
  const code = portal
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /meta: null/);
  assert.match(portal, /roles: data\.parentRoles \|\| \[\]/);
  assert.match(portal, /channels: data\.parentChannels \|\| \[\]/);
  assert.match(portal, /parentChannels\?: any\[\]/);
});

test("a department application is reviewed the same way a server one is", async () => {
  const responses = await source("src/components/Manage/sections/resources.tsx");
  const editor = await source("src/components/Manage/application-editor.tsx");

  // Approve and Deny exist in the department portal too, through a route gated
  // on the department's own permissions, so a department application has the
  // same review workflow everywhere.
  assert.doesNotMatch(responses, /const canDecide = !endpoint;/);
  assert.match(responses, /const canDecide = !endpoint \|\| Boolean\(decisionEndpoint\);/);

  // And the decision goes wherever the caller says, rather than always at the
  // Manage Server route.
  assert.match(responses, /const res = await fetch\(decisionUrl, \{/);
  assert.match(editor, /decisionEndpoint=\{[\s\S]{0,120}applicationdecision/);
});

test("a bad option cannot take the whole application down", async () => {
  const form = await source("src/components/form-question-field.tsx");

  // Question options go through one normaliser: a null option used to throw
  // inside `.map` and unmount the whole application form mid-answer. Nulls and
  // blanks are dropped, plain strings coerced, and a non-array yields none.
  assert.match(form, /export function formQuestionOptions\(/);
  // Comments stripped: the note above quotes the exact expression it forbids,
  // which is a fine way to write an assertion that can never pass.
  const code = form
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /\(q\.options \|\| \[\]\)\.map/);

  // The three renderers — dropdown, radio/checkbox, image selection.
  const uses = form.match(/formQuestionOptions\(q\)/g) || [];
  assert.ok(
    uses.length >= 3,
    `only ${uses.length} option renderers normalised`,
  );

  // A stored question is not a trustworthy object, so the guard is on the
  // shape rather than on any one bad value.
  assert.match(form, /if \(!Array\.isArray\(raw\)\) return \[\];/);
  assert.match(form, /if \(entry === null \|\| entry === undefined\) return;/);
});

test("a sidebar tab says how many of its settings need fixing", async () => {
  const shell = await source("src/components/Manage/manage-shell.tsx");
  const audit = await source("src/components/Manage/config-audit.ts");

  // Settings that point at a channel or role Discord no longer has: amber,
  // with a count.
  assert.match(shell, /const broken = auditByTab\[item\.id\]\?\.gone \?\? 0;/);
  assert.match(shell, /className="gw-row-badge"/);
  assert.match(shell, /data-warn="true"/);
  /* A module just turned on has no channel picked yet. That is the next step
     of setting it up, not a fault: "Set up" on its card and "N to set up" in
     the strip, in words, and no warning anywhere. (An unlabelled dot on the
     tab read as a glitch.) */
  assert.doesNotMatch(shell, /gw-row-todo/);
  assert.match(shell, /`\$\{items\.length\} to set up`/);
  assert.match(audit, /tag: "Pick a channel",/);
  const modules = await source("src/components/Manage/sections/modules.tsx");
  assert.match(modules, /data-setup=\{enabled && !problems && setup \? "true" : undefined\}/);
  assert.match(modules, /className="gw-mod-cog-say"/);
});

test("ticket dropdown descriptions are configured beside the open control", async () => {
  const tickets = await source("src/components/Manage/sections/tickets.tsx");
  const subjectName = tickets.indexOf('aria-label="Subject name"');
  const openButton = tickets.indexOf(">The button on the panel</p>");
  const dropdownDescription = tickets.indexOf('title="Dropdown description"');

  assert.ok(subjectName >= 0, "the subject name row is missing");
  assert.ok(openButton > subjectName, "the open control should follow the subject identity");
  assert.ok(
    dropdownDescription > openButton,
    "the dropdown description should live with the open control",
  );
  assert.doesNotMatch(tickets, /title="Name and description"/);
  // The one text field, with its count inside it rather than a caption.
  assert.match(tickets, /aria-label="Dropdown description"\s*\n\s*className="gw-field w-full"/);
});


test("the department member portal loads one tab at a time", async () => {
  const portal = await source("src/components/department-member-workspace.tsx");
  const route = await source(
    "src/app/api/departments/[parentId]/[departmentId]/route.ts",
  );

  assert.match(portal, /\?include=\$\{encodeURIComponent\(tab\)\}/);
  assert.match(portal, /TAB_PAYLOAD_FIELDS/);
  assert.match(portal, /loadedTabs\.current\.has\(activeTab\)/);
  assert.match(portal, /onTabChange=\{\(tab\) =>/);
  assert.match(route, /searchParams\.get\("include"\)/);
  assert.match(route, /include,/);
});

test("the window's bar is zones, not things centred in space", async () => {
  const shell = await source("src/components/Manage/manage-shell.tsx");
  const windowCss = await source("src/components/Manage/manage-window.css");

  // The bar follows the Finder: the open server on the leading edge, the tools
  // on the trailing edge, and a spacer between.
  assert.match(shell, /<div className="gw-zone">/);
  assert.match(shell, /<div className="gw-zone" data-grow="true" \/>/);
  assert.match(windowCss, /\.gw-zone\[data-grow="true"\] \{\s*flex: 1;/);
  assert.doesNotMatch(shell, /topbar-start|topbar-end|topbar-nav/);
});

test("an avatar that will not load shows a person, not a hole", async () => {
  const avatar = await source("src/components/user-avatar.tsx");
  const member = await source("src/components/Manage/member-avatar.tsx");
  const helper = await source("src/utils/discord-avatar.ts");

  // An avatar always has a fallback: Radix hides the image until it loads and
  // drops it on error, so without one a failed avatar (often a GIF) was an
  // empty circle. Comments are stripped because this note names the component
  // it forbids.
  const avatarCode = avatar
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(avatarCode, /AvatarImage/);
  /* The failure is recorded as which src failed, not a boolean reset by an
     effect (refs run before effects, so the reset undid the check for cached
     images). */
  assert.match(avatarCode, /onError=\{\(\) => setBroken\(src\)\}/);
  assert.match(avatarCode, /onLoad=\{\(\) => setShown\(src\)\}/);

  // A member list handles the bot's null and a URL that 404s (a stale avatar
  // hash) with the same fallback, never the browser's broken-image glyph.
  assert.match(member, /if \(!showing \|\| attempt > 1\) \{/);
  assert.match(member, /onError=\{\(\) => setAttempt/);

  // An avatar hash beginning a_ is animated and the CDN only serves it as a
  // .gif; asking for .png returns nothing.
  assert.match(helper, /hash\.startsWith\("a_"\)/);
  assert.match(helper, /\.replace\(\/\\\.\[a-z0-9\]\+\$\/i, "\.gif"\)/);
});

test("a department action can be opened from its row", async () => {
  const workspace = await source("src/components/Manage/department-workspace.tsx");

  // Each action row has an edit control, not only a bin.
  assert.match(workspace, /setActionEditingId\(action\.id\)/);
  assert.match(workspace, /editing=\{Boolean\(actionEditingId\)\}/);
  assert.match(workspace, /editing \? "Edit action" : "Create action"/);
  assert.match(workspace, /editing \? "Save changes" : "Create"/);
});

test("a membership request opens in place, with its buttons inside", async () => {
  const workspace = await source("src/components/Manage/department-workspace.tsx");
  const code = workspace
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  // Accept and Deny live in the expanded application, after the answers, not on
  // the row beside a "View" modal.
  assert.doesNotMatch(code, /setViewRequest/);
  assert.match(code, /setExpandedRequest\(expanded \? null : String\(request\.id\)\)/);
  assert.match(code, /aria-expanded=\{expanded\}/);
  // The chevron says it opens before you click it.
  assert.match(code, /IconChevronDown[\s\S]{0,220}rotate-180/);
});

test("the tab badge is styled wherever the workspace is mounted", async () => {
  const globals = await source("src/app/globals.css");
  const restyle = await source("src/components/Manage/manage-restyle.css");

  // `.sidebar-badge` is global: the department workspace also mounts in the
  // member portal, outside `.manage-root`.
  assert.match(globals, /^\.sidebar-badge \{/m);
  const rules = restyle.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(rules, /\.manage-root \.sidebar-badge \{/);
});

test("the roster becomes cards on a phone instead of a 720px sideways pan", async () => {
  const restyle = await source("src/components/Manage/manage-restyle.css");
  const workspace = await source(
    "src/components/Manage/department-workspace.tsx",
  );
  const rules = restyle.replace(/\/\*[\s\S]*?\*\//g, "");

  // The roster sets `gridTemplateColumns` inline so header and rows share
  // tracks; the phone `.grid` rule (`!important`) must not override it.
  assert.match(
    rules,
    /\.manage-content \.grid \{\s*grid-template-columns: minmax\(0, 1fr\) !important/,
  );
  // Laying the row out with flex is what takes it out of that rule's reach —
  // `grid-template-columns` does not apply to a flex container.
  assert.match(rules, /\.manage-content \.roster-row \{[^}]*display: flex/);
  // And it must beat Tailwind's `min-w-[720px]`, or the card still pans.
  assert.match(rules, /\.manage-content \.roster-row \{[^}]*min-width: 0/);
  // On a phone only the column captions are hidden; the header's second cell is
  // the rank itself.
  assert.doesNotMatch(
    rules,
    /\.manage-content \.roster-head \{\s*display: none/,
  );
  assert.match(rules, /\.manage-content \.roster-head \{[^}]*display: flex/);
  assert.match(
    rules,
    /\.manage-content \.roster-head > \[data-roster-caption\] \{\s*display: none/,
  );
  // Every caption cell must actually carry the attribute, or it stays on
  // screen with nothing to line up against.
  assert.equal(
    (workspace.match(/data-roster-caption/g) || []).length,
    5,
    "Activity, Member Since, Points, the custom columns and the trailing cell",
  );

  // The hidden header's captions move onto the chips.
  assert.match(
    rules,
    /\[data-roster-cell\]\[data-label\]::before \{\s*content: attr\(data-label\)/,
  );
  // The row menu is the last column, so without `order` it wrapped to the
  // bottom of the card and read as part of whatever chip it landed beside.
  assert.match(rules, /\.roster-actions \{\s*order: 2/);

  // Chips take their colours from the theme tokens; the light theme is beige
  // paper, where a white-alpha chip is invisible.
  const chip = rules.match(
    /\.manage-content \.roster-row > \[data-roster-cell\] \{[^}]*\}/,
  );
  assert.ok(chip, "the roster chip rule should exist");
  assert.match(chip[0], /background: var\(--manage-panel\)/);
  assert.doesNotMatch(chip[0], /rgba\(255, 255, 255/);

  // The markup the CSS depends on. The row's class list is a template literal,
  // so these are matched as bare class names.
  for (const hook of [
    "roster-row",
    "roster-head",
    "roster-identity",
    "roster-actions",
  ])
    assert.match(
      workspace,
      new RegExp(`\\b${hook}\\b`),
      `${hook} should be in the markup`,
    );
  assert.match(workspace, /data-label="Activity"/);
  assert.match(workspace, /data-label="Member since"/);
  // An <input> cannot render ::before, so it says what it is via placeholder.
  assert.match(workspace, /placeholder=\{column\.name\}/);
});

test("avatars are normalised everywhere, so animated ones are not asked for as png", async () => {
  // A Discord avatar hash starting `a_` is animated and the CDN serves it only
  // as .gif. Every avatar goes through `discordAvatarUrl`, which handles that.
  const files = [
    "src/components/Manage/department-workspace.tsx",
    "src/components/Manage/sections/resources.tsx",
    "src/components/Manage/sections/audit.tsx",
    "src/components/Manage/version-history.tsx",
    "src/components/Manage/department-document-editor.tsx",
    "src/app/p/[serverId]/[departmentId]/public-client.tsx",
  ];
  for (const file of files) {
    const text = await source(file);
    assert.match(
      text,
      /from "@\/utils\/discord-avatar"/,
      `${file} should import the normaliser`,
    );
    const code = text
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    // No Discord avatar reaches an `<img>` unnormalised. Only `<img>` tags are
    // checked: MemberAvatar takes a raw value and normalises it itself, and
    // Roblox headshots are a different CDN.
    const unnormalised = (code.match(/<img\b[\s\S]{0,400}?\/>/g) || []).filter(
      (tag) => {
        const src = /src=\{([^}]*)\}/.exec(tag);
        return (
          src &&
          /avatar/i.test(src[1]) &&
          !/discordAvatarUrl/.test(src[1]) &&
          !/roblox/i.test(src[1])
        );
      },
    );
    assert.deepEqual(
      unnormalised,
      [],
      `${file} still passes a raw avatar to <img src>`,
    );
  }

  // The roster renders through MemberAvatar, which also draws a disc when the
  // bot could not resolve the member at all.
  const workspace = await source(
    "src/components/Manage/department-workspace.tsx",
  );
  assert.match(
    workspace,
    /roster-identity[\s\S]{0,400}<MemberAvatar\s+src=\{member\.avatar\}/,
  );
});

test("the servers hero annotation is underlined, not crossed out", async () => {
  const css = await source("src/app/servers/servers.css");

  // The hero's label and rule sit clear of each other; the rotated rule used to
  // cross the label like a strikethrough.
  const before = /\.servers-hero::before \{([^}]*)\}/.exec(css);
  const after = /\.servers-hero::after \{([^}]*)\}/.exec(css);
  assert.ok(before && after, "the hero annotation rules should exist");

  const rem = (block: string, prop: string) => {
    const hit = new RegExp(`${prop}:\\s*([\\d.]+)rem`).exec(block);
    return hit ? Number(hit[1]) * 16 : NaN;
  };
  const labelTop = rem(after[1], "top");
  const ruleTop = rem(before[1], "top");
  const angle = Math.abs(
    Number(/rotate\((-?[\d.]+)deg\)/.exec(before[1])?.[1] ?? "0"),
  );
  const width = Number(/min\(([\d.]+)rem/.exec(before[1])?.[1] ?? "0") * 16;

  // Half the width times tan(angle) is how far the rotation lifts each end.
  const swing = (width * Math.tan((angle * Math.PI) / 180)) / 2;
  const labelBottom = labelTop + 15; // 0.76rem type, with its line box
  assert.ok(
    ruleTop - swing > labelBottom,
    `the rule reaches y=${(ruleTop - swing).toFixed(1)} but the label ends at ` +
      `y=${labelBottom.toFixed(1)} — it crosses the text`,
  );
});

test("no page paints its own button over the one it is using", async () => {
  const css = await source("src/app/servers/servers.css");
  const account = await source("src/app/account/account.css");

  /* No custom button classes on top of `RippleButton`: piled-up styles overrode
     its radius, padding, hover and press, so those buttons had no ripple. */
  for (const dead of [
    "servers-paper-button",
    "servers-outline-button",
    "servers-more-button",
    "servers-dialog-submit",
  ]) {
    assert.ok(
      !new RegExp(`(^|[,\\s])\\.${dead}\\b(?![\\w-])[^{,]*\\{`, "m").test(css),
      `${dead} is styling a RippleButton again`,
    );
  }

  // What is left of them is layout, which is the only thing a page should be
  // telling a button.
  assert.match(css, /\.servers-cta-wide \{\s*width: 100%/);

  // The kebab keeps its size and nothing else.
  const kebab = css.slice(css.indexOf(".servers-department-menu-button,"));
  assert.match(kebab, /width: 30px/);
  assert.ok(!/\.servers-department-menu-button:hover/.test(css), "the kebab grew a sixth hover");

  // Same rule on the account page: it had one of these too.
  assert.doesNotMatch(account, /\.account-ghost-button/);
});

test("every control before /manage ripples", async () => {
  /* These used to be raw buttons; they are `RippleButton`s now. */
  for (const file of [
    "src/components/owner-panel.tsx",
    "src/components/roblox-account-card.tsx",
  ]) {
    const code = await source(file);
    /* One exemption: the owner panel's card is a disclosure row (the whole row
       opens what is under it), like a folder on the landing. A ripple belongs
       to something you press, not something you open. */
    const controls = code.replace(/<button\s+type="button"\s+className="owner-row"[\s\S]*?>/g, "");
    assert.ok(
      !/<button[\s>]/.test(controls),
      `${file} still hand-rolls a button`,
    );
    assert.match(code, /<RippleButton/);
    assert.match(code, /<RippleButtonRipples \/>/);
  }
});

test("a member can leave a department from /servers", async () => {
  const content = await source("src/components/servers-content.tsx");

  // Members can leave a roster themselves (`membership_leave`, which the bot
  // already accepts).
  assert.match(content, /action: "membership_leave"/);
  assert.match(content, /departmentaction/);
  // It is destructive and has no undo, so it arms before it fires.
  assert.match(content, /confirmLeave \? \(/);
  assert.match(content, /setConfirmLeave\(true\)/);
  // And the card disappears without a page reload.
  assert.match(content, /onLeft\(department\)/);
  assert.match(content, /onLeft=\{\(left\) =>/);
});

test("a control's target is bigger than its paint", async () => {
  const windowCss = await source("src/components/Manage/manage-window.css");

  // Every isolated control carries an invisible collar: the last few pixels of
  // a 32px button are where the misses are.
  assert.match(windowCss, /\.gw-icon::after,[\s\S]{0,400}inset: -4px;/);

  // Two details, both checked in a browser.
  //
  // `z-index: -1` put the collar under the control's own background, and hit
  // testing walks paint order from the top, so the collar caught nothing.
  const collar = /\.gw-icon::after,([\s\S]{0,500}?)\}/.exec(windowCss);
  assert.ok(collar, "the collar rule should exist");
  assert.doesNotMatch(collar[1], /z-index/);

  // A collar wider than half the gap to the next control would fight its
  // neighbour for the pixels between them. The bar's gap is 8, so the collar is
  // 4.
  assert.match(windowCss, /\.gw-zone \{\s*gap: var\(--u2\);/);
});

test("focus is drawn, not merely declared", async () => {
  const windowCss = await source("src/components/Manage/manage-window.css");
  const restyle = await source("src/components/Manage/manage-restyle.css");

  // manage-restyle sets `outline: none !important` on every button, link and
  // switch in the shell, so a focus ring must also be declared `!important` to
  // paint.
  assert.match(restyle, /outline: none !important/);
  assert.match(
    windowCss,
    /:root \.manage-root :is\(button[\s\S]{0,260}outline: 2px solid var\(--g-accent\) !important/,
  );
});

test("numerals in a column line up", async () => {
  const windowCss = await source("src/components/Manage/manage-window.css");

  // Tabular figures, so a column of counts lines up and a ticking number does
  // not shift what follows it.
  assert.match(windowCss, /font-variant-numeric: tabular-nums/);
  for (const target of ["\\.gw-count", "\\.gw-row-badge", "\\.gw-pane table"]) {
    assert.match(windowCss, new RegExp(target));
  }
});

test("a settings group you set once arrives shut", async () => {
  const section = await source("src/components/Manage/schema-section.tsx");

  // Advanced groups (webhook identity, privacy and the like) start closed, so a
  // tab opens on what people came for. Matched on the title, which is what the
  // schema carries.
  assert.match(section, /const ADVANCED =/);
  for (const word of ["webhook", "privacy", "advanced"]) {
    assert.match(section, new RegExp(`ADVANCED =[\\s\\S]{0,160}${word}`, "i"));
  }
  assert.match(section, /useState\(\s*\(\) => !ADVANCED\.test\(group\.title \|\| ""\),?\s*\)/);
  // And the control that opens it says how much is inside.
  assert.match(section, /className="gw-set-count"/);
  assert.match(section, /aria-expanded=\{open\}/);
});

test("the rail is one tab stop, walked with the arrows", async () => {
  const shell = await source("src/components/Manage/manage-shell.tsx");

  // Thirty-five tab stops between the bar and the pane is a keyboard user
  // pressing Tab thirty-five times to get past a sidebar.
  assert.match(shell, /tabIndex=\{current \? 0 : -1\}/);
  assert.match(shell, /const keys = \["ArrowDown", "ArrowUp", "Home", "End"\];/);
  // And the sheet can be left from the keyboard it can be opened from.
  assert.match(shell, /if \(event\.key === "Escape"\) onClose\(\);/);
  assert.match(shell, /aria-modal="true"/);
});

test("a press in the gap between a control and its panel is not outside it", async () => {
  const safe = await source("src/components/Manage/safe-area.ts");
  const picker = await source("src/components/Manage/server-picker.tsx");
  const shell = await source("src/components/Manage/manage-shell.tsx");

  // A press in the gap between a control and the panel it opened does not close
  // it (the safe triangle).
  assert.match(safe, /export function useSafeOutsidePress/);
  assert.match(safe, /function inside\(p: Point, a: Point, b: Point, c: Point\)/);
  assert.match(safe, /function nearCorners\(panel: DOMRect, from: Point\)/);
  assert.match(picker, /useSafeOutsidePress\(/);
  assert.match(shell, /useSafeOutsidePress\(/);
  // The old handler is gone from both.
  assert.doesNotMatch(picker, /!.*\.contains\(event\.target/);
  assert.doesNotMatch(shell, /!box\.current\.contains/);
});

test("tooltips are a group with one delay, not eleven on hair triggers", async () => {
  const tip = await source("src/components/Manage/hover-tip.tsx");

  // The window's bar holds five icon buttons eight pixels apart; sweeping it
  // fired five tooltips in half a second.
  assert.match(tip, /const OPEN = \d+;/);
  assert.match(tip, /const SKIP = \d+;/);
  assert.match(tip, /let groupLeftAt = 0;/);
  assert.match(tip, /Date\.now\(\) - groupLeftAt < SKIP/);
});

test("the wall has a density control and no decoration nobody can see", async () => {
  const modules = await source("src/components/Manage/sections/modules.tsx");
  const shell = await source("src/components/Manage/manage-shell.tsx");
  const windowCss = await source("src/components/Manage/manage-window.css");

  // Twenty-five cards is five screens, and the question you arrive with is
  // usually about one half of them.
  assert.match(modules, /className="gw-filter"/);
  assert.match(modules, /"all" \| "on" \| "off"/);
  assert.match(windowCss, /\.gw-filter-n \{[\s\S]{0,120}tabular-nums/);

  // And the landing's dot field is not behind a window that fills the screen:
  // several thousand dots repainted on every pointer move, for an 8–20px frame.
  assert.doesNotMatch(shell, /DotField/);
  // (`.gw-field` is the text field; the dot field was a positioned layer.)
  assert.doesNotMatch(windowCss, /\.gw-field \{[^}]*position: (absolute|fixed)/);
});

test("the window's measurements come from a scale, not from taste", async () => {
  const windowCss = await source("src/components/Manage/manage-window.css");

  // Spacing comes from a 4px scale (`--u1` to `--u8`), not hand-picked lengths.
  for (const token of ["--u1: 4px", "--u2: 8px", "--u4: 16px", "--u8: 32px"]) {
    assert.match(windowCss, new RegExp(token.replace("--", "--")));
  }
  assert.match(windowCss, /--t-body: 13\.5px/);
  assert.match(windowCss, /--r-window: 16px/);
  assert.match(windowCss, /--r-card: 12px/);

  // Declared on `:root` as well as the shell, because the picker, the palette
  // and every Radix menu are portalled to the body, and an unresolvable `var()`
  // invalidates the whole declaration.
  assert.match(windowCss, /:root,\n\.manage-root \{\n  \/\* The 4px base/);

  // A finger gets 44.
  assert.match(
    windowCss,
    /@media \(pointer: coarse\)[\s\S]{0,400}\.gw-icon,[\s\S]{0,80}width: 44px/,
  );

  // On a phone the window is the whole screen: a 16px frame round a working
  // surface on a 390px viewport is 8% of the width spent on a margin.
  assert.match(
    windowCss,
    /@media \(max-width: 900px\) \{\s*:root,\s*\.manage-root \{[\s\S]{0,160}--gw-side: 0px/,
  );
});

test("an avatar that fails to load falls back instead of showing a broken glyph", async () => {
  const avatar = await source("src/components/Manage/member-avatar.tsx");
  const helper = await source("src/utils/discord-avatar.ts");

  // Some avatars are snapshots stored with a record, so a member who changed
  // their picture leaves a hash the CDN no longer serves: a 404 on a
  // well-formed URL, handled by `onError`.
  assert.match(avatar, /onError=\{\(\) => setAttempt\(\(current\) => current \+ 1\)\}/);
  // Second attempt: drop `size` and force .gif, the only form an animated
  // avatar is served in.
  assert.match(avatar, /retry\.search = "";/);
  assert.match(avatar, /\.replace\(\/\\\.\[a-z0-9\]\+\$\/i, "\.gif"\)/);
  assert.match(avatar, /if \(!showing \|\| attempt > 1\)/);
  // A recycled row must not inherit the previous member's failure.
  assert.match(avatar, /useEffect\(\(\) => \{\s*setAttempt\(0\);\s*\}, \[url\]\)/);
  // A picture still missing can be read off the element rather than guessed at.
  assert.match(avatar, /data-avatar-error=\{url \|\| undefined\}/);

  // And a URL with no extension at all had nothing for `replace` to act on, so
  // it fell through the animated branch unchanged and 404'd.
  assert.match(helper, /extension\s*\?\s*parsed\.pathname\.replace/);
  assert.match(helper, /: `\$\{parsed\.pathname\}\.gif`/);
});

test("dragging a member says where it will land", async () => {
  const workspace = await source("src/components/Manage/department-workspace.tsx");
  const globals = await source("src/app/globals.css");

  // The row being dragged and the drop position are both shown, not only a tint
  // on the whole rank box.
  assert.match(workspace, /const \[dragMemberId, setDragMemberId\]/);
  assert.match(workspace, /engageDrag\(member\.id, event\.clientX, event\.clientY\)/);
  // The dragged row is lifted in our own styling and follows the pointer,
  // instead of the browser's translucent screenshot of the row.
  assert.match(workspace, /pointer-events-none relative z-30 rounded-xl/);
  assert.match(workspace, /transform: `translateY\(\$\{/);
  // The hovered rank grows a labelled landing line...
  assert.match(workspace, /roster-drop-hint/);
  assert.match(workspace, /Move to \{rank\.name\}/);
  // ...but not when the row is already in that rank, so a drag that changes
  // nothing does not promise that it will.
  assert.match(workspace, /!rankMembers\.some\(\(row\) => row\.id === dragMemberId\)/);
  // A ghost row, not an insertion rule: this is a table of rows, so the thing
  // that says "one more of these goes here" is the shape of a row.
  assert.match(globals, /\.roster-drop-hint \{[^}]*border: 1px dashed/);
  assert.doesNotMatch(globals, /\.roster-drop-line/);
  assert.doesNotMatch(workspace, /roster-drop-label/);
  // The dot is the rank's own colour, the same one its header uses.
  assert.match(workspace, /backgroundColor: rank\.color \|\| "#f7a8c4"/);
});

test("GatorAI can be switched off from its own page", async () => {
  const ai = await source("src/components/Manage/sections/gator-ai.tsx");
  const restyle = await source("src/components/Manage/manage-restyle.css");

  // GatorAI is written by hand, so it adds the module toggle and gate itself
  // (schema tabs get them from SchemaSection via `section.moduleKey`).
  assert.match(ai, /import \{ ModuleGate, PluginToggleButton \} from "\.\.\/module-gate"/);
  assert.match(ai, /actions=\{<PluginToggleButton moduleKey="GatorAI"/);
  // With the module off, the gate covers the settings.
  assert.match(ai, /<ModuleGate\s+moduleKey="GatorAI"/);

  // The three dials are drawn alike, as the window's one switcher, told to a
  // screen reader as a choice rather than as tabs.
  void restyle;
  assert.equal((ai.match(/<Dial\b/g) || []).length, 3);
  assert.match(ai, /<Segments\s+kind="choice"/);
  const segments = await source("src/components/Manage/segments.tsx");
  assert.match(segments, /role=\{choice \? "radiogroup" : "tablist"\}/);
  assert.match(segments, /aria-checked=\{choice \? on : undefined\}/);
});

test("the responses tab leads with its count, in the server's accent", async () => {
  const responses = await source("src/components/Manage/sections/resources.tsx");
  const globals = await source("src/app/globals.css");

  // The tab opens on a header with the submission count, above the list.
  assert.match(responses, /responses-header-count/);
  assert.match(responses, /\{total\} \{total === 1 \? "Response" : "Responses"\}/);
  assert.doesNotMatch(responses, /mb-4 inline-flex rounded-xl border border-white\/\[0\.08\]/);

  // Four states of one control, not four loose buttons.
  assert.match(responses, /role="tablist"/);
  assert.match(responses, /aria-selected=\{statusFilter === t\.id\}/);
  assert.match(globals, /\.responses-status \{[^}]*border: 1px solid/);

  // Colours come from the accent the server has set, never a fixed hue.
  const rule = /\.responses-header-rule \{([^}]*)\}/.exec(globals);
  assert.ok(rule, "the accent rule should exist");
  assert.match(rule[1], /var\(--gator-accent/);
  const selected = /\.responses-status-tab\[aria-selected="true"\] \{([^}]*)\}/.exec(globals);
  assert.ok(selected, "the selected tab rule should exist");
  assert.match(selected[1], /var\(--gator-accent/);
  // No hardcoded blue: the reference is another product's accent, not ours.
  assert.doesNotMatch(globals, /\.responses-status-tab[^}]*#[0-9a-f]{0,2}(3b82f6|1d9bf0|0b84ff)/i);
});

test("the application editor's tabs are centred under the header", async () => {
  const editor = await source("src/components/Manage/application-editor.tsx");
  const globals = await source("src/app/globals.css");

  // The application tabs have their own row under the header.
  assert.match(editor, /className="application-tabs-row"/);
  assert.match(editor, /role="tablist"/);
  assert.match(editor, /aria-selected=\{tab === option\}/);
  assert.match(globals, /\.application-tabs-row \{[^}]*justify-content: center/);
  // "form" is the internal id; the tab reads Questions.
  assert.match(editor, /option === "form" \? "Questions" : option/);
});

test("the application editor survives the light theme", async () => {
  const page = await source("src/app/manage/[id]/applications/[appId]/page.tsx");
  const editor = await source("src/components/Manage/application-editor.tsx");
  const globals = await source("src/app/globals.css");

  // The page uses `manage-root` (which declares the `--manage-*` tokens), not a
  // hard-coded `bg-[#0a0a0a]` that stays dark in light mode. Comments are
  // stripped because both files mention the colour they replaced.
  const strip = (text: string) =>
    text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.match(page, /className="manage-root min-h-screen"/);
  assert.doesNotMatch(strip(page), /bg-\[#0a0a0a\]/);
  assert.doesNotMatch(strip(editor), /bg-\[#0a0a0a\]/);
  assert.match(globals, /\.application-editor-shell \{[^}]*background: var\(--manage-tab/);
  assert.match(globals, /\.application-editor-header \{[^}]*var\(--manage-tab/);
});

test("an application is shared the way a document is", async () => {
  const editor = await source("src/components/Manage/application-editor.tsx");

  // Applications use the same access manager as documents and spreadsheets, so
  // you can say who a form is for.
  assert.match(editor, /import \{ ShareAccessPanel \} from "\.\/share-access-panel"/);
  assert.match(editor, /<ShareAccessPanel[\s\S]{0,240}kindLabel="application"/);
  assert.match(editor, /resource=\{app\}/);
  // The copy-link popover and its outside-click wiring are gone.
  assert.doesNotMatch(editor, /Anyone with the link can view and submit/);
  assert.doesNotMatch(editor, /shareRef/);
});

test("a submission says who applied, not just their display name", async () => {
  const responses = await source("src/components/Manage/sections/resources.tsx");
  const globals = await source("src/app/globals.css");

  // The submission header shows who the applicant is (account age and more),
  // not only a name and an id.
  assert.match(responses, /function SubmissionIdentity/);
  assert.match(responses, /<SubmissionIdentity response=\{chosen\} \/>/);
  // Account age comes out of the snowflake, so it costs no round trip.
  assert.match(responses, /function snowflakeCreatedAt/);
  assert.match(responses, /1420070400000/);
  // Whether they are even in the server, which decides if roles can apply.
  assert.match(responses, /Not a member of this server/);
  assert.match(globals, /\.submission-flag \{/);
  assert.match(globals, /\.submission-facts \{/);
  // And it is a card: the applicant is the subject of the page, not a couple
  // of grey lines above the answers.
  const identity = /\.submission-identity \{([^}]*)\}/.exec(globals);
  assert.ok(identity, "the identity rule should exist");
  assert.match(identity[1], /border: 1px solid/);
  assert.match(identity[1], /background: var\(--manage-panel/);
});

test("a decided submission shows who decided it and why", async () => {
  const responses = await source("src/components/Manage/sections/resources.tsx");
  const bot = await botSource("utils/dashboard_api.py");
  const globals = await source("src/app/globals.css");

  // The payload carries the reviewer, so the page can say who decided.
  assert.match(bot, /def _reviewer_row/);
  assert.match(bot, /"reviewer": _reviewer_row/);
  assert.match(responses, /function SubmissionDecision/);
  assert.match(responses, /Reviewed by/);
  assert.match(globals, /\.submission-decision \{[^}]*grid-template-columns/);
});

test("staging holds a decision instead of firing it", async () => {
  const applications = await botSource("Cogs/Modules/applications.py");
  const bot = await botSource("utils/dashboard_api.py");
  const responses = await source("src/components/Manage/sections/resources.tsx");

  // "Stage responses for review" is wired up: staged decisions are stored as
  // `staged_*` statuses until released.
  assert.match(applications, /STAGED_STATUSES = \{"approved": "staged_approved", "rejected": "staged_denied"\}/);
  assert.match(applications, /if stage and status in STAGEABLE_STATUSES/);
  // A held decision returns before any of the acting-on-it happens.
  assert.match(applications, /"staged": True/);
  // Publishing replays each one through the ordinary path.
  assert.match(bot, /async def POST_dashboard_application_publish_staged/);
  assert.match(bot, /stage=False/);

  // The UI: a fourth state, a switch that flips a held verdict, and one
  // button that releases them all.
  assert.match(responses, /type SubmissionState = "pending" \| "staging"/);
  assert.match(responses, /const stagedVerdict/);
  assert.match(responses, /Publish \{counts\.staging\} staged/);
  assert.match(responses, /applicationpublishstaged/);
  // Staging is only offered when the application actually uses it.
  assert.match(responses, /stagingEnabled \|\| counts\.staging/);
});

test("the decision DMs are editors, not two small boxes", async () => {
  const editor = await source("src/components/Manage/application-editor.tsx");
  const globals = await source("src/app/globals.css");

  // The decision message gets its own card, with variables and a preview.
  assert.match(editor, /function DecisionMessageCard/);
  assert.match(editor, /<DecisionMessageCard[\s\S]{0,200}tone="approved"/);
  assert.match(editor, /<DecisionMessageCard[\s\S]{0,200}tone="denied"/);
  assert.match(editor, /aria-expanded=\{open\}/);
  // A real message editor, the same builder every other configured message
  // uses.
  assert.match(editor, /<MessageObjectEditor/);
  assert.match(editor, /variables=\{DECISION_VARIABLES\}/);
  assert.match(editor, /const DECISION_VARIABLES/);
  // Strings already stored keep working; they are read as the content of an
  // otherwise empty message rather than migrated.
  assert.match(editor, /function asMessageObject/);
  assert.match(globals, /\.decision-message-card \{/);
});

test("shared things have short links, and the old ones still resolve", async () => {
  const helper = await source("src/utils/short-links.ts");
  const legacyApp = await source("src/app/application/[guildId]/[appId]/page.tsx");
  const legacyDoc = await source("src/app/docs/shared/[serverId]/[resourceId]/page.tsx");

  // Application links use the application's id, so renaming one does not break
  // its link and two with the same name do not collide.
  assert.match(helper, /export function formLink/);
  assert.match(helper, /return `\/form\/\$\{encodeShortId\(guildId, appId\)\}`/);
  assert.match(helper, /export function resourceLink/);
  assert.match(helper, /return `\/\$\{kind\}\/\$\{encodeShortId\(guildId, resourceId\)\}`/);
  assert.match(helper, /`\/d\/\$\{kind\}\/\$\{encodeShortId\(guildId, departmentId, resourceId\)\}`/);

  // Base36 ids, not base64 text, so the short link is actually short.
  assert.match(helper, /BigInt\(value\)\.toString\(36\)/);
  assert.doesNotMatch(helper, /toBase64Url/);
  // `-` separates the parts, so no part may contain one. The escape for a
  // hyphen cannot use `%`: the router decodes route params before the page sees
  // them, and `%2D` came back as a hyphen and split every uuid.
  assert.doesNotMatch(helper, /\.replace\(\/-\/g, "%2D"\)/);
  assert.doesNotMatch(helper, /encodeURIComponent/);
  assert.match(helper, /byte\.toString\(16\)\.padStart\(2, "0"\)/);
  // Nothing that is not ours decodes, and arity is part of the check — a
  // two-part slug must not satisfy a three-part route.
  assert.match(helper, /if \(tokens\.length === expected\) return unpackAll\(tokens\);/);
  assert.match(helper, /parts\.some\(\(part\) => part === null \|\| part === ""\)/);
  // Links minted under the old escape are still in Discord messages, so their
  // hyphens are put back together rather than rejected.
  assert.match(helper, /function decodeLegacy/);

  // Old links keep working through a temporary redirect. A 308 is cached by the
  // browser, so a mistake in its target could never be corrected for anyone who
  // had followed it.
  assert.match(legacyApp, /[^t]redirect\(formLink\(/);
  assert.match(legacyDoc, /[^t]redirect\(resourceLink\("document"/);
  assert.doesNotMatch(legacyApp, /permanentRedirect\(/);
  assert.doesNotMatch(legacyDoc, /permanentRedirect\(/);
});

test("the share panel asks one question, in our own words", async () => {
  const panel = await source("src/components/Manage/share-access-panel.tsx");
  const editor = await source("src/components/Manage/application-editor.tsx");
  const globals = await source("src/app/globals.css");

  // "Melonly" is a competitor's name for our own roles.
  assert.doesNotMatch(panel, /melonly|Melonly/);
  assert.match(panel, /entry\.type === "gator" \? "Gator role"/);

  // Access is who can open this. Each grant keeps a viewer/editor picker (a
  // grant without a role means nothing); general access has its own one picker,
  // not a second one beside restricted/link.
  const strip = (text: string) =>
    text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  // Two pickers: one for what a named grant may do, one for general access.
  // Both are wide enough to read their values.
  assert.equal(
    (strip(panel).match(/\{ value: "editor", label: "Editor" \}/g) || [])
      .length,
    2,
  );
  assert.match(panel, /updateEntry\(entry\.id, \{\s*permission:/);
  // Plain utilities, not custom classes, which did not reach the dialog.
  assert.equal(
    (panel.match(/className="w-\[8\.5rem\] shrink-0"/g) || []).length,
    2,
  );
  assert.match(panel, /className="min-w-\[12rem\] flex-1"/);

  // A grant can only name someone who exists; typing used to create
  // `user:<whatever was typed>`.
  assert.doesNotMatch(panel, /addTypedPerson/);
  assert.match(panel, /Nobody and no role matches/);
  assert.match(panel, /Array\.isArray\(body\.members\)/);

  // "Department members" is only offered where a department owns the thing.
  assert.match(panel, /scope === "department"\s*\?\s*\[\{ value: "department"/);
  assert.match(panel, /scope\?: "server" \| "department";/);

  // And the application share opens in the middle of the screen.
  assert.match(
    editor,
    /fixed inset-0 z-\[240\] flex items-center justify-center/,
  );
});

test("the spreadsheet saves what you typed, not what it received", async () => {
  const sheet = await source("src/components/Manage/department-spreadsheet-editor.tsx");

  // Only local edits mark the sheet dirty. Univer's CommandExecuted also fires
  // for remote ops replayed by the poll, and treating those as local made two
  // editors save each other's changes forever.
  assert.match(sheet, /const isLocalEdit = \(event\?: any\) => \{/);
  assert.match(sheet, /if \(applyingRemote\.current\) return false;/);
  assert.match(sheet, /return event\.type === MUTATION && !event\?\.options\?\.fromCollab;/);
  // The guard must see the event; calling sync() bare defeated it.
  assert.match(sheet, /relay\(event\);\s*sync\(event\);/);

  // Idle-coalesced rather than per frame: a burst of keystrokes is one edit.
  assert.match(sheet, /if \(saveTimer\.current\) clearTimeout\(saveTimer\.current\);/);
  assert.match(sheet, /\}, 700\);/);
  assert.doesNotMatch(sheet, /frame = requestAnimationFrame\(\(\) => \{/);

  // The remote flag stays set for the frame the replayed commands land in,
  // until the deferred save has checked it.
  assert.match(sheet, /await new Promise\(\(resolve\) => requestAnimationFrame\(resolve\)\);\s*applyingRemote\.current = false;/);
});

test("a submitted answer is drawn by the form that asked it", async () => {
  const responses = await source(
    "src/components/Manage/sections/resources.tsx",
  );
  const globals = await source("src/app/globals.css");
  const restyle = await source("src/components/Manage/manage-restyle.css");

  // Submissions render with FormQuestionCard, the same component as the public
  // form, so the record looks like the form.
  assert.match(
    responses,
    /import \{ FormQuestionCard \} from "@\/components\/form-question-field"/,
  );
  assert.match(responses, /function SubmittedAnswer/);
  assert.match(
    responses,
    /<FormQuestionCard[\s\S]{0,200}value=\{answer\}[\s\S]{0,140}disabled/,
  );

  // The card draws the question itself, so the panel must not print it a
  // second time above.
  assert.doesNotMatch(responses, /submitted-answer-question/);
  assert.match(globals, /\.submitted-answer-meta \{/);

  // The plain renderer remains for answers whose question no longer exists.
  assert.match(responses, /renderSubmittedAnswer\(undefined, answer\)/);

  // A record reads at full strength; it is inert, not greyed out.
  assert.match(
    globals,
    /\.submitted-answer :disabled \{[^}]*opacity: 1 !important/,
  );

  // The dashboard's blanket control rules skip it: three rules repaint every
  // control under `.manage-root` or `.manage-content` with `!important`, so the
  // wrapper carries `data-bare` and each rule excludes it, subtree included.
  assert.match(responses, /className="submitted-answer" data-bare=""/);
  // Only rules that sweep up every control — the ones whose selector names
  // `input` — not a panel that happens to share the token.
  const blanket =
    restyle.match(
      /^[.:][^{}]*\binput\b[^{}]*\{[^{}]*background: var\(--manage-control\) !important/gm,
    ) || [];
  assert.ok(
    blanket.length >= 2,
    `only ${blanket.length} blanket control rules found`,
  );
  for (const rule of blanket) {
    assert.match(
      rule,
      /:not\(\[data-bare\]\):not\(\[data-bare\] \*\)/,
      `a blanket control rule still repaints bare fields:\n${rule}`,
    );
  }
});

test("the responses list keeps itself current and can be searched", async () => {
  const responses = await source("src/components/Manage/sections/resources.tsx");
  const globals = await source("src/app/globals.css");

  // No Copy link (the Share dialog does that) and no Refresh button (the list
  // polls).
  assert.doesNotMatch(responses, /Copy response link/);
  assert.doesNotMatch(responses, /onClick=\{load\}[\s\S]{0,200}Refresh/);

  // Polling pauses while the tab is hidden and while a decision is in flight,
  // so a refresh cannot swap the list under a click.
  assert.match(responses, /if \(!document\.hidden && !busy\) void load\(\);/);
  assert.match(responses, /deciding !== null \|\| bulkBusy \|\| selected\.size > 0/);
  assert.match(responses, /addEventListener\("visibilitychange", onVisible\)/);

  // Search covers who wrote it and what they wrote.
  assert.match(responses, /placeholder="Search submissions"/);
  assert.match(responses, /Object\.values\(response\.answers \|\| \{\}\)/);
  assert.match(globals, /\.responses-search \{/);
});

test("an application can post its results to a channel", async () => {
  const editor = await source("src/components/Manage/application-editor.tsx");

  // Results can be posted to a channel for the staff team. Off by default.
  assert.match(editor, /label="Post results to a channel"/);
  assert.match(editor, /checked=\{Boolean\(app\.results_channel_enabled\)\}/);
  assert.match(editor, /app\.results_channel_enabled \?[\s\S]{0,400}<ChannelPicker/);

  // Automatic grading sits with quiz mode, because with quiz mode off there is
  // nothing to grade and the toggle read as permanently on and inert.
  assert.match(editor, /app\.quiz_mode \?[\s\S]{0,400}label="Automatic grading"/);
});

test("the share picker shows faces, and a grant keeps the one it was given", async () => {
  const panel = await source("src/components/Manage/share-access-panel.tsx");

  // Results and grants show the member's own avatar.
  assert.match(panel, /import \{ MemberAvatar \} from "\.\/member-avatar"/);
  assert.match(
    panel,
    /option\.type === "user" \?[\s\S]{0,220}<MemberAvatar[\s\S]{0,120}src=\{option\.avatar\}/,
  );
  assert.match(
    panel,
    /entry\.type === "user" \?[\s\S]{0,220}<MemberAvatar[\s\S]{0,120}src=\{entry\.avatar\}/,
  );
  // The picture rides along on the grant, so the row does not have to look it
  // up again after the picker has closed.
  assert.match(panel, /avatar\?: string \| null;/);
  assert.match(panel, /avatar: option\.avatar \|\| null,/);
  // The handle disambiguates two people wearing the same nickname.
  assert.match(panel, /@\{option\.handle\}/);
});

test("the submission reads as a column of cards, not a card of cards", async () => {
  const responses = await source("src/components/Manage/sections/resources.tsx");
  const globals = await source("src/app/globals.css");

  // The detail panel has no border of its own, so the answer cards are not
  // nested two deep.
  assert.match(responses, /className=\{`submission-detail /);
  assert.match(globals, /\.submission-detail \{[^}]*flex-direction: column/);

  // The form does not number its questions, so neither does its record.
  assert.doesNotMatch(responses, /submitted-answer-index/);
  // And the status chip repeated the filter tab you are standing in.
  assert.doesNotMatch(responses, /STATUS_STYLES\[chosen\.status\]/);

  // Search opens from an icon rather than spending the header on a bar most
  // visits never touch.
  assert.match(responses, /className="responses-search-toggle"/);
  assert.match(globals, /\.responses-search\[data-open="true"\] \{[^}]*width: min\(22rem/);
});

test("an animated avatar is asked for without a size", async () => {
  const helper = await source("src/utils/discord-avatar.ts");

  // Animated avatars are requested without `size`: Discord's CDN serves the
  // static first frame whenever the URL carries one (discord.py adds
  // `?size=1024`). discord.js does the same.
  assert.match(helper, /if \(animated\) \{\s*parsed\.searchParams\.delete\("size"\);/);
  // Static avatars keep theirs; for them it is bandwidth saved.
  assert.match(helper, /\} else if \(!parsed\.searchParams\.has\("size"\)\) \{/);
});

test("button flows expose every action, button availability, and the shared colour picker", async () => {
  const flowBuilder = await source("src/components/Manage/container-flow-builder.tsx");
  const messageDesign = await source("src/components/Manage/message-design.tsx");

  // One shared picker for blocks and actions: a portal-backed popover that
  // avoids the editor and viewport edges, with a bounded scroll area and a
  // search field.
  const picker = await source("src/components/Manage/picker-popover.tsx");
  const pickerCss = await source("src/components/Manage/manage-restyle.css");
  assert.match(picker, /<Popover open=\{open\} onOpenChange=\{setOpen\}>/);
  assert.match(picker, /collisionPadding=\{12\}/);
  assert.match(pickerCss, /\.gator-picker \{[^}]*max-height: min\(34rem, calc\(100vh - 1\.5rem\)\)/s);
  assert.match(pickerCss, /\.gator-picker \{[^}]*overflow-y: auto/s);
  // Every action still reachable, and now findable by typing rather than by
  // reading every label in a two-column grid.
  assert.match(flowBuilder, /options=\{availableSteps\.map\(/);
  assert.match(picker, /searchThreshold/);
  assert.match(picker, /autoFocus/);
  // Cleared on close, not on open: a menu that reopens mid-search, with most
  // of its options missing, reads as a menu that lost them.
  assert.match(picker, /if \(!open\) setQuery\(""\);/);
  // Both menus use it, so they cannot drift apart again.
  assert.match(messageDesign, /<PickerPopover/);
  assert.match(flowBuilder, /<PickerPopover/);

  // Message buttons and form review buttons expose the bot's disabled flag. The
  // card header is the live preview button, which dims when disabled.
  assert.match(messageDesign, /<PreviewButton button=\{button\} \/>[\s\S]{0,500}patchButton\(\{ disabled: !enabled \}\)/);
  assert.match(messageDesign, /Review button \{index \+ 1\}[\s\S]{0,800}disabled: !enabled/);
  assert.match(messageDesign, /aria-disabled=\{button\.disabled \? "true" : undefined\}/);
  // The switch is an option saying what it is, like every other on/off.
  assert.match(messageDesign, /<OptionCard\s*\n\s*compact\s*\n\s*label="Enabled"\s*\n\s*checked=\{!Boolean\(button\.disabled\)\}/);

  // Form answer-card colours use the product picker rather than asking people
  // to know and type a hexadecimal value.
  assert.match(flowBuilder, /label="Choose answer card colour"/);
  assert.match(messageDesign, /submission_color[\s\S]{0,180}label="Choose answer card colour"/);
  assert.doesNotMatch(flowBuilder, /placeholder="Hex color, e\.g\. 57F287"/);
});

test("a button's colour and type are picked by looking, not by reading", async () => {
  const messageDesign = await source("src/components/Manage/message-design.tsx");

  // Colour is chosen from swatches in Discord's own hexes, not a select of
  // words.
  assert.match(messageDesign, /function ButtonColorSwatches/);
  assert.match(messageDesign, /role="radiogroup" aria-label="Button colour"/);
  assert.match(messageDesign, /<ButtonColorSwatches/);
  // Drawn from the same map the preview draws from, so a swatch cannot show a
  // colour the sent button does not have.
  assert.match(messageDesign, /ROW_COLOR_CLASSES\[option\.value\]/);
  // Selection reads as a ring, not as saturation: four vivid swatches cannot
  // be told apart by which one is brightest.
  assert.match(messageDesign, /ring-2 ring-white\/85/);

  // Type is a menu with a description per option, since "Package" and
  // Form/Application cannot be told apart by name.
  assert.match(messageDesign, /function ButtonTypeMenu/);
  assert.match(messageDesign, /<ButtonTypeMenu/);
  for (const [value, hint] of [
    ["link", /Opens a link/],
    // The ordinary button says what it does, not "Action Flow".
    ["button", /The ordinary button\. Runs the steps you build/],
    ["ticket", /Opens a ticket on one of your panels/],
    ["form", /Pops a modal/],
    ["application", /Starts an application/],
    ["package", /Sells a Roblox item/],
  ] as const) {
    assert.match(
      messageDesign,
      new RegExp(`value: "${value}",[\\s\\S]{0,200}hint: "`),
      `${value} should carry a description`,
    );
    assert.match(messageDesign, hint);
  }

  // Neither control may fall back to the dropdown it replaced.
  assert.doesNotMatch(messageDesign, /options=\{typeOptions\}/);
  assert.doesNotMatch(
    messageDesign,
    /value=\{button\.color \|\| "Grey"\}\s*\n\s*options=\{ROW_BUTTON_COLORS\}/,
  );

  // A review button is an ordinary Discord button with a colour, so it gets
  // the same header and the same swatches rather than its own dialect.
  assert.match(messageDesign, /Review button \{index \+ 1\}[\s\S]{0,400}<PreviewButton/);
  assert.match(messageDesign, /value=\{action\.color \|\| "Grey"\}/);
  assert.doesNotMatch(messageDesign, /options=\{ROW_BUTTON_COLORS\}/);
});

test("a container's accent is one picker, and every colour it offers renders", async () => {
  const messageDesign = await source(
    "src/components/Manage/message-design.tsx",
  );
  const configMessage = await source(
    "src/components/Manage/config-message.tsx",
  );
  const sessions = await source("src/components/Manage/sections/sessions.tsx");
  const commands = await source(
    "src/components/Manage/sections/custom-commands.tsx",
  );
  const workflow = await source(
    "src/components/Manage/workflow/message-value-editor.tsx",
  );

  // One accent control everywhere, offering only colours the bot can resolve.
  // Colours missing from the bot's map used to render silently with no accent.
  assert.match(messageDesign, /export function AccentSwatches/);
  // Built on the dashboard's colour picker, so any colour is reachable
  // (accent_color is an RGB integer).
  assert.match(
    messageDesign,
    /<ColorPicker[\s\S]{0,200}label="Container accent colour"/,
  );
  // And the one thing a general colour picker cannot say.
  assert.match(messageDesign, /aria-checked=\{hex === null\}/);

  // The two message editors set a container's accent on the canvas, where
  // the container is drawn -- with the same shared picker.
  const canvas = await source("src/components/Manage/container-canvas.tsx");
  assert.match(canvas, /<AccentSwatches/);
  for (const [name, file] of [
    ["message-design", messageDesign],
    ["config-message", configMessage],
    ["sessions", sessions],
    ["custom-commands", commands],
    ["workflow", workflow],
  ] as const) {
    assert.match(
      file,
      /<AccentSwatches|<ContainerCanvas/,
      `${name} sets an accent without the shared picker`,
    );
    assert.doesNotMatch(
      file,
      /options=\{V2_COLORS\}/,
      `${name} still uses the old palette`,
    );
    assert.doesNotMatch(
      file,
      /label: "No accent"/,
      `${name} still has an inline palette`,
    );
  }

  // Every colour name the preview can draw must be one the bot resolves
  // (utils/accent_colors.py holds the same table); drift between them fails
  // silently.
  //
  // The table lives in `discord-json.ts`, because the JSON conversion needs it
  // and cannot import message-design without a cycle. `message-design`
  // re-exports it.
  const json = await source("src/components/Manage/discord-json.ts");
  assert.match(
    messageDesign,
    /export const V2_COLOR_HEX = V2_COLOR_HEX_FOR_JSON;/,
    "message-design must still expose the shared table under its own name",
  );
  // Bounded by the declaration's own closing brace, not by whatever is declared
  // next to it.
  const tableStart = json.indexOf("export const V2_COLOR_HEX_FOR_JSON");
  assert.ok(tableStart >= 0, "the shared accent table is gone");
  const table = json.slice(tableStart, json.indexOf("};", tableStart));
  for (const name of [
    "blurple",
    "red",
    "green",
    "yellow",
    "blue",
    "orange",
    "purple",
    "pink",
    "white",
    "black",
    "dark_grey",
    "grey",
  ]) {
    assert.match(
      table,
      new RegExp(`\\b${name}: "#[0-9a-f]{6}"`),
      `${name} has no hex`,
    );
  }
  // Hex is the stored form now, so reading one back has to work.
  assert.match(messageDesign, /\/\^\[0-9a-f\]\{6\}\$\/\.test\(raw\)/);
});

test("a decided submission cannot be decided again", async () => {
  const responses = await source("src/components/Manage/sections/resources.tsx");

  // Bulk approve and deny apply only to pending submissions, like the single
  // buttons; otherwise they would re-run decisions, DMs and roles.
  assert.match(
    responses,
    /const decidableFilter =\s*statusFilter === "pending" \|\| statusFilter === "staging";/,
  );
  assert.match(responses, /canDecide && decidableFilter && selectedOnPage > 0/);
  // And nothing to tick where nothing can be decided.
  assert.match(responses, /\{canDecide && decidableFilter \? \(/);
});

test("the share dialog is styled, roomy, and puts its list away", async () => {
  const editor = await source("src/components/Manage/application-editor.tsx");
  const panel = await source("src/components/Manage/share-access-panel.tsx");
  const restyle = await source("src/components/Manage/manage-restyle.css");

  // The share dialog is styled by its own name: manage-restyle scopes form
  // controls to `.manage-content`, and borrowing that class also brings the
  // shell's `w-full flex-1`.
  assert.match(restyle, /\.application-share-modal input:not\(\[type="checkbox"\]\)/);
  assert.doesNotMatch(editor, /application-share-modal manage-content/);
  assert.match(editor, /max-w-xl/);

  // Choosing somebody closes the list: leaving it open covers the grant that
  // was just added.
  assert.match(panel, /setQuery\(""\);\s*setFocused\(false\);/);
});

test("one + New menu only offers resources that still exist", async () => {
  const menu = await source("src/components/Manage/new-resource-menu.tsx");
  const resources = await source(
    "src/components/Manage/sections/resources.tsx",
  );

  // One "New" menu with every kind, not toolbar buttons that change with the
  // tab.
  assert.doesNotMatch(resources, /New spreadsheet/);
  assert.doesNotMatch(
    resources,
    /resourceTab === "documents" \? \(\s*<div className="flex flex-wrap gap-2">/,
  );
  assert.match(resources, /<NewResourceMenu\s+busyKind=\{creatingResource\}/);

  for (const kind of [
    "document",
    "spreadsheet",
    "application",
    "folder",
    "workspace",
  ]) {
    assert.match(menu, new RegExp(`kind: "${kind}"`), `missing ${kind}`);
  }
  assert.doesNotMatch(menu, /kind: "workflow"|badge: "NEW"/);

  // Each row has a description, since "Document", "Form" and "Application"
  // sound alike to a newcomer.
  assert.equal((menu.match(/description: "/g) || []).length, 5);

  // Nothing in the menu is silently inert. An option that does nothing when
  // clicked reads as a bug you have to reproduce.
  assert.match(resources, /Folders are coming/);
  assert.match(resources, /Gators are coming/);
});


test("resources and custom commands use one card, not three", async () => {
  const css = await source("src/app/globals.css");
  const resources = await source("src/components/Manage/sections/resources.tsx");
  const commands = await source("src/components/Manage/sections/custom-commands.tsx");

  // One card layout and one grid for documents, applications, commands and
  // templates.
  assert.match(css, /\.resource-grid \{[^}]*grid-template-columns: repeat\(auto-fill/);
  assert.match(css, /\.resource-item \{/);
  assert.match(css, /\.resource-item-sub \{/);

  for (const [name, file] of [
    ["resources", resources],
    ["custom-commands", commands],
  ] as const) {
    assert.match(file, /className="resource-grid"/, `${name} still has its own grid`);
    assert.match(file, /className="resource-item card-in"/, `${name} still has its own card`);
  }

  // Both lead with a preview of the thing itself, which is the stronger signal
  // when every icon in a grid is identical.
  assert.match(commands, /className="resource-preview/);
  assert.match(resources, /className="resource-preview/);

  // No delete button on cards; destructive actions live in the card's menu.
  assert.doesNotMatch(css, /\.resource-item-delete \{/);
  assert.doesNotMatch(resources, /resource-item-delete/);
  assert.doesNotMatch(commands, /resource-item-delete/);
});

test("verifying can actually do something, and the dashboard says what", async () => {
  const schema = await source("src/components/Manage/schema.ts");
  const roblox = await source("src/components/Manage/sections/roblox.tsx");

  // Verification can change roles in Discord (VERIFICATION_FIELDS), so
  // verifying actually gives access.
  assert.match(schema, /export const VERIFICATION_FIELDS: FieldDef\[\]/);
  for (const path of [
    "Verification.verified_role_ids",
    "Verification.unverified_role_ids",
    "Verification.set_nickname",
    "Verification.nickname_format",
  ]) {
    assert.match(schema, new RegExp(path.replace(/\./g, "\\.")), `missing ${path}`);
  }

  // Rendered on the Roblox tab — "what happens when somebody verifies" is a
  // Roblox question, and the dashboard already has more tabs than anybody wants.
  assert.match(roblox, /const \[GRANT, REMOVE, RENAME, FORMAT\] = VERIFICATION_FIELDS;/);
  // The format only while renaming is on: the bot does not read it otherwise.
  assert.match(roblox, /<Reveal when=\{renaming\}>/);
  assert.match(roblox, /When someone verifies/);

  // Renaming is best effort and the copy has to say so, or a server owner whose
  // own nickname never changes files a bug.
  assert.match(schema, /Best effort/);
});

test("leave covers absence and reduced activity without renaming the config key", async () => {
  const schema = await source("src/components/Manage/schema.ts");
  const nav = await source("src/components/Manage/nav-groups.tsx");

  // The tab is "Leave" (one record with a type), but the stored key stays
  // `Config.Modules.LOA`; renaming it would disable the module for every
  // existing server.
  assert.match(schema, /label: "Leave",\s*\n\s*moduleKey: "LOA",/);
  assert.match(schema, /time off or reduced activity/);
  assert.match(nav, /id: "loa", label: "Leave"/);
});

test("a department menu is drawn over the page, not under it", async () => {
  const content = await source("src/components/servers-content.tsx");
  const css = await source("src/app/servers/servers.css");

  /* The card is raised for as long as the menu is mounted, including its exit.
     A hovered card's transform makes a stacking context, which scopes the
     menu's z-index inside the card and lets the section below paint over it. */
  assert.match(content, /data-menu-open=\{menu === "shut" \? "false" : "true"\}/);
  assert.match(css, /\.servers-department-card\[data-menu-open="true"\] \{\s*z-index: 60;/);

  /* Three states (shut, open, going), and the node unmounts when its own exit
     animation ends, so it can animate out. */
  assert.match(content, /useState<"shut" \| "open" \| "going">\("shut"\)/);
  assert.match(content, /data-state=\{menuOpen \? "open" : "closed"\}/);
  assert.match(content, /if \(menu === "going"\) \{/);
  /* Timing comes from `styles/motion.css`: with `role="menu"` and `data-state`,
     it matches `[data-state][role="menu"]`, which sets both durations with
     `!important`. */
  assert.match(content, /role="menu"/);
  assert.match(css, /\.servers-department-menu \{[\s\S]{0,900}animation: menuOpen both;/);
  assert.match(
    css,
    /\.servers-department-menu\[data-state="closed"\] \{[\s\S]{0,200}animation-name: menuShut;/,
  );
  /* Travel without scale in both directions; scaling resamples the labels every
     frame. */
  assert.doesNotMatch(
    css,
    /@keyframes menuOpen \{[\s\S]{0,200}scale\(/,
    "the menu is scaling its own type again",
  );
  assert.match(css, /@keyframes menuShut \{/);

  /* Every row has a glyph. */
  assert.match(content, /\{DEPARTMENT_TABS\.map\(\(\{ tab, label, icon: Glyph \}\) => \(/);
  assert.match(content, /<Glyph size=\{13\} \/>/);
  assert.match(content, /<IconSettings size=\{13\} \/>\s*Manage department/);

  /* Written labels, not the raw tab keys. */
  assert.match(content, /const DEPARTMENT_TABS = \[/);
  assert.match(content, /\{ tab: "roster", label: "Roster", icon: IconUsers \}/);
  assert.match(content, /\{ tab: "resources", label: "Resources", icon: IconFolder \}/);
  assert.doesNotMatch(content, /\{tab === "home" \? "Overview" : tab\}/);
});

test("a server on the account page is a row in a list, not a card", async () => {
  const css = await source("src/app/account/account.css");
  const overview = await source("src/components/account/account-overview.tsx");

  /* A grouped list, not cards: one sheet with a header band and a row per
     server divided by full-width hairlines. Fixed-width cards cut names short,
     and a grid of tiles always ends on a ragged row. */
  /* The server sheet is its own component behind a Suspense boundary: the bot's
     guild call has a 4 to 6 second deadline, and nothing else on the page needs
     it (name, avatar and id are in the session; Roblox loads on the client).
     The page now draws immediately and fills the sheet when the call returns. */
  const sheet = await source("src/components/account/account-servers.tsx");
  const page = await source("src/app/account/page.tsx");
  assert.match(page, /<Suspense fallback=\{<AccountServersLoading \/>\}>/);
  assert.match(page, /<MyServers session=\{session\} \/>/);
  assert.match(page, /async function MyServers/);
  /* The only await on that call is inside the boundary; the page component
     reaches its `return` without asking the bot anything. */
  assert.ok(
    page.indexOf("await fetchMutualServersForSession") >
      page.indexOf("async function MyServers"),
    "the page is waiting on the bot before it renders again",
  );
  assert.equal(
    (page.match(/await fetchMutualServersForSession/g) || []).length,
    1,
  );
  assert.match(overview, /serversSlot: ReactNode/);

  assert.doesNotMatch(sheet, /account-server-go/);
  assert.doesNotMatch(sheet, /<SpotCard key=\{server\.id\}/);
  assert.doesNotMatch(sheet, /className="account-servers"/, "the grid is back");
  assert.match(sheet, /className="account-rows"/);
  assert.match(sheet, /className="account-row-face"/);
  assert.match(sheet, /<IconChevronRight size=\{16\} \/>/);
  /* The loading state is the height of the real rows, so nothing moves when
     they arrive. The placeholder shapes are shared, not copied from the
     picker's stylesheet. */
  assert.match(sheet, /export function AccountServersLoading/);
  assert.match(sheet, /className="account-row-skel"/);
  assert.match(sheet, /import "@\/components\/site\/skeleton\.css"/);
  const skeleton = await source("src/components/site/skeleton.css");
  assert.match(skeleton, /\.skel-bar,\s*\.skel-dot \{/);
  assert.match(skeleton, /@keyframes skelSweep/);

  /* The privacy rows open in place and answer the question there. */
  assert.match(overview, /<details className="account-fold">/);
  assert.match(overview, /<dl className="account-facts">/);
  /* The row itself is not a link into the policy. */
  assert.doesNotMatch(
    overview,
    /<Link[^>]*href="\/privacy#information-we-collect"[^>]*>\s*<span className="account-row-name">/,
    "the row is a link to the policy again",
  );
  /* Inside the fold, a link to the exact wording, saying which part of the
     policy it goes to. */
  assert.match(overview, /className="account-facts-more account-button"[\s\S]{0,120}href="\/privacy#information-we-collect"/);
  assert.match(overview, /className="account-facts-more account-button"[\s\S]{0,120}href="\/privacy#your-choices-and-rights"/);
  // The site's one button, like every other action on the page.
  assert.match(overview, /<RippleButton\s+as=\{Link\}\s+className="account-facts-more account-button"/);
  assert.match(overview, /aria-label="More on what Gator collects, in the privacy policy"/);
  // A privacy request is a conversation with a person, so that one still goes.
  assert.match(overview, /Make a privacy request/);
  assert.match(css, /\.account-fold\[open\] \.account-fold-mark \{\s*transform: rotate\(90deg\)/);
  assert.match(css, /\.account-fold::details-content \{/);
  assert.match(css, /interpolate-size: allow-keywords/);
  assert.match(css, /content-visibility 280ms allow-discrete/);

  /* Pressing the page you are on does nothing: `/servers` is `force-dynamic`,
     so navigating to it again is a full round trip with the old page frozen on
     screen. */
  const nav = await source("src/components/site/site-nav.tsx");
  const sheetNav = await source("src/components/site/nav-menu.tsx");
  assert.match(nav, /if \(here !== href\) return;\s*event\.preventDefault\(\)/);
  assert.match(sheetNav, /if \(here === href\) event\.preventDefault\(\)/);

  assert.match(css, /\.account-rows > li \+ li \{\s*border-top: 1px solid/);
  assert.match(css, /\.account-rows > li > a \{/);
  /* Each row carries the hairline above it rather than an edge of its own, so
     there is nothing to inset and no box around a box. */
  assert.doesNotMatch(css, /\.account-server \+ \.account-server::before/);

  // And a name that is longer than the row is truncated, not wrapped into it.
  assert.match(css, /\.account-row-name \{[^}]*text-overflow: ellipsis/);
});

test("the profile menu is navigation, not a status display", async () => {
  const menu = await source("src/components/user-menu.tsx");

  // The menu has no Roblox status row, which cost an API request on every page
  // to decide its label.
  assert.doesNotMatch(menu, /account\/roblox/);
  assert.doesNotMatch(menu, /RobloxLogo/);
  assert.doesNotMatch(menu, /setRoblox/);
});

test("light mode exists for the shared token scale", async () => {
  const css = await source("src/app/globals.css");

  // Every `--gs-*` token has a light value, so pages built on them have a light
  // mode.
  const light = css.slice(css.indexOf(':root[data-theme="light"] {'));
  for (const token of [
    "--gs-canvas",
    "--gs-surface",
    "--gs-surface-hover",
    "--gs-surface-solid",
    "--gs-line",
    "--gs-line-strong",
    "--gs-text",
    "--gs-text-muted",
    "--gs-text-faint",
  ]) {
    assert.match(light, new RegExp(`${token}:`), `light mode never redefines ${token}`);
  }
});

test("a resource card shows the thing rather than an icon for it", async () => {
  const resources = await source("src/components/Manage/sections/resources.tsx");
  const css = await source("src/app/globals.css");

  // Each resource card shows a preview of its content, so you can tell which
  // one is which.
  assert.match(resources, /className="resource-preview resource-preview-application"/);
  assert.match(resources, /className="resource-preview resource-preview-document"/);
  assert.match(css, /\.resource-preview \{/);
  assert.match(css, /\.resource-preview-title \{/);

  // The application preview uses the form's own accent, so two forms do not
  // look identical.
  assert.match(resources, /--preview-accent/);
  assert.match(css, /var\(--preview-accent/);

  // One grid for the whole workspace: no tabs and no per-kind sections.
  assert.doesNotMatch(resources, /resourceTab/);
  assert.doesNotMatch(resources, /ResourceGroup/);
  assert.doesNotMatch(css, /\.resource-group-title/);
  const grid = (resources.match(/className="resource-grid"/g) || []).length;
  assert.equal(grid, 1, "the workspace draws more than one grid");
  for (const kind of ["application", "document"]) {
    assert.match(resources, new RegExp(`resource-preview resource-preview-${kind}`));
  }

  // A 24rem minimum track, so the preview is large enough to recognise.
  assert.match(css, /\.resource-grid \{[\s\S]*?minmax\(24rem, 1fr\)/);
});

test("the workflow editor is a graph, not a form", async () => {
  const canvas = await source(
    "src/components/Manage/workflow/workflow-canvas.tsx",
  );
  const blocks = await source("src/components/Manage/workflow/blocks.ts");
  const css = await source("src/components/Manage/workflow/workflow.css");

  // Workflow blocks have typed input and output ports, so a later step can use
  // a value an earlier one produced.
  assert.match(blocks, /outputs: BlockPort\[\]/);
  assert.match(blocks, /inputs: BlockPort\[\]/);
  assert.match(blocks, /export function portsCompatible/);

  // The catalogue is deep enough to be worth a canvas.
  const blockCount = (blocks.match(/^  \{\n    type: "/gm) || []).length;
  assert.ok(blockCount >= 40, `only ${blockCount} blocks`);
  for (const category of [
    "trigger",
    "action",
    "logic",
    "data",
    "roblox",
    "staff",
  ]) {
    assert.match(
      blocks,
      new RegExp(`category: "${category}"`),
      `no ${category} blocks`,
    );
  }

  // Typing is enforced at connect time, so an impossible link is one you cannot
  // draw rather than one that fails weeks later inside a rule nobody watches.
  assert.match(canvas, /portsCompatible\(fromPort\.type, toPort\.type\)/);
  // An input takes one connection — two things feeding one slot is a question
  // the engine cannot answer.
  assert.match(
    canvas,
    /edges\.filter\(\s*\(edge\) => !\(edge\.to\.node === to\.node/,
  );

  // The chrome from the reference: named header, live state, three views, and
  // a block reference short enough to say out loud.
  assert.match(canvas, /export function WorkflowShell/);
  assert.match(canvas, /"editor", "Editor"/);
  assert.match(canvas, /"history", "History"/);
  assert.match(canvas, /"settings", "Settings"/);
  assert.match(canvas, /function blockRef/);
  assert.match(canvas, /BLO-/);

  // A canvas reads as a plane because of the grid, and the dot is the type.
  assert.match(css, /\.wf-canvas \{[\s\S]{0,400}radial-gradient/);
  assert.match(css, /\.wf-dot \{/);
  // 11px is right to look at and far too small for a thumb.
  assert.match(css, /\.wf-dot::after \{[\s\S]{0,120}inset: -9px;/);

  // And it has a light mode, unlike the last thing that got built on hardcoded
  // near-blacks.
  assert.match(css, /:root\[data-theme="light"\] \.wf-canvas/);
  assert.match(css, /:root\[data-theme="light"\] \.wf-node/);
});


test("light mode reaches the account page", async () => {
  const toggle = await source("src/components/Manage/theme-toggle.tsx");

  // The theme applies on /account too.
  assert.match(toggle, /pathname\.startsWith\("\/account"\)/);
});

test("a linked roblox account is never shown without a face", async () => {
  const route = await source("src/app/api/account/roblox/route.ts");
  const overview = await source("src/components/account/account-overview.tsx");
  const css = await source("src/app/account/account.css");

  // The headshot is resolved here as well, since the bot's lookup times out
  // after five seconds and returns null.
  assert.match(route, /async function resolveHeadshot/);
  assert.match(route, /thumbnails\.roblox\.com/);
  assert.match(route, /!data\.roblox\.avatar/);
  // Only when the thumbnail actually rendered — Roblox reports pending ones.
  assert.match(route, /entry\?\.state === "Completed"/);

  // And a genuinely missing avatar falls back to the mark rather than an empty
  // circle, which reads as a broken image.
  assert.match(overview, /account-who-face account-who-square account-who-mark/);
  assert.match(css, /\.account-who-mark \{/);
});

test("the block catalogue is deep enough to build something real", async () => {
  const blocks = await source("src/components/Manage/workflow/blocks.ts");

  const types = [...blocks.matchAll(/^    type: "([a-z_.]+)",$/gm)].map(
    (m) => m[1],
  );
  assert.ok(new Set(types).size >= 70, `only ${new Set(types).size} blocks`);

  // Workflows can build and send full embeds (title, colour, fields, footer),
  // not only plain text.
  for (const block of [
    "embed_build",
    "embed_field",
    "template_message",
    "reply",
    "react",
    "thread_create",
  ]) {
    assert.match(blocks, new RegExp(`type: "${block}"`), `no ${block} block`);
  }

  // Flow control is what makes a graph worth having over a list: repeat over a
  // list, run two paths, stop early, come back later.
  for (const block of [
    "for_each",
    "parallel",
    "guard",
    "stop",
    "cooldown",
    "switch",
  ]) {
    assert.match(blocks, new RegExp(`type: "${block}"`), `no ${block} block`);
  }

  // Fields on the node, so the common case does not need a Text block and a
  // wire — that is how a graph editor ends up slower than the form it replaced.
  assert.match(blocks, /export type BlockField/);
  assert.match(blocks, /fields: \[/);
  const withFields = (blocks.match(/fields: \[/g) || []).length;
  assert.ok(withFields >= 15, `only ${withFields} blocks carry inline fields`);

  // New port types for the things a workflow moves around.
  for (const type of ["message", "list", "time"]) {
    assert.match(
      blocks,
      new RegExp(`\\|\\s*"${type}"`),
      `no ${type} port type`,
    );
  }
});

test("/manage runs the /servers type system instead of one sans at four sizes", async () => {
  const css = await source("src/components/Manage/manage-restyle.css");
  const header = await source("src/components/Manage/section-header.tsx");
  const schema = await source("src/components/Manage/schema-section.tsx");

  // Section headers use the editorial header.
  assert.match(header, /editorial = true/);
  assert.match(header, /tab-page-header/);
  assert.match(css, /\.manage-root \.manage-editorial-title \{/);
  assert.match(css, /\.manage-root \.manage-kicker \{/);
  assert.match(css, /\.tab-page-header \.section-header-title \{[\s\S]{0,180}clamp\(2rem/);

  // One face for title, kicker and accent; the accent is a colour, not a second
  // family.
  assert.match(css, /\.manage-editorial-title \{[^}]*font-family: var\(--font-ui\)/);
  assert.match(css, /\.manage-editorial-title \.accent \{[^}]*font-family: inherit/);

  // The kicker is the UI face, with a dashed rule under it. (Serif italic small
  // caps on every header was hard to read at that size.)
  assert.match(css, /\.manage-kicker \{[\s\S]{0,320}--font-ui/);
  assert.doesNotMatch(css, /\.manage-kicker::after/);
  assert.doesNotMatch(schema, /kicker=\{section\.moduleKey \? "Module" : "Core"\}/);
});

test("the hand-drawn marks appear where they earn their place", async () => {
  const css = await source("src/components/Manage/manage-restyle.css");
  const empty = await source("src/components/Manage/empty-state.tsx");
  const resources = await source("src/components/Manage/sections/resources.tsx");

  // Decoration around real work, never on a control. A doodle beside an empty
  // state is warmth; a doodle on a save button is a toy.
  assert.match(css, /Decoration around real work, never on a control/);
  assert.match(empty, /doodle\?: DoodleName/);
  assert.match(empty, /<DoodleMark name=\{doodle\}/);

  // The empty state uses a doodle, and the workspace has one empty state, not
  // one per group.
  assert.match(resources, /doodle="folder"/);
  assert.equal((resources.match(/<EmptyState/g) || []).length, 1);

  // Two rotations, so a row of them does not read as one stamp repeated.
  assert.match(css, /\.doodle-mark:nth-of-type\(odd\)/);
  assert.match(css, /\.doodle-mark:nth-of-type\(even\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,220}\.doodle-mark/);
});

test("light mode is paper, and it is only offered where it applies", async () => {
  const css = await source("src/app/globals.css");
  const toggle = await source("src/components/Manage/theme-toggle.tsx");
  // Light mode is beige with raised cards, using /manage's values, not cold
  // white.
  const light = css.slice(css.indexOf(':root[data-theme="light"] {'));
  assert.match(light, /--gs-canvas: #f7f1e8/);
  assert.match(light, /--gs-surface-solid: #fdf8f2/);
  // Warm-brown alpha, not neutral black: a grey wash over beige turns it grey,
  // which is how a light mode ends up looking like an inverted dark one.
  assert.match(light, /--gs-surface: rgba\(60, 42, 30/);
  assert.match(light, /--gs-text: #2a1d14/);

  // The toggle only renders where the theme applies.
  assert.match(toggle, /if \(!themeApplies\(pathname\)\) return null;/);

});

test("a dead roblox thumbnail falls back instead of painting an empty circle", async () => {
  const overview = await source("src/components/account/account-overview.tsx");

  // Roblox thumbnail URLs expire, so a failed avatar falls back to the initial
  // instead of an empty circle.
  assert.match(overview, /onError=\{\(\) => setAvatarBroken\(true\)\}/);
  assert.match(overview, /roblox\.avatar && !avatarBroken/);
  // A fresh payload deserves a fresh attempt.
  assert.match(overview, /setAvatarBroken\(false\);/);
});

test("light mode reaches the writing, not only the frame", async () => {
  const css = await source("src/components/Manage/manage-restyle.css");

  // Tailwind utilities inside `.manage-content` are written for a dark ground,
  // so each common one gets a paper value in light mode. Written as the
  // Tailwind class and escaped here (hand-escaping for CSS and regex once made
  // this loop match nothing).
  const cssClass = (u: string) => u.replace(/[:/[\].#]/g, (c) => "\\" + c);
  const reEscape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const util of [
    "text-white/35",
    "text-white/70",
    "text-white/55",
    "text-white/40",
    "text-white/80",
    "text-[#f5f2f2]",
    "bg-white/[0.06]",
  ]) {
    assert.match(
      css,
      new RegExp(`data-theme="light"[^{]*\\.${reEscape(cssClass(util))}[,:{ ]`),
      `${util} has no paper value`,
    );
  }

  // Text inverts to the ink scale with a lifted floor — alpha 0.35 of ink on
  // beige is nearly gone where 0.35 of white on near-black is legible.
  assert.match(css, /\.text-white\\\/35 \{\n {2}color: rgba\(42, 29, 20, 0\.5[0-9]*\)/);

  // Backgrounds do not invert (a raised surface is lighter than its ground in
  // both themes), but the alpha is amplified and the wash is the warm panel
  // tone instead of white.
  assert.match(css, /\.bg-white\\\/\\\[0\\\.06\\\][^{]*\{\n {2}background-color: rgba\(253, 248, 242,/);

  // text-white/0 is the hover-reveal trick, not a colour. It stays at zero.
  assert.match(css, /\.text-white\\\/0[^{]*\{\n {2}color: rgba\(42, 29, 20, 0\)/);

  // Discord previews opt out — an embed preview is a picture of Discord and
  // has to look like Discord in both themes.
  assert.match(css, /:not\(\[data-discord-preview\]\):not\(\[data-discord-preview\] \*\)/);
  // One frame draws every message now, and it carries the opt-out; the
  // editors draw through it.
  assert.match(await source("src/components/Manage/discord-message.tsx"), /data-discord-preview/);
  for (const file of [
    "src/components/Manage/message-design.tsx",
    "src/components/Manage/embed-editor.tsx",
  ]) {
    assert.match(await source(file), /<DiscordFrame/, `${file} draws a message outside the shared frame`);
  }
  assert.match(
    await source("src/components/Manage/special-fields.tsx"),
    /data-discord-preview/,
    "special-fields paints a Discord surface and never opts out of the paper remap",
  );
});

test("every page wears the same nav", async () => {
  // Site pages carry the landing's header and the dashboard carries its own;
  // none carries the pre-restyle bar.
  for (const page of [
    "src/app/account/page.tsx",
    "src/app/account/roblox/page.tsx",
    "src/components/legal-page.tsx",
  ]) {
    const source_ = await source(page);
    assert.match(source_, /import \{[^}]*SiteNav/, `${page} is not on SiteNav`);
    assert.match(source_, /<SiteNav/, `${page} imports the nav and never renders it`);
    assert.match(source_, /<SiteFooter/, `${page} has no footer`);
  }
  // The dashboard keeps its own chrome, which is a deliberate second surface
  // rather than a leftover. What nothing may keep is the pre-restyle header.
  for (const page of [
    "src/app/account/page.tsx",
    "src/app/account/roblox/page.tsx",
    "src/components/legal-page.tsx",
    "src/app/servers/page.tsx",
  ]) {
    const source_ = await source(page);
    assert.doesNotMatch(source_, /Landing\/header"/, `${page} still imports the old header`);
  }
});

test("the block catalogue covers the product, not one event", async () => {
  const blocks = await source("src/components/Manage/workflow/blocks.ts");

  // The catalogue covers the product: triggers for messages, bans, boosts,
  // voice, sessions, tickets, appeals, quota, rank changes and the in-game
  // player count, not only punishments.
  const types = [...blocks.matchAll(/^\s{4}type: "([a-z_.0-9]+)"/gm)].map((m) => m[1]);
  assert.ok(types.length >= 150, `only ${types.length} blocks`);

  // Every block type is unique: a clash would let one silently win the
  // BLOCKS_BY_TYPE lookup and make the other unreachable from a saved graph.
  assert.equal(new Set(types).size, types.length, "duplicate block types");

  // Coverage, spot-checked across the modules that actually exist.
  for (const type of [
    "message.sent",
    "member.banned",
    "voice.joined",
    "session.started",
    "ticket.opened",
    "appeal.submitted",
    "log.edited",
    "erlc.count.dropped",
    "webhook.received",
    "custom.command",
    "quota.missed",
    "schedule.weekly",
    "erlc.kick",
    "erlc.pm",
    "erlc.hint",
    "ban_member",
    "log_create",
    "promote",
    "quota_progress",
    "if_else",
    "repeat",
    "try_catch",
    "http_request",
  ]) {
    assert.match(blocks, new RegExp(`type: "${type.replace(/\./g, "\\.")}"`), `no ${type} block`);
  }

  // The palette lists categories in a written order rather than in whatever
  // order the record literal happened to be typed in.
  assert.match(blocks, /export const CATEGORY_ORDER: BlockCategory\[\]/);
});

test("a message block edits a message, not a line of text", async () => {
  const editor = await source("src/components/Manage/workflow/message-value-editor.tsx");
  const canvas = await source("src/components/Manage/workflow/workflow-canvas.tsx");

  // A message field opens the full message editor, not a text input for a
  // template name.
  assert.match(canvas, /if \(field\.kind === "message"\)/);
  assert.match(canvas, /<MessageValueEditor/);
  assert.match(canvas, /describeNodeMessage/);

  // The same components the module message cards use, so an embed on a node and
  // one on the Tickets page have the same limits and preview.
  assert.match(editor, /import \{ DiscordPreview, EmbedForm \}/);
  assert.match(editor, /ContainerBlocksEditor/);
  assert.match(editor, /ContainerPreview/);
  assert.match(editor, /containerValidationError/);

  // Node values are strings, so the message rides as JSON — parsed defensively,
  // because a thrown error inside a node render is a blank canvas.
  assert.match(editor, /export function parseNodeMessage/);
  assert.match(editor, /\} catch \{\n\s+return \{ \.\.\.EMPTY \};/);

  // The mode is the document's own render_mode, not separate editor state, or a
  // container built here sends as an embed.
  assert.match(editor, /render_mode: mode === "container" \? "v2" : "legacy"/);
});

test("a settings group shows what it depends on", async () => {
  const schema = await source("src/components/Manage/schema.ts");
  const section = await source("src/components/Manage/schema-section.tsx");
  const css = await source("src/components/Manage/manage-restyle.css");

  // Groups that only work once a switch is on name that switch (`gatedBy`), so
  // the page shows what depends on what.
  assert.match(schema, /gatedBy\?: string;/);
  const gated = (
    schema.match(/gatedBy: "Integrations\.PRC\.advanced\.enabled"/g) || []
  ).length;
  // Six: "Weather and time" is its own tab, since it does not need the
  // background workflows the gate turns on.
  assert.equal(gated, 6, `${gated} PRC groups name their gate`);

  assert.match(section, /function SchemaGroupBlock/);
  assert.match(
    section,
    /const gateOpen = group\.gatedBy \? Boolean\(value\(group\.gatedBy\)\) : true/,
  );
  assert.match(section, /className="schema-gated" data-open=/);

  // Gated groups are stepped back, not hidden, so you can see what exists and
  // what it waits on.
  assert.match(
    css,
    /\.schema-gated\[data-open="false"\] \{\r?\n {2}opacity: 0\.45;/,
  );
  assert.doesNotMatch(
    css,
    /\.schema-gated\[data-open="false"\] \{\r?\n {2}display: none/,
  );
  // But not editable while it is off.
  assert.match(
    css,
    /schema-gated\[data-open="false"\] :is\(input, textarea, select, button\)/,
  );

  // A one-field group is drawn like any other group; there is no branch on
  // field count.
  assert.doesNotMatch(section, /group\.fields\.length === 1 \? \(/);
  assert.doesNotMatch(section, /data-single=/);
});

test("ERLC owns game logs and Sessions lives with Community", async () => {
  const schema = await source("src/components/Manage/schema.ts");
  const section = await source("src/components/Manage/schema-section.tsx");
  const nav = await source("src/components/Manage/nav-groups.tsx");

  assert.match(schema, /id: "prc",\r?\n\s+label: "ERLC"/);
  assert.match(section, /title=\{section\.id === "prc" \? "ERLC"/);
  assert.match(section, /id: "game-logs",\r?\n\s+label: "Game Logs"/);
  assert.match(section, /findSection\("game-logs"\)/);
  assert.doesNotMatch(nav, /\{ id: "game-logs", label: "Game Logs"/);
  assert.match(nav, /title: "Community"[\s\S]{0,1800}\{ id: "sessions", label: "Sessions"/);
  assert.match(schema, /key: "Sessions"[^\n]+category: "Community"/);
});


test("the account control opens into an identity, without fighting the bar", async () => {
  const menu = await source("src/components/user-menu.tsx");
  const css = await source("src/components/user-menu.css");

  // It widens on hover to show who is signed in, without a `width` animation:
  // the trigger sits inside a pill that also widens on hover, and two width
  // animations fought over the same container.
  assert.doesNotMatch(css, /\.user-menu-trigger[^}]*transition:[^;]*\bwidth\b/);
  // A grid track instead, resolved against content already measured, so the
  // outer pill sees one size change.
  assert.match(css, /grid-template-columns: 2\.35rem 0fr 0fr/);
  assert.match(css, /grid-template-columns: 2\.35rem 1fr 1\.2rem/);
  // Without `min-width: 0` the track refuses to go below the text's intrinsic
  // width and the collapse never happens at all.
  assert.match(css, /\.user-menu-identity,\s*\n\.user-menu-caret \{[\s\S]{0,80}min-width: 0/);

  assert.match(menu, /user-menu-identity-name/);
  assert.match(menu, /user-menu-caret/);

  // On touch it stays a circle: there is no hover, and a tap that both expands
  // and opens is the double-tap trap. The panel shows the same name and handle.
  assert.match(css, /@media \(hover: none\)[\s\S]{0,220}grid-template-columns: 2\.35rem 0fr 0fr/);
});

test("the wheel zooms the canvas", async () => {
  const canvas = await source("src/components/Manage/workflow/workflow-canvas.tsx");

  // On the canvas the wheel zooms; dragging pans.
  assert.match(canvas, /zoomAt\(event\.deltaY < 0 \? 1\.1 : 1 \/ 1\.1, event\.clientX, event\.clientY\)/);
  assert.match(canvas, /if \(event\.shiftKey \|\| Math\.abs\(event\.deltaX\) > Math\.abs\(event\.deltaY\)\)/);
  // The hint names the gestures people use (drag to pan, scroll to zoom).
  // Space-to-pan still works.
  assert.match(canvas, /Drag the canvas to pan · scroll to zoom/);
  assert.match(canvas, /double-click a wire to\s*\n?\s*disconnect/);
  // Still implemented, whatever the hint leads with.
  assert.match(canvas, /if \(event\.code === "Space"\) setSpaceHeld\(false\)/);
});

test("you never have to draw a wire", async () => {
  const canvas = await source("src/components/Manage/workflow/workflow-canvas.tsx");
  const css = await source("src/components/Manage/workflow/workflow.css");

  // Every port is typed, so for any output the editor knows which blocks can
  // accept it. Clicking a port arms it and the palette offers those blocks,
  // instead of dragging a wire onto an 11px dot.
  assert.match(canvas, /const \[armed, setArmed\] = useState</);
  assert.match(canvas, /function landingPort\(block: BlockDef\): BlockPort \| null/);

  // Click arms and drag still draws a wire: pointerdown starts the wire, and
  // click only follows a pointer that never moved.
  assert.match(canvas, /onPointerDown=\{\(event\) => \{[\s\S]{0,400}kind: "port"/);
  assert.match(canvas, /onClick=\{\(event\) => \{[\s\S]{0,300}setArmed\(/);

  // Armed, the palette is a shortlist from either end: an output shows what can
  // continue from it, an empty input shows what produces it. Triggers are
  // excluded; a graph has one.
  assert.match(canvas, /if \(block\.isTrigger\) continue;/);
  assert.match(canvas, /armed\.side === "in"[\s\S]{0,220}block\.outputs\.some/);

  // Picking one places, wires and selects it, then re-arms on the new block, so
  // a chain is click, click, click. Filling an input backwards does not re-arm.
  assert.match(canvas, /from: \{ node: armed\.node, port: armed\.port \}/);
  assert.match(canvas, /const carry = backwards\s*\n?\s*\? null/);
  assert.match(canvas, /block\.outputs\.find\(\(port\) => port\.type === "flow"\)/);

  // Escape backs out of the armed state before it backs out of the selection.
  assert.match(canvas, /if \(armed\) setArmed\(null\);\n\s+else setSelected\(null\);/);

  // And the canvas says it is waiting, rather than leaving the state in a panel.
  assert.match(css, /\.wf-dot\.is-armed \{/);
  assert.match(css, /@keyframes wfArmed/);
  assert.match(css, /\.wf-palette\[data-armed="true"\]/);
});

test("the canvas wears this product's material, not a node editor's", async () => {
  const css = await source("src/components/Manage/workflow/workflow.css");

  // Nodes use the dashboard's own panel token, not the generic slate
  // node-editor look.
  assert.match(css, /\.wf-node \{[\s\S]{0,400}var\(--manage-panel/);

  // The category is a spine down the left edge, not a filled band across the
  // top — a saturated header is most of a small node's area spent on a label.
  assert.match(css, /\.wf-node::before \{[\s\S]{0,220}width: 3px/);
  assert.match(css, /\.wf-node-head \{[\s\S]{0,180}background: transparent/);

  // And the one hand-drawn mark this product uses everywhere else.
  assert.match(css, /\.wf-node-head::after \{[\s\S]{0,220}border-top: 1px dashed/);
});

test("conditions are their own kind of thing", async () => {
  const blocks = await source("src/components/Manage/workflow/blocks.ts");

  // Conditions are their own category, separate from control-flow logic.
  assert.match(blocks, /\| "condition"/);
  assert.match(blocks, /condition: "Conditions"/);
  assert.match(blocks, /"condition",\n\s+"logic",/);

  const types = [...blocks.matchAll(/^\s{4}type: "([a-z_.0-9]+)"/gm)].map(
    (m) => m[1],
  );
  assert.ok(types.length >= 225, `only ${types.length} blocks`);
  assert.equal(new Set(types).size, types.length, "duplicate block types");

  // The ER:LC in-game actions and the session lifecycle are available as
  // blocks.
  for (const type of [
    "erlc.heal",
    "erlc.teleport",
    "erlc.shutdown",
    "erlc.fire_start",
    "erlc.helper_add",
    "erlc.run",
    "erlc.team_counts",
    "session.start",
    "session.boost",
    "session.shutdown",
    "shift.end_all",
    "is_equal",
    "both",
    "either",
    "in_range",
    "player_on_team",
    "session_status",
    "value_text",
    "math_add",
    "math_round",
  ]) {
    assert.match(
      blocks,
      new RegExp(`type: "${type.replace(/\./g, "\\.")}"`),
      `no ${type}`,
    );
  }
});

test("the palette says which blocks actually run", async () => {
  const serialize = await source("src/components/Manage/workflow/serialize.ts");
  const canvas = await source(
    "src/components/Manage/workflow/workflow-canvas.tsx",
  );
  const css = await source("src/components/Manage/workflow/workflow.css");

  // The palette marks which blocks can run (RUNNABLE_STEPS) before you choose
  // one.
  assert.match(serialize, /export const RUNNABLE_STEPS = new Set/);
  assert.match(serialize, /export const RUNNABLE_TRIGGERS = new Set/);
  assert.match(serialize, /export function isRunnable/);
  assert.match(canvas, /const runnable = isRunnable\(block\.type\)/);
  assert.match(canvas, /data-runnable=\{runnable \? "true" : "false"\}/);
  assert.match(css, /\.wf-palette-card\[data-runnable="false"\]/);

  // Dimmed, not hidden and not disabled — they save, round-trip, and start
  // working the day the engine catches up.
  assert.doesNotMatch(
    css,
    /\[data-runnable="false"\][\s\S]{0,80}display: none/,
  );
  assert.match(
    css,
    /\.wf-palette-card\[data-runnable="false"\] \{\n {2}opacity: 0\.55;/,
  );

  // The six triggers wired up bot-side this session are in the runnable set.
  for (const trigger of [
    "infraction.created",
    "promotion.created",
    "ticket.closed",
    "leave.started",
    "leave.ended",
    "form.submitted",
  ]) {
    assert.match(
      serialize,
      new RegExp(`"${trigger.replace(/\./g, "\\.")}"`),
      `${trigger} missing`,
    );
  }
});

test("a container block can be moved and duplicated, not only dragged", async () => {
  const design = await source("src/components/Manage/message-design.tsx");

  // Blocks can be moved with up and down buttons, not only by dragging
  // (keyboard and touch).
  assert.match(design, /aria-label="Move block up"/);
  assert.match(design, /aria-label="Move block down"/);
  assert.match(design, /aria-label="Duplicate block"/);
  // The drag stays for people who prefer it.
  assert.match(design, /aria-label="Drag block to reorder"/);

  // Deep-copied. A shallow copy hands both rows the same `buttons` array, so
  // editing one silently edits the other.
  assert.match(design, /JSON\.parse\(JSON\.stringify\(block\)\)/);
});

test("the container editor reaches the embed editor's depth", async () => {
  const design = await source("src/components/Manage/message-design.tsx");
  const embed = await source("src/components/Manage/embed-editor.tsx");

  // Blocks fold to a one-line summary, as in the embed editor.
  assert.match(design, /toggleCollapsed/);
  assert.match(design, /containerBlockSummary/);
  assert.match(design, /Collapse all/);
  assert.match(design, /Expand all/);
  // Folded, a block still says what is in it — otherwise collapsing turns the
  // stack into eight identical grey bars.
  assert.match(design, /\{containerBlockSummary\(block\)\}/);

  // Folded state is keyed by the block's id, not its position, so moving,
  // duplicating or deleting blocks needs no index remapping.
  assert.match(design, /const \[collapsed, setCollapsed\] = useState<ReadonlySet<string>>/);
  assert.match(design, /export function blockKey/);
  assert.doesNotMatch(design, /remapForMove/);
  assert.doesNotMatch(design, /remapCollapsed/);
  // The React key and the folded set read the same helper, so they cannot
  // disagree about what a block is called.
  assert.match(design, /key=\{blockKey\(block, index\)\}/);
  assert.match(design, /toggleCollapsed\(blockKey\(block, index\)\)/);

  // The container limits Discord enforces are checked in the editor; a rejected
  // send only names a component index.
  assert.match(design, /CONTAINER_LIMITS/);
  assert.match(design, /containerCharacterCount/);
  assert.match(design, /allows \$\{CONTAINER_LIMITS\.total\.toLocaleString\(\)\} across all text blocks/);
  assert.match(design, /Discord allows \$\{CONTAINER_LIMITS\.blocks\}/);
  // Counted the same way as an embed, from the same component.
  assert.match(embed, /export function CharacterCount/);
  assert.match(design, /<CharacterCount value=\{block\.content\} limit=\{CONTAINER_LIMITS\.text\}/);

  // The block picker is a menu with descriptions, not a row of name chips.
  assert.match(design, /function AddBlockMenu/);
  assert.match(design, /CONTAINER_ADDERS/);
  assert.doesNotMatch(design, /const adders: \{ type: string/);

  // Every branch of the bot's `_render_into`, plus Container. File is in
  // Discord's spec but is not offered, because the bot does not render it.
  const kinds = [...design.matchAll(/^\s{4}type: "([a-z_]+)",$/gm)].map((m) => m[1]);
  assert.deepEqual(kinds, [
    "text",
    "section",
    "text_button",
    "button_row",
    "media_gallery",
    "separator",
    "message_dropdown",
    "container",
  ]);

  // A container is a block, not the frame around every block: text and buttons
  // can sit beside one at the top level, as in Discord's component tree and
  // Discohook.
  assert.match(design, /export function layoutHasContainers/);
  assert.match(design, /const NESTABLE_ADDERS/);
  // Discord has no container inside a container, so the palette inside one
  // does not offer it.
  assert.match(design, /adder\.type !== "container"/);
  // The editor recurses, and so does everything that measures a layout.
  assert.match(design, /<ContainerBlocksEditor\s+nested/);
  assert.match(design, /export function flattenContainerBlocks/);
});

test("every input port can be filled without a wire", async () => {
  const canvas = await source("src/components/Manage/workflow/workflow-canvas.tsx");
  const css = await source("src/components/Manage/workflow/workflow.css");

  // A port can take a typed value instead of a wire: the engine's `resolve`
  // reads `node.values[portId]` when no edge feeds the port. Without this, a
  // required `channel` or `member` input that nothing produces could never be
  // filled.
  assert.match(canvas, /function PortInput/);
  assert.match(canvas, /\[port\.id\]: next/);

  // Keyed by the port id, which is what makes the two sides agree with no new
  // storage on either.
  assert.match(canvas, /value=\{node\.values\?\.\[port\.id\] \|\| ""\}/);

  // Hidden the moment something is wired in: a field under a connected port is
  // a value that looks used and is not.
  assert.match(canvas, /!wiredPorts\.has\(`\$\{node\.id\}:\$\{port\.id\}`\)/);
  // And skipped when the block declares its own field of that id — those carry
  // a label, placeholder or options a type-driven widget cannot know about.
  assert.match(canvas, /!declaredFieldIds\.has\(port\.id\)/);

  assert.match(css, /\.wf-port-input/);
});

test("channels and roles are picked, not typed as ids", async () => {
  const canvas = await source("src/components/Manage/workflow/workflow-canvas.tsx");

  // Channel and role inputs use the dashboard's pickers, not text boxes for
  // ids.
  assert.match(canvas, /import \{ ChannelPicker, RolePicker, SelectField \} from "\.\.\/fields"/);
  // On the producer block's own field ("Pick A Channel", "Pick A Role").
  assert.match(canvas, /field\.kind === "channel"[\s\S]{0,400}<ChannelPicker/);
  assert.match(canvas, /field\.kind === "role"[\s\S]{0,400}<RolePicker/);
  // Not on every consuming card: the channel is chosen once on the producer,
  // and each port points at it.
  assert.match(canvas, /port\.type === "channel"[\s\S]{0,300}<ChannelPicker/);

  // Messages open the real editor rather than a textarea, from the port as
  // well as from a declared field.
  assert.match(canvas, /port\.type === "message"[\s\S]{0,500}<MessageValueEditor/);

  // Lists and records say so rather than offering an input that cannot produce
  // a valid value.
  assert.match(canvas, /Wire this in from another block/);
});

test("the canvas offers a grab exactly where it honours one", async () => {
  const css = await source("src/components/Manage/workflow/workflow.css");

  // Empty canvas pans on a plain drag, so the canvas shows `grab`. Things that
  // are not grabbable say so (below).
  const canvasRule = css.slice(css.indexOf(".wf-canvas {"));
  const body = canvasRule.slice(0, canvasRule.indexOf("}"));
  assert.match(body, /cursor: grab;/);
  assert.doesNotMatch(body, /cursor: default;/);

  // Controls inside the canvas say what they are, so the inherited grab never
  // lands on something that does not drag.
  assert.match(css, /\.wf-canvas button:not\(\.wf-dot\),/);
  assert.match(css, /\.wf-canvas input,[\s\S]{0,140}cursor: text;/);
  // A port dot starts a wire; crosshair is what says so.
  assert.match(css, /\.wf-dot \{[\s\S]{0,260}cursor: crosshair;/);

  assert.match(css, /\[data-panning="true"\] \.wf-canvas,/);
});


test("a resource can be copied, and a server cannot make unlimited ones", async () => {
  const resources = await source("src/components/Manage/sections/resources.tsx");
  const menu = await source("src/components/Manage/new-resource-menu.tsx");
  const css = await source("src/app/globals.css");

  // Each resource card has Duplicate in its menu.
  assert.match(resources, /function ResourceCardMenu/);
  assert.match(resources, /async function duplicateResource/);
  assert.doesNotMatch(resources, /duplicateResource\("workflow"/);
  assert.match(resources, /duplicateResource\("application"/);
  assert.match(resources, /duplicateResource\("document"/);

  // Deep-copied: a shallow copy hands both forms the same `questions` array,
  // so editing one silently edits the other.
  assert.match(resources, /JSON\.parse\(JSON\.stringify\(source\)\)/);
  // Responses are not copied: they belong to the form they were submitted to.
  assert.match(resources, /delete \(clone as Record<string, unknown>\)\.responses/);

  // One ceiling across all remaining kinds.
  assert.match(resources, /export const RESOURCE_LIMIT = 25/);
  assert.match(resources, /resourceCount >= RESOURCE_LIMIT/);
  // Refused at the trigger rather than per option, so the menu does not open
  // onto six things you cannot pick.
  assert.match(menu, /disabled = false/);
  assert.match(resources, /disabled=\{resourceCount >= RESOURCE_LIMIT\}/);

  // The menu only appears on hover or focus: a permanent button in the corner
  // of every card is chrome on a page whose job is showing you the things.
  assert.match(css, /\.resource-item-menu \{[\s\S]{0,200}opacity: 0;/);
  assert.match(css, /\.resource-item:focus-within \.resource-item-menu/);
});

test("resource previews show documents and spreadsheets directly", async () => {
  const resources = await source("src/components/Manage/sections/resources.tsx");
  const css = await source("src/app/globals.css");

  assert.doesNotMatch(resources, /WorkflowMiniMap|resource-preview-workflow/);

  // The document preview shows the document's own lines; most descriptions are
  // blank.
  assert.match(resources, /function documentLines/);
  assert.match(resources, /document_html/);
  // Kept as lines rather than flattened to one run of text: the paragraph
  // breaks are most of what makes a thumbnail read as a page.
  assert.match(resources, /resource-preview-page-head/);
  assert.match(css, /\.resource-preview-page-line/);
  // Clamped before render, not by overflow: putting a whole SOP in the DOM to
  // hide it costs the layout of every card on the page.
  assert.match(resources, /\.slice\(0, 9\)/);

  // A spreadsheet shows its shape. The values are unreadable at this size and
  // printing them anyway is how a preview becomes grey mush.
  assert.match(resources, /function SpreadsheetMiniMap/);
  assert.match(css, /\.resource-preview-sheet-cell/);
});

test("nothing the automation canvas mounts calls useManage()", async () => {
  // The workflow editor has its own route and no ManageProvider, and
  // `useManage()` throws without one. Every component the canvas can mount
  // reads the context optionally.
  for (const file of [
    "src/components/Manage/workflow/workflow-canvas.tsx",
    "src/components/Manage/workflow/message-value-editor.tsx",
    "src/components/Manage/insert-menu.tsx",
    "src/components/Manage/container-flow-builder.tsx",
    "src/components/Manage/emoji-picker.tsx",
    "src/components/Manage/embed-editor.tsx",
    "src/components/Manage/fields.tsx",
  ]) {
    const text = await source(file);
    assert.doesNotMatch(
      text,
      /[^l]useManage\(\)/,
      `${file} calls useManage(), which throws on the provider-less workflow route`,
    );
  }

  // message-design.tsx still has two, and both are module cards that only the
  // manage shell mounts. The editor must not start importing them.
  const messageValue = await source(
    "src/components/Manage/workflow/message-value-editor.tsx",
  );
  // Imports and JSX only — the file names MessageDesignCard in a comment,
  // explaining why it is a separate component rather than a call to it.
  assert.doesNotMatch(messageValue, /^\s*(TemplateBar|MessageDesignCard),$/m);
  assert.doesNotMatch(messageValue, /<(TemplateBar|MessageDesignCard)[\s/>]/);
});

test("the card overflow menu is two verbs, and both of them work", async () => {
  const resources = await source("src/components/Manage/sections/resources.tsx");
  const css = await source("src/app/globals.css");

  // Duplicate and Delete as plain words, without hints, so the menu reads at a
  // glance.
  assert.match(resources, /className="card-menu-item"/);
  assert.match(css, /\.card-menu-item-danger/);
  assert.doesNotMatch(
    resources,
    /new-resource-item-hint">\s*\n\s*A copy of this/,
  );

  // Delete reaches every visible kind, and never without a confirmation.
  assert.match(resources, /function confirmDelete/);
  assert.match(resources, /onDelete=\{\(\) =>/);
  assert.match(resources, /danger: true/);

  assert.doesNotMatch(resources, /api\/manage\/\$\{guildId\}\/(workflows|automations)/);
});

test("a group is a master-switch card only when it says so", async () => {
  const schema = await source("src/components/Manage/schema.ts");
  const section = await source("src/components/Manage/schema-section.tsx");

  // A lead toggle is declared (`group.lead`), not inferred from "first field is
  // a toggle". The guess made "Log joins" the master switch of nine unrelated
  // Game Logs options and hid them when join logging was off.
  assert.match(section, /group\.lead === true && group\.fields\[0\]\?\.type === "toggle"/);

  // `lead` is declared only on groups whose first switch governs the rest.
  // Webhook is one: the bot reads its username and avatar only while "Send as
  // webhook" is on. Named, not counted, because each entry is a claim about
  // that group.
  const GATED = [
    "Scheduled reminders",
    "Staff requests",
    "Webhook",
    // Game Logs is four streams, each with its switch, channel and colour in
    // one group.
    "Join logs",
    "Leave logs",
    "Kill logs",
    "Command logs",
    // The counter's channel and template mean nothing with the switch off,
    // and the appeal form and button label mean nothing without the appeal.
    "On-duty counter",
    "Automatic ER:LC shifts",
    "Appeals",
    "Discussion threads",
    // The ER:LC groups whose first switch turns the feature on: welcome,
    // membership checks, statistics channels and the four enforcement groups.
    "Player welcome",
    "Discord membership checks",
    "Live statistics",
    "Vehicle & livery restrictions",
    "Team restrictions",
    "Weather and time",
    "Username moderation",
  ];
  const declared = [...schema.matchAll(/lead: true,/g)];
  assert.equal(
    declared.length,
    GATED.length,
    "a group declaring lead must be one whose first field governs the rest",
  );
  for (const title of GATED) {
    const at = schema.indexOf(`title: "${title}"`);
    assert.ok(at > -1, `${title} exists`);
    assert.match(
      schema.slice(at, at + 500),
      /lead: true/,
      `${title} gates its fields and must declare it`,
    );
  }

  // A master-switch card draws an icon, a title, a description and a switch, so
  // every gated group needs a description.
  for (const title of GATED.filter((name) => name !== "Webhook")) {
    const at = schema.indexOf(`title: "${title}"`);
    assert.match(
      schema.slice(at, schema.indexOf("fields: [", at)),
      /description:/,
      `group "${title}" draws as a card and needs its description`,
    );
  }
});

test("infraction logs expose optional discussion thread settings", async () => {
  const schema = await source("src/components/Manage/schema.ts");
  assert.match(schema, /"Infraction\.create_thread"/);
  assert.match(schema, /"Infraction\.thread_name"/);
  // Said plainly: the bot needs permission to make threads there.
  assert.match(schema, /The bot needs permission to make threads there\. If it can't, the infraction is still posted\./);
  assert.match(schema, /Case \{case\} · \{staff\.name\}/);
});

test("shift automation and role quotas have real dashboard editors", async () => {
  const schema = await source("src/components/Manage/schema.ts");
  const section = await source("src/components/Manage/schema-section.tsx");
  const special = await source("src/components/Manage/special-fields.tsx");

  for (const path of [
    "Shifts.quota_role_ids",
    "Shifts.role_quotas",
    "Shifts.auto_clock.enabled",
    "Shifts.auto_clock.role_ids",
    "Shifts.auto_clock.start_on_join",
    "Shifts.auto_clock.end_on_leave",
  ]) {
    assert.match(schema, new RegExp(path.replaceAll(".", "\\.")));
  }
  assert.match(section, /case "rolequotas"/);
  assert.match(section, /<RoleQuotaEditor/);
  assert.match(special, /export function RoleQuotaEditor/);
  assert.match(special, /Remove all role quotas/);
  assert.match(special, /onChange\(\[\]\)/);
  assert.match(special, /<RolePicker/);
  assert.match(special, /quota_minutes/);
});

test("a game log stream is one card, not three settings in two places", async () => {
  const schema = await source("src/components/Manage/schema.ts");
  const section = await source("src/components/Manage/schema-section.tsx");
  const games = schema.slice(
    schema.indexOf('id: "game-logs"'),
    schema.indexOf('id: "prc"'),
  );

  // The nine-field grid is gone: every one of its settings now sits with the
  // stream it belongs to, or in the shared group when it applies to all four.
  assert.doesNotMatch(games, /title: "Log appearance and privacy"/);
  assert.doesNotMatch(games, /title: "Destinations"/);

  // Each stream carries its own switch, channel and colour.
  for (const [title, keys] of [
    ["Join logs", ["show_joins", "join_channel_id", "join_color"]],
    ["Leave logs", ["show_leaves", "leave_channel_id", "leave_color"]],
    ["Kill logs", ["show_kills", "kill_channel_id", "kill_color"]],
    ["Command logs", ["show_commands", "command_channel_id", "command_color"]],
  ] as [string, string[]][]) {
    const at = games.indexOf(`title: "${title}"`);
    assert.ok(at > -1, `${title} is a group of its own`);
    const block = games.slice(at, games.indexOf("},\n      {", at));
    for (const key of keys) {
      assert.ok(block.includes(key), `${title} is missing ${key}`);
    }
    // The switch has to be first, or `lead` points at the wrong field and the
    // card's on/off state tracks a path unrelated to what it hides.
    assert.equal(
      block.indexOf(keys[0]),
      Math.min(...keys.map((key) => block.indexOf(key))),
      `${title}'s switch must be its first field`,
    );
  }

  // Every stream has a switch, so silencing one does not mean clearing its
  // channel.
  assert.match(games, /path: "Game Logs\.show_kills"/);
  assert.match(games, /path: "Game Logs\.show_commands"/);

  // A run of lead cards is named for its cards, so nothing said what the run
  // was. The first of the run heads it.
  assert.match(games, /heading: \{\s*title: "Live streams"/);
  assert.match(section, /group\.heading \? \(/);
  assert.match(section, /title=\{group\.heading\.title\}/);
});

test("the node message editor escapes the canvas transform", async () => {
  const editor = await source(
    "src/components/Manage/workflow/message-value-editor.tsx",
  );
  const canvas = await source(
    "src/components/Manage/workflow/workflow-canvas.tsx",
  );
  const css = await source("src/components/Manage/workflow/workflow.css");

  // The node editor panel is portalled out of the canvas: the pan and zoom
  // transform makes the layer the containing block for `position: fixed`, which
  // trapped the scrim and scaled the panel.
  assert.match(canvas, /transform: `translate\(\$\{pan\.x\}px/);
  assert.match(editor, /createPortal\(/);
  assert.match(editor, /document\.body,\s*\)/);

  // A dialog you can still read the workspace through does not look like it is
  // in front of anything.
  assert.match(css, /\.wf-message-scrim \{[\s\S]{0,200}rgba\(4, 4, 5, 0\.78\)/);

  // Escape closes it, and the page behind holds still while it is up.
  assert.match(editor, /event\.key === "Escape"/);
  assert.match(editor, /document\.body\.style\.overflow = "hidden"/);
});

test("panning the canvas pans it instead of selecting it", async () => {
  const canvas = await source(
    "src/components/Manage/workflow/workflow-canvas.tsx",
  );
  const css = await source("src/components/Manage/workflow/workflow.css");

  // The canvas disables text selection and native image drag, which swallowed
  // the pan gesture.
  assert.match(css, /\.wf-canvas \{[\s\S]{0,600}user-select: none;/);
  assert.match(css, /-webkit-user-drag: none;/);
  assert.match(canvas, /onDragStart=\{\(event\) => \{[\s\S]{0,900}event\.preventDefault\(\)/);

  // Inputs opt back in — one you cannot select inside is one you cannot fix a
  // typo in.
  assert.match(css, /\.wf-canvas input,[\s\S]{0,220}user-select: text;/);

  // The pointer is captured, so panning past the edge continues and the
  // pointerup lands here.
  assert.match(canvas, /setPointerCapture\(event\.pointerId\)/);
  assert.match(canvas, /releasePointerCapture\(event\.pointerId\)/);
  assert.doesNotMatch(canvas, /onPointerLeave=\{\(\) => setDrag\(null\)\}/);

  // "Empty canvas" is decided by what is under the pointer, not `event.target
  // === event.currentTarget`: `.wf-surface` covers the whole canvas and is the
  // target nearly everywhere. (The regex is followed by a backtick because the
  // comment above quotes the old test.)
  assert.doesNotMatch(canvas, /=== event\.currentTarget[;)\s]*\)/);
  assert.match(canvas, /!target\.closest\("\.wf-node"\)/);
  assert.match(
    canvas,
    /const wantsPan = spaceHeld \|\| event\.button === 1 \|\| onEmpty;/,
  );

  // Dragging a block does not select its title, but a press inside a port's
  // input is left alone so the input can take focus.
  assert.match(
    canvas,
    /if \(target\.closest\("button, input, textarea, select, a, label"\)\) return;\s*event\.preventDefault\(\);/,
  );

  // 0.35 could not frame a graph of a dozen blocks and a branch, so zooming out
  // ran out while there was plainly more canvas off the edge.
  const min = canvas.match(/const ZOOM_MIN = ([\d.]+)/);
  assert.ok(min, "ZOOM_MIN is declared in one place");
  assert.ok(
    Number(min![1]) <= 0.2,
    `ZOOM_MIN ${min![1]} does not pull back far enough for a real graph`,
  );
});

test("the canvas cursor says what the press will do", async () => {
  const css = await source("src/components/Manage/workflow/workflow.css");
  const canvas = await source(
    "src/components/Manage/workflow/workflow-canvas.tsx",
  );

  // The canvas shows `grab`, since empty canvas pans on a plain drag.
  assert.match(css, /\.wf-canvas \{[\s\S]{0,2200}cursor: grab;/);
  assert.doesNotMatch(css, /\.wf-canvas \{[\s\S]{0,1400}cursor: default;/);

  // Closed hand for as long as it is actually grabbing, from the component's
  // own drag state — `:active` would also fire on a press that becomes a click.
  assert.match(canvas, /data-drag=\{drag\?\.kind \?\? "none"\}/);
  assert.match(css, /\[data-drag="canvas"\][\s\S]{0,200}cursor: grabbing;/);
  assert.match(css, /\[data-drag="node"\] \.wf-node \{\s*cursor: grabbing;/);

  // `grab` is inherited, so everything that is not grabbable sets its own
  // cursor.
  assert.match(css, /\.wf-canvas button:not\(\.wf-dot\),/);
  assert.match(css, /\.wf-canvas input,[\s\S]{0,140}cursor: text;/);
});

test("the roster can be dragged with a finger", async () => {
  const workspace = await source("src/components/Manage/department-workspace.tsx");

  // Rank assignment uses pointer events, not HTML5 drag-and-drop, which never
  // fires on touch.
  assert.doesNotMatch(workspace, /dataTransfer/);
  assert.doesNotMatch(workspace, /draggable=\{canMembers/);
  assert.match(workspace, /onPointerDown=\{\(event\) => \{/);
  assert.match(workspace, /engageDrag\(member\.id, event\.clientX, event\.clientY\)/);

  // A finger moving over a scrollable list means scroll, so touch waits for a
  // hold before picking the row up, and a swipe cancels it.
  assert.match(workspace, /event\.pointerType === "mouse"/);
  assert.match(workspace, /holdTimerRef\.current = setTimeout\(/);
  assert.match(workspace, /travelled > 10/);

  // The drop target is the rank section under the pointer, measured.
  assert.match(workspace, /data-rank-section=\{String\(rank\.id\)\}/);
  assert.match(workspace, /event\.clientY >= box\.top && event\.clientY <= box\.bottom/);

  // Ticking a checkbox must not pick the member up.
  assert.match(workspace, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/);
});

test("a promotion's shout follows the rank it announces", async () => {
  const workspace = await source("src/components/Manage/department-workspace.tsx");

  // The shout's default is computed from the chosen rank, and a Restore default
  // button appears once the text differs from it.
  assert.match(workspace, /function defaultShout\(\)/);
  assert.match(workspace, /setShoutMessage\(\(current\) => current \|\| defaultShout\(\)\)/);
  assert.match(workspace, /onClick=\{\(\) => setShoutMessage\(defaultShout\(\)\)\}/);
  assert.match(workspace, /Restore default/);
  // Offered only when it would do something.
  assert.match(workspace, /\{shoutMessage !== defaultShout\(\) \? \(/);
  // And the old inline template is gone, so there is one definition of it.
  assert.doesNotMatch(workspace, /has been promoted to \$\{rankName\}!`,/);
});

test("a rank shows what it will look like on the roster", async () => {
  const ranks = await source("src/components/Manage/department-ranks.tsx");

  // Colour is a required field on the rank form whose value had no visible
  // consequence until you saved and went to look at the roster.
  assert.match(ranks, /const linkedRole = roleId/);
  assert.match(ranks, /backgroundColor: color \|\| "#f7a8c4"/);
  assert.match(ranks, /\{name\.trim\(\) \|\| "Untitled rank"\}/);
  // The rank shows its linked Discord role and the joining-rank flag, using the
  // shared role swatch.
  assert.match(ranks, /<RoleSwatch color=\{linkedRole\.color\} \/>/);
  assert.match(ranks, /\{joinRank \? \(/);
});

test("an infraction says where it lands the member before it is issued", async () => {
  const workspace = await source("src/components/Manage/department-workspace.tsx");

  // Issuing points shows the new total and any escalation stage it reaches.
  assert.match(workspace, /const newTotal = \(first\?\.points \|\| 0\) \+ added;/);
  assert.match(workspace, /stages\?: PointsSystem\["stages"\];/);
  assert.match(workspace, /stages=\{\(feature\.points_system as PointsSystem \| undefined\)\?\.stages \|\| \[\]\}/);

  // The stage this infraction reaches, not merely one the member already
  // passed -- otherwise every later infraction re-announces the same warning.
  assert.match(workspace, /\.filter\(\(stage\) => newTotal >= \(Number\(stage\.points\) \|\| 0\)\)/);
  assert.match(
    workspace,
    /const crossed =\s*triggered && \(first\?\.points \|\| 0\) < \(Number\(triggered\.points\) \|\| 0\)/,
  );

  // Several members start from different totals, so one banner cannot
  // honestly speak for all of them.
  assert.match(workspace, /targets\.length === 1 && added > 0/);

  // A termination announcing itself in the same grey as a note is the failure
  // the banner exists to prevent.
  assert.match(workspace, /an automatic termination\./);
  assert.match(workspace, /crossed\.type === "warning"/);
});

test("the variable picker says what a variable turns into", async () => {
  const registry = await source("src/config/variable-registry.ts");
  const editor = await source("src/components/Manage/embed-editor.tsx");

  // Variables are listed with their descriptions visible, not as chips with
  // hover text.
  assert.match(editor, /section\.items\.map\(\(item\) => \(/);
  assert.doesNotMatch(editor, /title=\{item\.description \? `\$\{item\.key\} — /);
  assert.match(editor, /\{item\.example \? \(/);
  assert.match(editor, /→ \{item\.example\}/);
  // Falls back to the description where there is no example, rather than
  // showing a bare token again.
  assert.match(editor, /\) : item\.description \? \(/);

  // Examples are partial on purpose: a name or a reason has no fixed shape, and
  // an invented example would read as a promise about format.
  assert.match(registry, /export const VARIABLE_EXAMPLES: Record<string, string>/);
  assert.match(registry, /"\{timestamp\.relative\}": "2 hours ago"/);
  assert.match(registry, /"\{guild\.members\}": "1204"/);

  // Pins two mistakes from the first draft: `{guild.membercount}` does not
  // exist and `{user.mention}` is not resolved globally. The bot's suite checks
  // the rest against the real resolver. Scoped to the examples block, since
  // `{user.mention}` is a legitimate Shared entry.
  const examplesBlock = registry.slice(
    registry.indexOf("export const VARIABLE_EXAMPLES"),
    registry.indexOf("};", registry.indexOf("export const VARIABLE_EXAMPLES")),
  );
  assert.ok(examplesBlock.length > 200, "the examples block should be found");
  assert.doesNotMatch(examplesBlock, /\{guild\.membercount\}/);
  assert.doesNotMatch(examplesBlock, /"\{user\.mention\}"/);
  // The description survives.
  assert.match(registry, /"\{user\.mention\}": "Invoking user mention"/);

  // Attached in one place, so a variable that gains a known output is one
  // line here and not a hunt through the groups for its row.
  assert.match(registry, /example: VARIABLE_EXAMPLES\[key\]/);
});

test("the roster drag lifts the row above the ranks below it", async () => {
  const workspace = await source("src/components/Manage/department-workspace.tsx");

  // The dragged row is drawn outside the section: the section scrolls
  // horizontally (clipping the other axis), and sections paint in document
  // order, so the next one covered it whatever its z-index.
  assert.match(
    workspace,
    /rankMembers\.some\(\(member\) => member\.id === dragMemberId\)\s*\?\s*"relative z-40 overflow-visible"\s*:\s*"overflow-x-auto"/,
  );
  // Only the section holding the dragged row is lifted; the rest keep their
  // horizontal scroll.
  assert.match(workspace, /"overflow-x-auto"/);
});

test("an empty activity column does not read as a failure", async () => {
  const workspace = await source("src/components/Manage/department-workspace.tsx");

  // A red cross said "something is wrong here" about somebody who simply has
  // not been on shift this wave, which is most of a roster on a Monday.
  assert.doesNotMatch(workspace, /<IconX size=\{13\} className="text-red-300\/70" \/>/);
  assert.match(workspace, /No time yet/);
  // Time logged still reads as a positive.
  assert.match(workspace, /<IconCheck size=\{13\} className="text-\[var\(--tone-ok\)\]" \/>/);
});

test("the roster names its columns once, not once per rank", async () => {
  const workspace = await source("src/components/Manage/department-workspace.tsx");

  // The column captions are full strength only on the first rank and faint on
  // the rest.
  assert.match(
    workspace,
    /rankIndex === 0 \? "text-white\/35" : "text-white\/\[0\.14\]"/,
  );
  // The header row is still in every section: each section scrolls on its own,
  // and screen readers need the headers per table.
  assert.match(workspace, /className=\{`roster-head grid min-w-\[720px\]/);
});

test("a wire can be disconnected", async () => {
  const canvas = await source("src/components/Manage/workflow/workflow-canvas.tsx");
  const css = await source("src/components/Manage/workflow/workflow.css");

  // A wire can be removed by double-clicking it.
  assert.match(canvas, /function removeEdge\(id: string\)/);
  assert.match(canvas, /onDoubleClick=\{\(event\) => \{[\s\S]{0,120}removeEdge\(edge\.id\)/);

  // Wires are reachable: a transparent wide stroke over each curve is the hit
  // target.
  assert.doesNotMatch(canvas, /<svg className="wf-edges" aria-hidden>/);
  assert.match(css, /\.wf-edge-hit \{[\s\S]{0,200}stroke-width: 16;/);
  assert.match(css, /pointer-events: stroke;/);
  // The layer itself still refuses the pointer, or it would swallow every pan.
  assert.match(css, /\.wf-edges \{[\s\S]{0,400}pointer-events: none;/);
});

test("right-clicking the canvas does something useful", async () => {
  const canvas = await source("src/components/Manage/workflow/workflow-canvas.tsx");

  // A node editor is the one surface where the browser's own menu is useless:
  // no text to copy, no image to save. Right-click offered Reload and nothing.
  assert.match(canvas, /function WorkflowContextMenu/);
  for (const kind of ['"canvas"', '"node"', '"edge"']) {
    assert.match(canvas, new RegExp(`kind: ${kind}`), `${kind} menu missing`);
  }
  // Add where you are looking, rather than from the palette and then dragged.
  assert.match(canvas, /Add a block here/);
  // Disconnect without losing the block or what was typed into it.
  assert.match(canvas, /Disconnect all wires/);
  // Closed by any press outside the menu, or Escape. `onClose` is read through
  // a ref because the parent passes it inline and the canvas re-renders on
  // pointer movement.
  assert.match(canvas, /closest\?\.\("\[data-wf-menu\]"\)/);
  assert.match(canvas, /closeRef\.current\(\)/);
  assert.match(canvas, /const closeRef = useRef\(onClose\)/);

  // A press on a wire does not pan; capturing the pointer would swallow the
  // double-click's second click.
  assert.match(canvas, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}\s*\n\s*onPointerEnter=\{\(\) => setHoverEdge/);
});

test("the AI blocklist can be added to from the dashboard", async () => {
  const section = await source("src/components/Manage/sections/gator-ai.tsx");

  // Members can be added to the blocklist here, not only removed.
  assert.match(section, /aria-label="Find a member to block"/);
  assert.match(section, /blocked_users: \[\s*\.\.\.\(draft\.blocked_users \|\| \[\]\),/);
  // The same /meta the sharing panel reads, rather than a second endpoint that
  // would have to agree with it.
  assert.match(section, /\/api\/manage\/\$\{guildId\}\/meta/);
  // A reason travels with the block, matching what /ai block stores.
  assert.match(section, /placeholder="Reason \(optional\)"/);
  // Somebody already blocked is not offered again.
  assert.match(section, /already\.has\(String\(person\.id\)\)/);
  /* The rows are drawn from the draft, so the row appears at once and a
     discarded block goes away with everything else the save prompt puts
     back (it used to stay listed after Discard). */
  assert.match(section, /return \(draft\?\.blocked_users \|\| \[\]\)\.map\(\(item\) => \{/);
  assert.doesNotMatch(section, /setBlocked\(/);
  // Both fields are the window's one text field, so they match.
  assert.match(section, /<label className="gw-field gw-ai-search">/);
  const restyle = await source("src/components/Manage/manage-restyle.css");
  assert.match(restyle, /:not\(\[data-bare\] \*\):not\(\.gw-field\),/);
  // And the empty state stops implying Discord is the only way in.
  assert.doesNotMatch(section, /Staff can block someone with/);
});

test("opening /manage does not pay for the member list", async () => {
  const route = await source("src/app/api/manage/[id]/meta/route.ts");
  const cacheKeys = await source("src/utils/manage-cache.ts");
  const share = await source("src/components/Manage/share-access-panel.tsx");
  const ai = await source("src/components/Manage/sections/gator-ai.tsx");

  // Members are returned only when asked for (`?members`): sorting and sending
  // a large guild's whole membership on every /manage load was what made big
  // servers slow.
  assert.match(route, /const withMembers = new URL\(request\.url\)\.searchParams\.has\("members"\)/);
  assert.match(route, /\.\.\.\(withMembers \? \{ members: "1" \} : \{\}\)/);

  // The cache key varies with it, so a picker asking for members is not served
  // the memberless copy.
  assert.match(cacheKeys, /withMembers \? ":members" : ""/);

  // Only the two surfaces that show people ask for them.
  assert.match(share, /\/meta\?members=1/);
  assert.match(ai, /\/meta\?members=1/);
});

test("the manage page and its sticky headers are the same colour", async () => {
  const page = await source("src/app/manage/[id]/[[...section]]/page.tsx");
  const css = await source("src/app/globals.css");

  assert.doesNotMatch(page, /bg-\[#0a0a0a\]/);
  assert.match(css, /color-mix\(in srgb, var\(--gator-canvas\) 94%, transparent\)/);
});

test("a dashboard that will not load is not a dead end", async () => {
  const shell = await source("src/components/Manage/manage-shell.tsx");
  const context = await source("src/components/Manage/manage-context.tsx");

  // The load error screen has a way back to the server list.
  assert.match(shell, /href="\/servers"[\s\S]{0,300}All servers/);
  assert.match(shell, /\{forbidden \? null : \(/);

  // Try again re-runs the fetches past the cache instead of reloading the page.
  assert.doesNotMatch(shell, /window\.location\.reload\(\)/);
  assert.match(shell, /onClick=\{reload\}/);
  assert.match(context, /reload: \(\) => void;/);
  assert.match(context, /setAttempt\(\(current\) => current \+ 1\)/);
  // Forced, or the retry is served the client cache's copy of the failure.
  assert.match(context, /force: attempt > 0/);
});

test("a bot that never answers becomes an error, not a permanent skeleton", async () => {
  const context = await source("src/components/Manage/manage-context.tsx");

  // Loading has a timeout, so it ends in an error instead of a skeleton
  // forever.
  assert.match(context, /const LOAD_TIMEOUT_MS = \d+;/);
  // Raced rather than aborted: the shared cache can return a promise someone
  // else started, and aborting would not cancel it.
  assert.match(context, /await Promise\.race\(\[/);
  assert.match(context, /error\.name = "TimeoutError"/);
  // The loser of a race rejects after nobody is looking, and an unobserved
  // rejection is an unhandled one.
  assert.match(context, /expired\.catch\(\(\) => \{\}\)/);
  assert.match(context, /caught\.name === "TimeoutError"/);
});

test("the rank ladder is ordered, and says which end is the bottom", async () => {
  const schema = await source("src/components/Manage/schema.ts");
  const fields = await source("src/components/Manage/special-fields.tsx");
  const section = await source("src/components/Manage/schema-section.tsx");

  // The promotion ladder is the stored order of this list. Both promotion and
  // demotion walk it (promotion used to sort by Discord role position).
  const ladderField = schema.slice(
    schema.indexOf('path: "Promo.System.single.Hierarchy"'),
    schema.indexOf('path: "Promo.System.multi.Departments"'),
  );
  // Checked against the field's description only, since the comment above
  // quotes the old wording.
  assert.doesNotMatch(
    ladderField.split("description:")[1] || "",
    /resolved from Discord/,
  );
  assert.match(ladderField, /type: "ladder"/);
  assert.match(ladderField, /lowest first/);

  // Orderable, or the order it now depends on cannot be set.
  assert.match(fields, /export function RankLadderField/);
  assert.match(fields, /\[next\[index\], next\[target\]\] = \[next\[target\], next\[index\]\]/);
  // Drawn highest-first because that is how a hierarchy reads, while the
  // stored list stays lowest-first — the order the bot steps through.
  assert.match(fields, /\[\.\.\.value\]\.reverse\(\)/);
  assert.match(fields, /const index = value\.length - 1 - reversedIndex;/);
  // A deleted role still shows, or a ladder silently loses a rung.
  assert.match(fields, /A role that was deleted/);

  assert.match(section, /case "ladder":/);
  assert.match(section, /<RankLadderField/);
});

test("an infraction says whether the member was actually told", async () => {
  const detail = await source("src/app/panel/[id]/[infid]/infraction-detail.tsx");

  // The case says whether the member was told: Discord refuses a DM when the
  // member has server DMs off.
  assert.match(detail, /infraction\.notified === true \?/);
  assert.match(detail, /their DMs are closed to this server/);
  assert.match(detail, /no longer in the server/);

  // Older cases have no value and show nothing.
  assert.match(detail, /infraction\.notified === false \? \([\s\S]{0,900}\) : null/);
});

test("opening a settings tab never marks it dirty by itself", async () => {
  const design = await source("src/components/Manage/message-design.tsx");

  // No adopt-on-mount effect: writing the implicit container into the draft
  // during load raised the save prompt on untouched pages.
  assert.doesNotMatch(design, /onChangeRef\.current\(adopted\)/);

  // The baseline keeps `v2_explicit_layout`, so a draft with it can match the
  // saved copy.
  assert.match(design, /v2_explicit_layout: Boolean\(doc\.v2_explicit_layout\)/);
  // And the comparison was raw JSON.stringify, which is key-order sensitive:
  // two objects meaning the same thing compared unequal.
  assert.match(design, /export function sameMessage/);
  assert.match(design, /return !sameMessage\(/);
  assert.match(design, /Object\.keys\(value as object\)\.sort\(\)/);
});

test("a tab guard warns once and then lets you leave", async () => {
  const shell = await source("src/components/Manage/manage-shell.tsx");

  // When leaving is blocked, the shell remembers the target so you can go on
  // after saving or discarding; a guard that only shakes is a trap when `dirty`
  // is wrong.
  assert.match(shell, /blockedTargetRef/);
  assert.match(shell, /if \(blockedTargetRef\.current !== next\)/);
  assert.match(shell, /pick the tab again to leave/);
});

test("an infraction type's card edits everything the type actually does", async () => {
  const card = await source("src/components/Manage/sections/infraction-hierarchy.tsx");

  // The card offers every action the bot takes per type (roles given and
  // removed, demotion and more), not only Demote.
  assert.match(card, /given_roles/);
  assert.match(card, /removed_roles/);
  assert.match(card, /change_group_role/);
  assert.match(card, /staff_database_removal/);
  assert.match(card, /label="Announce in"/);
  assert.match(card, /export function typeSummary/);
  // A type that does nothing says so, rather than describing what it does not
  // do to a rank.
  assert.match(card, /Records the infraction and nothing else\./);
  // A bot that predates these fields returns the narrower shape; the card must
  // not blank itself on `undefined.length`.
  assert.match(card, /given_roles: \[\],[\s\S]{0,300}\.\.\.type,/);
});

test("escalation with nowhere to go is named before it happens", async () => {
  const behaviour = await source("src/components/Manage/ticket-ai-behaviour.tsx");

  // The handover channel says what happens when none is set (handovers are
  // posted in the ticket).
  assert.match(behaviour, /None set, so handovers are posted in the ticket itself/);
  assert.match(behaviour, /!draft\.escalation_channel_id && !routes\.length/);
  // Under the channel field it is about, not as a band across the panel's
  // first column, which cut it off halfway along its second line.
  const channel = behaviour.indexOf('title="Handover channel"');
  const warn = behaviour.indexOf('className="gw-tk-warn"');
  assert.ok(channel > 0 && warn > channel && warn - channel < 1600, "the warning is not under the channel field");
});

test("a short count is set with a minus and a plus, not typed into a box", async () => {
  const fields = await source("src/components/Manage/fields.tsx");
  const behaviour = await source("src/components/Manage/ticket-ai-behaviour.tsx");
  const css = await source("src/components/Manage/manage-window.css");
  assert.match(fields, /export function Stepper\(/);
  assert.match(fields, /disabled=\{value <= min\}/);
  assert.match(fields, /disabled=\{value >= max\}/);
  assert.match(fields, /\{value === 1 \? unit\[0\] : unit\[1\]\}/);
  // The number rolls the way it moved, and not at all when the page opens.
  assert.match(fields, /const dir = value > last\.current \? "up" : value < last\.current \? "down" : undefined;/);
  assert.match(css, /\.gw-stepper-num\[data-dir="up"\] \{\s*animation: gw-step-up/);
  assert.match(behaviour, /<Stepper\s+label="Replies before handing over"\s+min=\{1\}\s+max=\{10\}\s+unit=\{\["reply", "replies"\]\}/);
  assert.doesNotMatch(behaviour, /<input\s+type="number"/);
});

test("the browser cannot leave a dialog scrolled with no way back", async () => {
  const guard = await source("src/app/components/overflow-scroll-guard.tsx");
  const layout = await source("src/app/layout.tsx");

  // Focusing a control inside an `overflow-hidden` dialog makes the browser
  // scroll that hidden container to reveal it, and nothing scrolls it back. The
  // guard resets such scrolls.
  assert.match(guard, /export function OverflowScrollGuard/);
  assert.match(guard, /addEventListener\("scroll", onScroll, true\)/);
  assert.match(guard, /style\.overflowY === "hidden"\) target\.scrollTop = 0/);

  // Global, because nine dialogs have that shape and the next one would too.
  assert.match(layout, /<OverflowScrollGuard \/>/);

  // A WeakSet lookup on the hot path, since this sees every scroll event in the
  // app.
  assert.match(guard, /new WeakSet<Element>\(\)/);
  assert.match(guard, /if \(scrollable\.has\(target\)\) return;/);
});

test("a permissions dialog says why it will not save yet", async () => {
  const permissions = await source("src/components/Manage/sections/permissions.tsx");

  // The button says what is missing to save the role.
  assert.match(permissions, /To save this role, \{missing\.map/);
  // Not disabled, so pressing it can take you to the missing field. The
  // lookbehind avoids matching `aria-disabled`, which the fix uses.
  assert.doesNotMatch(permissions, /(?<!aria-)disabled=\{!valid\}/);
  assert.match(permissions, /aria-disabled=\{!valid\}/);
  assert.match(permissions, /: showFirstMissing\(\)/);
  assert.match(permissions, /scrollIntoView\(\{ behavior: "smooth", block: "center" \}\)/);
});

test("a custom role is described as data, not a Discord role", async () => {
  const permissions = await source("src/components/Manage/sections/permissions.tsx");

  // Says that a custom role names existing Discord roles and does not create
  // one.
  assert.match(permissions, /does not make a role in your server/);
});

/* ── A setting pointing at something Discord no longer has ──

   When a stored channel or role id is missing from `meta.channels` or
   `meta.roles`, the card that holds it says so. Otherwise a deleted log channel
   just stops logging and nobody notices. */

test("a deleted channel or role is named on the card that holds it", async () => {
  const health = await source("src/components/Manage/config-health.ts");
  const section = await source("src/components/Manage/schema-section.tsx");

  // Asked of the field types whose value is a Discord id, and of no others.
  assert.match(health, /type === "channel" \|\| type === "channels"/);
  assert.match(health, /type === "role" \|\| type === "roles" \|\| type === "ladder"/);
  // Every id-bearing card asks.
  assert.match(section, /const problem = fieldProblem\(field\.type, current, meta\)/);
  assert.ok(
    (section.match(/problem=\{problem\}/g) || []).length >= 10,
    "most id-bearing fields are not asking",
  );
  // And the card says what is wrong rather than only going amber.
  assert.match(section, /\{problem\.tag\}/);
  assert.match(section, /\{problem\.detail\}/);
});

test("nothing is flagged while the live lists are still loading", async () => {
  // An empty `meta` means still loading, not a server with no channels, so
  // nothing is flagged.
  const health = await source("src/components/Manage/config-health.ts");
  assert.match(health, /channels\?\.length/);
  assert.match(health, /roles\?\.length/);
});

test("there is no separate page of broken settings", async () => {
  // Shown on the card itself, not in a separate list.
  const section = await source("src/components/Manage/schema.ts");
  assert.doesNotMatch(section, /id: "health"|id: "diagnostics"/);
});

/* ── Light mode, on the values the dashboard actually uses ──

   Components use a fixed scale of surface and border alphas, and every step of
   the scale has a light-mode override. This checks the two agree, so a new step
   cannot stay a white wash on cream. */

test("every surface step the components use has a light-mode colour", async () => {
  const css = await source("src/app/globals.css");
  const manage = await import("node:fs/promises").then((fs) =>
    fs.readdir(new URL("../src/components/Manage", import.meta.url), {
      recursive: true,
    }),
  );
  const files = (manage as string[]).filter((name) => name.endsWith(".tsx"));
  const used = new Set<string>();
  for (const name of files) {
    const text = await source(`src/components/Manage/${name}`);
    for (const match of text.matchAll(/bg-white\/\[0\.0(\d)\]/g)) used.add(match[1]);
  }
  assert.ok(used.size > 0, "found no surfaces at all — the scan is broken");
  // The scale, and nothing outside it.
  assert.deepEqual([...used].sort(), ["2", "4", "6", "8"]);
  for (const step of used) {
    assert.match(
      css,
      new RegExp(`\\[data-theme="light"\\][^{]*bg-white\\\\/\\\\\\[0\\\\.0${step}\\\\\\]`),
      `bg-white/[0.0${step}] has no light-mode override`,
    );
  }
});

test("the one border step has a light-mode colour", async () => {
  const css = await source("src/app/globals.css");
  assert.match(css, /\[data-theme="light"\][^{]*border-white\\\/\\\[0\\\.08\\\]/);
});

test("text is never both tiny and faint at once", async () => {
  /* Text contrast, computed against this page's background:

       text-white/25 on #0d0d0f  =  2.18:1
       text-white/35             =  3.17:1
       text-white/45             =  4.52:1   <- the first step that passes

     4.5:1 is the floor for body text. Icons at 25% are left alone (a grip
     handle should recede); small text at 25% is not. */
  const fs = await import("node:fs/promises");
  const names = (await fs.readdir(
    new URL("../src/components/Manage", import.meta.url),
    { recursive: true },
  )) as string[];

  const offenders: string[] = [];
  for (const name of names.filter((item) => item.endsWith(".tsx"))) {
    const text = await source(`src/components/Manage/${name}`);
    text.split("\n").forEach((line, index) => {
      const tiny = /text-\[1[01]px\]/.test(line);
      const faint = /text-white\/(20|25|30|35|40)\b/.test(line);
      if (tiny && faint) offenders.push(`${name}:${index + 1}`);
    });
  }
  assert.deepEqual(offenders, [], `unreadable text at:\n  ${offenders.join("\n  ")}`);
});

test("a section heading is one definition, not six copies", async () => {
  // One shared class for the card surface, used by `SettingsCard` and the
  // places that wrote the same classes by hand.
  const fields = await source("src/components/Manage/fields.tsx");
  assert.match(fields, /export function SectionLabel/);
  // The hand-written tabs' cards take their heading from the same panel head
  // the schema groups draw, so one definition covers both.
  assert.match(fields, /<span className="gw-set-head-name">\{title\}<\/span>/);

  const fs = await import("node:fs/promises");
  const names = (await fs.readdir(
    new URL("../src/components/Manage", import.meta.url),
    { recursive: true },
  )) as string[];
  const copies: string[] = [];
  for (const name of names.filter((item) => item.endsWith(".tsx"))) {
    const text = await source(`src/components/Manage/${name}`);
    if (/<h3 className="text-sm font-bold uppercase tracking-\[0\.14em\]/.test(text)) {
      copies.push(name);
    }
  }
  assert.deepEqual(copies, [], `hand-rolled section headings at: ${copies.join(", ")}`);
});

test("nothing suppresses the focus ring without replacing it", async () => {
  /* The stylesheet provides one:

       :where(a, button, [role="button"], [tabindex]):focus-visible {
         outline: 2px solid var(--gator-accent);
       }

     `:where()` has zero specificity, so a class like `outline-none` beats it. A
     control that removes the outline must draw its own focus state. Form fields
     are exempt: they move their border on focus. */
  const fs = await import("node:fs/promises");
  const names = (await fs.readdir(
    new URL("../src/components/Manage", import.meta.url),
    { recursive: true },
  )) as string[];

  const blind: string[] = [];
  for (const name of names.filter((item) => item.endsWith(".tsx"))) {
    const text = await source(`src/components/Manage/${name}`);
    const lines = text.split("\n");
    lines.forEach((line, index) => {
      if (!line.includes("outline-none")) return;
      const window = lines.slice(Math.max(0, index - 6), index + 7).join("\n");
      const replaced =
        window.includes("focus-visible:") ||
        window.includes("focus:border") ||
        window.includes("focus:ring");
      const isField = /<(input|textarea|select)\b/.test(window);
      if (!replaced && !isField) blind.push(`${name}:${index + 1}`);
    });
  }
  assert.deepEqual(blind, [], `no focus indicator at:\n  ${blind.join("\n  ")}`);
});

/* ── Calmer: fewer hues, one spacing scale, motion everywhere ──

   Four hues, each with a meaning: brand, destructive, warning, success. Other
   Tailwind colours (sky, orange) are not used in the dashboard. */

test("the palette is four hues that each mean something", async () => {
  const fs = await import("node:fs/promises");
  const names = (await fs.readdir(
    new URL("../src/components/Manage", import.meta.url),
    { recursive: true },
  )) as string[];
  const strays: string[] = [];
  for (const name of names.filter((item) => item.endsWith(".tsx"))) {
    const text = await source(`src/components/Manage/${name}`);
    for (const match of text.matchAll(
      /\b(?:text|bg|border|ring)-(sky|orange|violet|purple|cyan|indigo|teal|pink|fuchsia|lime|blue|green|yellow)-\d/g,
    )) {
      strays.push(`${name} → ${match[1]}`);
    }
  }
  assert.deepEqual(strays, [], `hues outside the palette:\n  ${strays.join("\n  ")}`);
});

test("spacing has no half-steps", async () => {
  // A scale is 4 / 8 / 12 / 16 / 24. The values between exist because somebody
  // nudged one thing once and the next person matched the nudge.
  const fs = await import("node:fs/promises");
  const names = (await fs.readdir(
    new URL("../src/components/Manage", import.meta.url),
    { recursive: true },
  )) as string[];
  const halves: string[] = [];
  for (const name of names.filter((item) => item.endsWith(".tsx"))) {
    const text = await source(`src/components/Manage/${name}`);
    for (const match of text.matchAll(
      /\b(gap|gap-x|gap-y|space-y|space-x|p|px|py|pt|pb|pl|pr|m|mt|mb|ml|mr)-\d\.5\b/g,
    )) {
      halves.push(`${name} → ${match[0]}`);
    }
  }
  assert.deepEqual(halves, [], `half-steps:\n  ${halves.join("\n  ")}`);
});

test("interactive elements ease by default", async () => {
  const css = await source("src/app/globals.css");
  // Zero-specificity on purpose: a floor, not a rule — any component naming
  // its own transition still wins.
  assert.match(css, /:where\(a, button, \[role="button"\][^)]*\) \{\s*transition:/);
  // Only the properties a hover changes. `all` would catch layout too and turn
  // a reflow into a slide.
  assert.doesNotMatch(css, /:where\(a, button[^{]*\{\s*transition: all/);
  // And somebody who asked their system for less movement asked here too.
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("loading states are the shape of what they become", async () => {
  const empty = await source("src/components/Manage/empty-state.tsx");
  // In globals.css, not the manage sheet: these render outside the manage
  // shell too, and that sheet is only imported by the shell.
  const css = await source("src/app/globals.css");

  // A skeleton row carries the real card's border, radius and minimum height,
  // so the swap when data lands is invisible rather than a settle.
  assert.match(css, /\.gator-skeleton-row \{[^}]*border-radius: var\(--manage-radius-card, [^)]*\)/s);
  assert.match(css, /\.gator-skeleton-row \{[^}]*min-height:/s);

  // One announcement for the whole wait. Marking each bar would read the
  // skeleton out row by row, which is six announcements of nothing.
  assert.match(empty, /role="status"[\s\S]{0,120}aria-busy="true"/);
  assert.match(empty, /<span className="sr-only">\{label\}<\/span>/);
  assert.match(empty, /className="gator-skeleton-row" aria-hidden="true"/);

  // The tint comes from the text colour, not a white wash: `bg-white/[0.04]`
  // is a grey box on the dark panel and nothing at all on the cream one.
  assert.match(css, /\.gator-skeleton-bar \{[^}]*color-mix\(in srgb, var\(--manage-text, /s);

  // The shape is the point, not the shimmer.
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.gator-skeleton-bar \{\s*animation: none/);

  // No hand-rolled skeletons in the dashboard; all use the shared one.
  const files = await collectSourceFiles(path.join(root, "src/components/Manage"));
  const rolled: string[] = [];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    for (const match of text.matchAll(/animate-pulse[^"'`]*/g)) {
      rolled.push(`${path.relative(root, file)} → ${match[0].trim()}`);
    }
  }
  assert.deepEqual(rolled, [], `hand-rolled skeletons:\n  ${rolled.join("\n  ")}`);
});

test("every status in the dashboard is one of five tones", async () => {
  // The status tokens live in globals.css: status colours also render outside
  // the manage shell (department pages, the application form).
  const css = await source("src/app/globals.css");
  const tokens = css;

  // Both themes: dark uses the 300s and light the 700s, so a green stays the
  // same green and legible on either.
  for (const tone of ["ok", "warn", "bad", "info", "idle"]) {
    for (const tier of ["", "-soft", "-wash", "-line"]) {
      assert.match(
        tokens,
        new RegExp(`--tone-${tone}${tier}:`),
        `dark --tone-${tone}${tier}`,
      );
    }
  }
  const light = tokens.slice(tokens.indexOf(':root[data-theme="light"] {'));
  for (const tone of ["ok", "warn", "bad", "info", "idle"]) {
    for (const tier of ["", "-soft", "-wash", "-line"]) {
      assert.match(
        light,
        new RegExp(`--tone-${tone}${tier}:`),
        `light --tone-${tone}${tier}`,
      );
    }
  }

  // One padding for every pill. The 2/1 and 3/1 spellings sat side by side in
  // the department workspace and read as two different components.
  const pill = css.match(/\.gator-pill \{[^}]*\}/s)?.[0] ?? "";
  assert.match(pill, /border-radius: 999px/);
  assert.match(pill, /padding: 0\.2rem 0\.6rem/);

  // Live state gets a halo, not a blink, so a row of dots stays on one
  // baseline while one of them is running.
  assert.match(css, /\.gator-dot-live::after \{[^}]*animation: gatorDotPulse/s);

  // Status colour comes from the tokens, not Tailwind steps. The landing is
  // exempt: its mockups draw Discord's own interface colours.
  const files = (await collectSourceFiles(path.join(root, "src"))).filter(
    (file) =>
      !file.includes(`${path.sep}Landing${path.sep}`) &&
      !file.endsWith(`${path.sep}indicator.tsx`),
  );
  const adhoc: string[] = [];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    for (const match of text.matchAll(
      /\b[a-z]+-(?:emerald|amber|rose|red|green|yellow|lime|teal|orange)-\d{2,3}(?:\/\[?[\d.]+\]?)?/g,
    )) {
      adhoc.push(`${path.relative(root, file)} → ${match[0]}`);
    }
  }
  assert.deepEqual(adhoc, [], `ad-hoc status colours:\n  ${adhoc.join("\n  ")}`);
});

test("a phone gets the touch layer, not just the dashboard", async () => {
  const css = await source("src/app/globals.css");
  const layout = await source("src/app/layout.tsx");

  // Fields are at least 16px on touch screens: Mobile Safari zooms on focus
  // below that and does not zoom back out.
  assert.match(
    css,
    /@media \(pointer: coarse\) and \(max-width: 900px\) \{[^@]*font-size: max\(16px, var\(--field-font-size, 0px\)\) !important/s,
  );

  // The touch layer is site-wide, not only inside `.manage-root`: the form,
  // /panel, the department portal and the join flow are what members open on a
  // phone.
  const manage = await source("src/components/Manage/manage-restyle.css");
  assert.match(manage, /@media \(pointer: coarse\)[^@]*min-height: 2\.75rem/s);
  // 36 drawn: the box a thumb sees, with the controls that can reach past
  // their edge doing so on their own.
  assert.match(css, /@media \(pointer: coarse\) and \(max-width: 900px\)[^@]*min-height: 2\.25rem/s);
  // An icon-only button is as wide as its icon, so a height floor alone leaves
  // a 44x20 target.
  assert.match(css, /button:has\(> svg:only-child\)[^{]*\{\s*min-width: 2\.25rem/s);

  // env(safe-area-inset-*) resolves to 0 without this, so the landing nav was
  // already asking for the top inset and silently getting nothing.
  assert.match(layout, /viewport-fit=cover/);
  assert.match(css, /\.safe-bottom \{[^}]*env\(safe-area-inset-bottom\)/s);

  // The one control that commits your changes sat 20px off the bottom of a
  // device whose home indicator claims 34px.
  const saveBar = await source("src/components/Manage/save-bar.tsx");
  const win = await source("src/components/Manage/manage-window.css");
  assert.match(saveBar, /className="gw-save-layer safe-bottom"/);
  assert.match(win, /\.gw-save-layer \{[^}]*position: fixed;[^}]*bottom: 0;/);
});

test("the ER:LC tabs each name something different", async () => {
  const section = await source("src/components/Manage/schema-section.tsx");

  // A tab with a single group hides the group's title, which only restated the
  // tab.
  assert.match(section, /hideTitle=\{visibleGroups\.length === 1\}/);
  assert.match(section, /hideTitle\?: boolean;/);
  // The sentence survives the heading: the description says what the settings
  // do, and a tab label does not.
  assert.match(section, /gw-set-lede/);

  // "Configuration" divided nothing -- every tab here is configuration.
  assert.doesNotMatch(section, /id: "configuration"/);
  assert.match(section, /id: "server",\s*label: "Server"/);
  assert.match(section, /label: "Vehicles & Liveries"/);

  // Live statistics sit on the server tab, beside the "Enable advanced tools"
  // switch that gates them.
  const serverTab = section.slice(
    section.indexOf('id: "server"'),
    section.indexOf('id: "weather"'),
  );
  assert.match(serverTab, /"Advanced tools"/);
  assert.match(serverTab, /"Live statistics"/);
  assert.doesNotMatch(section, /label: "Player Validation"/);

  // The connection status sits above the sections, since nothing else works
  // until it does.
  assert.match(section, /<ErlcStatus compact \/>/);
  assert.doesNotMatch(section, /current\.id === "server" \? <ErlcStatus/);

  // Each section in the rail has an icon and a line saying what is in it.
  assert.match(section, /PRC_TAB_META/);
  assert.match(section, /className="prc-rail-item"/);
  assert.match(section, /className="prc-rail-blurb"/);

  const css = await source("src/components/Manage/manage-restyle.css");
  // On a wide screen the rail sits beside the settings and is sticky.
  assert.match(css, /@media \(min-width: 1100px\)[^@]*\.prc-shell \{[^}]*grid-template-columns/s);
  assert.match(css, /@media \(min-width: 1100px\)[^@]*\.prc-rail \{[^}]*position: sticky/s);
  // Folds back to a scroller below the desk, where a vertical rail would be
  // most of the screen.
  assert.match(css, /\.prc-rail \{[^}]*overflow-x: auto/s);
});

test("the plain button is called a button", async () => {
  const messageDesign = await source("src/components/Manage/message-design.tsx");

  // The ordinary button is labelled "Button", like the other entries that say
  // what you get.
  assert.match(messageDesign, /value: "button",\s*label: "Button",/);
  assert.doesNotMatch(messageDesign, /label: "Action Flow"/);
  // And the heading over its step list says what the steps are for rather
  // than repeating the jargon.
  assert.doesNotMatch(messageDesign, />\s*Action Flow\s*</);

  // One row-actions control per block, with readable icons, instead of five
  // faint buttons.
  assert.match(messageDesign, /className="gator-row-action"/);
  assert.match(messageDesign, /className="gator-row-action gator-row-action-danger"/);
  assert.doesNotMatch(messageDesign, /<IconTrash size=\{13\} \/>/);
  const css = await source("src/components/Manage/manage-restyle.css");
  assert.match(css, /\.gator-row-action \{[^}]*width: 1\.75rem/s);
  // And it takes the touch floor like every other control.
  assert.match(css, /@media \(pointer: coarse\) and \(max-width: 900px\)[^@]*\.gator-row-action \{[^}]*2\.75rem/s);
});

test("a config that did not load is never mistaken for a config that is empty", async () => {
  const context = await source("src/components/Manage/manage-context.tsx");

  // A failed config load is an error, not `{ config: {} }`. Treating a 500 or
  // timeout as "no settings yet" cached an empty config, made the restored
  // local draft look entirely unsaved, and the next save sent every path,
  // `$unset` included, replacing a server's settings with defaults.
  assert.doesNotMatch(context, /return \{ config: \{\} as GuildConfig \};/);

  // 403 still short-circuits to the forbidden screen; everything else
  // propagates to the error state, which draws a retry.
  assert.match(context, /if \(\(error as \{ status\?: number \}\)\?\.status === 403\) \{\s*if \(!cancelled\) setForbidden\(true\);/);

  // Second line of defence: with no config loaded there is nothing safe to diff
  // against, so save is refused.
  assert.match(context, /if \(config === null\) \{[\s\S]{0,400}return false;/);
  assert.match(context, /\[cacheKey, config, externalDirty, meta, patchUrl, pending, setPending, showNotice\]/);
});

test("a flow reads as a sequence", async () => {
  const flow = await source("src/components/Manage/container-flow-builder.tsx");
  const css = await source("src/components/Manage/manage-restyle.css");

  // A thread runs between the steps, showing that they run in order.
  assert.match(flow, /className="gator-flow-thread"/);
  assert.match(css, /\.gator-flow-thread \{[^}]*justify-self: center/s);
  // After a step that can end the flow early, the thread moves left and stays
  // there: what follows depends on that check.
  assert.match(flow, /data-branch=\{flowStepBranches\(previous\)/);
  assert.match(css, /\.gator-flow-thread\[data-branch="true"\] \{[^}]*justify-self: start/s);
  // And a folded run closes up rather than leaving rungs hanging in space.
  assert.match(flow, /data-collapsed=\{collapsed\.has\(index - 1\)/);

  // Steps fold, so a long flow can be read.
  assert.match(flow, /aria-expanded=\{open\}/);
  // Folding only helps if the closed row says something, and "Send Message"
  // says nothing when three of the eight are Send Message.
  assert.match(flow, /export function flowStepSummary/);
  assert.match(flow, /className="gator-flow-summary"/);
  // Broken steps are findable while folded -- the point of folding is that you
  // stop looking inside.
  assert.match(flow, /export function flowStepErrors/);
  assert.match(flow, /className="shrink-0 text-\[var\(--tone-warn\)\]"/);

  // A flow is built out of near-identical steps, and rebuilding each from the
  // Add menu was the slowest way to write one.
  assert.match(flow, /aria-label="Duplicate step"/);

  // The grip icon had no drag handler behind it in any form -- a control that
  // looked draggable and was not.
  assert.doesNotMatch(flow, /IconGripVertical/);

  // Same row cluster as the block editor, so the two halves of the message
  // editor are one editor.
  assert.match(flow, /className="gator-row-action"/);
});

test("no comment on this page has swallowed the rule under it", async () => {
  /* No CSS file contains a brace inside a comment: a past edit removed
     selectors along with the comment terminator above them, turning several
     rules into comment text without breaking the page. */
  for (const file of [
    "src/app/servers/servers.css",
    "src/app/account/account.css",
    "src/components/site/footer.css",
    "src/components/site/mac/mac.css",
    "src/components/site/mac/sheet.css",
  ]) {
    const css = await source(file);
    let at = 0;
    while (true) {
      const open = css.indexOf("/*", at);
      if (open < 0) break;
      const close = css.indexOf("*/", open + 2);
      assert.ok(close > 0, `${file} has a comment that is never closed`);
      const body = css.slice(open + 2, close);
      // A brace is only ever prose when the comment is quoting markup at it.
      const quoting = /class=|`\{|\{ ?position|\$\{/.test(body);
      assert.ok(
        quoting || !/[{}]/.test(body),
        `${file}: the comment at line ${css.slice(0, open).split("\n").length} has a rule inside it`,
      );
      at = close + 2;
    }
  }
});

test("the join sheet is a form, not a stack of leftovers", async () => {
  const css = await source("src/app/servers/servers.css");
  const content = await source("src/components/servers-content.tsx");

  /* The join dialog uses the shared type scale, with space between the field
     and the action. */
  const body = css.slice(css.indexOf(".servers-dialog-body {"));
  assert.match(body.slice(0, 160), /display: flex;\s*flex-direction: column;\s*gap: 16px;\s*padding: 16px/);
  assert.match(css, /\.servers-dialog-field \{[\s\S]{0,120}gap: 8px/);
  assert.match(css, /\.servers-code-input \{[\s\S]{0,140}height: 44px/);

  // A title bar with no fill of its own: on glass a second opaque bar reads as
  // a card inside a card, so the hairline does the separating.
  assert.ok(
    !/\.servers-dialog-heading \{\s*background:/.test(css),
    "the title bar is painting a fill over the sheet's material again",
  );

  // One field, so no required asterisk; a line says where a code comes from.
  assert.match(content, /className="servers-dialog-say"/);
  assert.ok(!/Join Code <span>\*<\/span>/.test(content), "the required asterisk is back");

  /* The wrong-length state is a `data-invalid` attribute, and the focus ring
     follows the border colour. */
  assert.match(content, /data-invalid=\{tooShort \|\| undefined\}/);
  assert.ok(!/border-white\/\[0\.08\]/.test(content), "the field is back on inline utilities");
  assert.match(css, /\.servers-code-input\[data-invalid\]:focus[\s\S]{0,200}var\(--tone-bad-soft\)/);

  // Empty is not wrong, it is untyped.
  assert.match(content, /const tooShort = joinDraft\.trim\(\)\.length > 0 && joinDraft\.trim\(\)\.length < 3/);
});

test("the picker's global rules are not trapped in the phone layer", async () => {
  const css = await source("src/app/servers/servers.css");

  /* The kebab's size and the full-width sheet action apply at every width, not
     only inside the phone media query. */
  const phone = css.indexOf(
    "@media (max-width: 640px)",
    css.indexOf("the iOS layer"),
  );
  assert.ok(phone > 0, "the phone layer moved");
  for (const rule of [
    ".servers-cta-wide {",
    ".servers-department-menu-button,\n.servers-dialog-close {",
  ]) {
    assert.ok(
      css.indexOf(rule) < phone,
      `${rule} is inside the phone layer again`,
    );
  }
});

test("the site never shows a face it will not let in", async () => {
  /* A NextAuth session can outlive its Discord tokens: the cookie still has a
     name and avatar, but `jwt()` stamped `authError` after a failed refresh.
     Anything that draws an identity asks the same function as the guards, on
     the server and in the browser (`/api/auth/session` passes `authError` to
     the client too). */
  const viewer = await source("src/utils/viewer.ts");
  assert.match(viewer, /export function isLive/);
  assert.match(viewer, /!session\.user\.authError/);

  for (const file of [
    "src/app/(landing)/page.tsx",
    "src/app/servers/page.tsx",
    "src/app/account/page.tsx",
    "src/app/account/roblox/page.tsx",
    "src/app/terms/page.tsx",
    "src/app/privacy/page.tsx",
    "src/components/document-reader.tsx",
    "src/components/Manage/manage-shell.tsx",
  ]) {
    const text = await source(file);
    assert.match(
      text,
      /from "@\/utils\/viewer"/,
      `${file} decides for itself who is signed in`,
    );
  }

  // The account routes check it before rendering, rather than rendering an
  // empty list when the fetch fails.
  for (const file of [
    "src/app/account/page.tsx",
    "src/app/account/roblox/page.tsx",
  ]) {
    assert.match(
      await source(file),
      /!isLive\(session\)/,
      `${file} lets a dead session through`,
    );
  }
});

test("the servers toolbar fits the phone it is on, and says when it is done", async () => {
  const css = await source("src/app/servers/servers.css");
  const actions = await source("src/components/servers-actions.tsx");
  const content = await source("src/components/servers-content.tsx");

  /* The search field may shrink (`min-width: 0`); its min-content is 223px,
     which pushed Refresh off the side of a phone. */
  assert.match(css, /\.servers-filter-field \{\s*flex: 1;\s*min-width: 0;/);
  assert.match(css, /\.servers-list-tools \.servers-filter-field \{\s*width: 100%;\s*min-width: 0;/);

  /* Refresh reports its outcome on the button: on a phone the cards are below
     the fold. */
  assert.match(actions, /setSettled\(true\)/);
  assert.match(actions, /const SETTLED_MS = 1800/);
  assert.match(actions, /settled \? "Updated"/);
  assert.match(actions, /aria-live="polite"/);
  // And it must not claim success when the refresh failed.
  assert.match(content, /throw refreshFailure/);
  assert.match(actions, /\} catch \{/);
  // The timer is cleared, both on a second press and on the way out.
  assert.match(actions, /useEffect\(\(\) => \(\) => \{\s*if \(timer\.current\) clearTimeout\(timer\.current\);/);

  /* The three labels share one width, so the button does not resize under the
     finger. */
  assert.match(css, /\.servers-actions \.servers-cta \[aria-live\] \{[\s\S]{0,400}min-width: 72px/);

  /* No rule trying to recolour Refresh on a phone: the ripple button's own
     stylesheet has the same specificity and loads later, so it never applied. */
  assert.ok(
    !/\.servers-actions \.servers-cta \{[^}]*background:/.test(css),
    "the toolbar is painting over the button again",
  );
});

test("the owner panel's cards are the control, not a row of buttons", async () => {
  const page = await source("src/app/owner/page.tsx");
  const panel = await source("src/components/owner-panel.tsx");
  const css = await source("src/app/owner/owner.css");

  /* The owner page uses the site's header and footer. */
  assert.match(page, /<SiteNav/);
  assert.match(page, /<SiteFooter/);
  assert.match(page, /<DotField/);
  assert.match(page, /import "\.\/owner\.css"/);
  assert.ok(
    !/components\/Landing\/(header|footer)/.test(page),
    "the old chrome is back",
  );
  // And it asks the same question about a stale session every other gate asks.
  assert.match(page, /!isLive\(session\)/);

  /* The row is the control that opens a server; no row of unlabelled icon
     buttons. */
  assert.match(panel, /className="owner-row"/);
  assert.match(panel, /aria-expanded=\{open\}/);
  assert.match(panel, /aria-controls=\{`owner-body-\$\{server\.id\}`\}/);
  assert.ok(
    !/size="icon-sm"/.test(panel),
    "the row is back to icon-only buttons",
  );

  /* Any number of rows can be open at once, for comparing servers. */
  assert.match(panel, /useState<Set<string>>\(\(\) => new Set\(\)\)/);
  assert.match(panel, /const open = expanded\.has\(server\.id\)/);
  assert.match(
    panel,
    /if \(!next\.delete\(server\.id\)\) next\.add\(server\.id\)/,
  );

  /* The body animates `grid-template-rows` from 0fr to 1fr, which animates to
     an unmeasured height, and stays in flow so it pushes the rows below. */
  assert.match(css, /\.owner-body \{[\s\S]{0,200}grid-template-rows: 0fr/);
  assert.match(
    css,
    /\.owner-card\[data-open="true"\] \.owner-body \{\s*grid-template-rows: 1fr/,
  );
  /* `inert`, not `hidden`: the panel stays in the layout so the height can
     animate, and inert keeps a closed panel out of the tab order. */
  assert.match(panel, /inert=\{!open\}/);
  assert.ok(
    !/hidden=\{!open/.test(panel),
    "the body is hidden, so it cannot animate",
  );

  // What opening one is for.
  for (const fact of ["Members", "Server ID", "Owner ID", "Added by ID"]) {
    assert.ok(panel.includes(`>${fact}<`), `the panel stopped showing ${fact}`);
  }
  assert.match(panel, /modules enabled/);

  /* Four actions, in words, at the end of what they are about. The fifth was a
     button that opened the modules, and the modules are above it now. */
  for (const label of [
    "Copy invite",
    "Sync commands",
    "Blacklist owner",
    "Leave server",
  ]) {
    assert.ok(panel.includes(label), `the panel dropped ${label}`);
  }
  assert.ok(
    !/\{server\.moduleCount\} features/.test(panel),
    "the modules button is back, next to the modules it opens",
  );
  assert.match(css, /\.owner-acts \{[\s\S]{0,200}justify-content: flex-end/);
  // And on a phone they are two by two at the foot of the card, where a thumb
  // is, rather than four pills crowding the right edge of a 390px screen.
  assert.match(
    css,
    /@media \(max-width: 640px\)[\s\S]{0,700}flex: 1 1 calc\(50% - 4px\)/,
  );
});


test("server refresh keeps the cards in place and still says it happened", async () => {
  const content = await source("src/components/servers-content.tsx");

  /* Not by remounting the grid, which would drop every fetched icon and banner. */
  assert.doesNotMatch(content, /key=\{refreshVersion\}|server-refresh-enter/);
  assert.match(content, /key=\{server.id\}/);

  /* The cards re-enter after a refresh (one Web Animations pass, keyed by a
     counter), so a refresh that returns the same servers still shows it ran. */
  assert.match(content, /const \[refreshed, setRefreshed\] = useState\(0\)/);
  assert.match(content, /setRefreshed\(\(count\) => count \+ 1\)/);

  /* It also runs on the first arrival, when the cards replace the same-shaped
     placeholders from Suspense. */
  assert.doesNotMatch(content, /if \(!refreshed\) return;/);
  assert.match(content, /querySelectorAll<HTMLElement>\("\.sv-frame"\)/);
  assert.match(content, /card\.animate\(/);
  assert.match(content, /<div className="servers-window-grid" ref=\{grid\}>/);

  // Capped, so twenty servers do not take two seconds to finish reporting.
  assert.match(content, /delay: Math\.min\(index, 7\) \* 32/);
  // And it is motion, so it asks first.
  assert.match(content, /prefers-reduced-motion: reduce/);
});

test("server cards have a direct dashboard link", async () => {
  const card = await source("src/components/server-card.tsx");
  assert.match(card, /`\/manage\/\$\{id\}\/overview`/);
  assert.match(card, /className="sv-go"/);
  assert.match(card, /Manage/);
});

test("servers and departments remain separate and use their own imagery", async () => {
  const card = await source("src/components/server-card.tsx");
  const content = await source("src/components/servers-content.tsx");
  assert.match(card, /className="sv-band"/);
  assert.match(card, /className="sv-tile"/);
  assert.match(content, /servers-window-grid/);
  assert.match(
    content,
    /<div className="servers-grid">[\s\S]{0,400}DepartmentCard/,
  );
});

test("the Roblox account flow uses the account design and keeps every state clear", async () => {
  const page = await source("src/app/account/roblox/page.tsx");
  const card = await source("src/components/roblox-account-card.tsx");
  const css = await source("src/app/account/account.css");
  assert.match(page, /<DotField className="account-field" \/>/);
  assert.match(page, /import "\.\.\/account\.css"/);
  assert.match(page, /<h1>Roblox<\/h1>/);
  assert.match(card, /roblox-panel-loading/);
  assert.match(card, /roblox-connect-copy/);
  assert.doesNotMatch(card, /roblox-steps|Open verification|Choose your account/);
  assert.match(card, /className="roblox-identity"/);
  assert.match(card, /onError=\{\(\) => setAvatar\(""\)\}/);
  assert.match(card, /className="roblox-error" role="alert"/);
  assert.match(css, /\.roblox-panel-head/);
  assert.match(css, /@media \(max-width: 680px\)/);
});

test("the account leads with the person and consistently presents connected services", async () => {
  const overview = await source("src/components/account/account-overview.tsx");
  const css = await source("src/app/account/account.css");

  /* One sheet per service, each under its own name, showing the account's
     picture, name and id. */
  assert.match(overview, />Discord<\/h2>/);
  assert.match(overview, />Roblox<\/h2>/);
  assert.match(overview, /className="account-who"/);
  assert.match(overview, /className="account-who-name"/);
  assert.match(overview, /src=\{roblox.avatar\}/);
  assert.match(overview, /account-who-face account-who-square account-who-mark/);

  /* Every state the connection can be in says which one it is, in the place
     the account would otherwise be. */
  assert.match(overview, /Checking your Roblox connection/);
  assert.match(overview, /could not reach Roblox/);
  assert.match(overview, /No Roblox account linked/);
  assert.match(overview, /Try again/);

  /* `UserAvatar` hard-codes `bg-white\/\[0.08\]` and `text-white\/70`, which is
     a near-invisible monogram on the cream paper. */
  assert.match(css, /\.account-who > \.account-who-face/);
  assert.match(css, /\.account-rows > li > a > \.account-row-face/);
});

test("dashboard links acknowledge navigation and respect reduced motion", async () => {
  const card = await source("src/components/server-card.tsx");
  const navigation = await source(
    "src/components/servers/community-navigation.tsx",
  );
  const css = await source("src/components/servers/server-card.css");
  assert.match(card, /useLinkStatus/);
  assert.match(card, /transitioning \|\| status.pending/);
  assert.match(card, /Opening…/);
  assert.match(navigation, /useTransition\(\)/);
  assert.match(navigation, /startTransition\(\(\) => router.push/);
  assert.match(navigation, /prefers-reduced-motion: reduce/);
  assert.match(navigation, /e.metaKey/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /animation: none/);
});

/* ── No icon sits in a box ──

   A standing rule: no rounded filled tile behind a glyph. The glyph is already
   a mark, and a tile adds a border louder than the label beside it.

   Avatars are the exception, and they are round, because a server or a
   department is a thing with a name and a picture. */
test("no glyph in this window sits in a filled tile", async () => {
  const css = await source("src/components/Manage/manage-window.css");
  const sessions = await source("src/components/Manage/sections/sessions.tsx");
  const tickets = await source("src/components/Manage/sections/tickets.tsx");
  const permissions = await source("src/components/Manage/sections/permissions.tsx");
  const modules = await source("src/components/Manage/sections/modules.tsx");

  // The setting-row glyph and the module glyph: colour only, no fill, no radius.
  const fieldIcon = css.slice(
    css.indexOf(".manage-root .gw-pane .field-icon {"),
    css.indexOf(".manage-root .gw-pane .field-icon svg"),
  );
  assert.ok(fieldIcon.length > 0, "the field glyph has no rule");
  assert.doesNotMatch(fieldIcon, /background|border-radius/);

  const modGlyph = css.slice(
    css.indexOf(".gw-mod-glyph {"),
    css.indexOf(".gw-mod-title {"),
  );
  assert.ok(modGlyph.length > 0, "the module glyph has no rule");
  assert.doesNotMatch(modGlyph, /background:|border-radius/);
  assert.match(css, /\.gw-mod\[data-enabled="true"\] \.gw-mod-glyph \{\s*color: var\(--g-accent-ink\);/);

  // The ER:LC rail had one too.
  assert.match(css, /\.manage-root \.prc-rail-icon \{[\s\S]*?background: transparent;/);

  // The tabs that drew their own tinted tiles now draw the shared glyph.
  for (const [name, file] of [
    ["sessions", sessions],
    ["tickets", tickets],
    ["permissions", permissions],
  ] as const) {
    assert.doesNotMatch(
      file,
      /h-9 w-9 shrink-0 items-center justify-center rounded-xl/,
      `${name} still draws a tinted icon tile`,
    );
    assert.match(file, /<FieldIcon type=/, `${name} does not use the shared glyph`);
  }

  // A server's picture is round, not a square tile.
  assert.match(css, /\.gw-tab-art \{[\s\S]*?border-radius: 50%;/);
  assert.match(css, /\.gw-pick-art \{[\s\S]*?border-radius: 50%;/);

  // And the state lives on the card: its border takes the accent and its
  // fill sweeps across it to the full width.
  assert.match(css, /\.gw-mod\[data-enabled="true"\] \{\s*border-color: var\(--g-accent-line\);/);
  assert.match(css, /\.gw-mod\[data-enabled="true"\] \.gw-mod-fill \{\s*--gw-fill: 100%;/);
  assert.match(modules, /data-enabled=\{enabled \? "true" : "false"\}/);
});

/* ── One field, one outline ──

   The input inside the search box has no border of its own, so focus is shown
   on the box, not as a second ring on the input. */
test("the server search wears one rim, on the box", async () => {
  const css = await source("src/components/Manage/manage-window.css");

  // The focus rule does not name the input.
  const focus = css.slice(
    css.indexOf(":root .manage-root :is(button, a,"),
    css.indexOf("/* ── 5. Density"),
  );
  assert.ok(focus.length > 0, "the focus rule is gone");
  assert.doesNotMatch(focus, /\.gw-pick-layer :is\(button, a, input\)/);
  assert.match(focus, /\.gw-pick-layer :is\(button, a\):focus-visible/);

  // The search is set into the panel's top edge, ruled off by a hairline, and
  // focus is the caret (the field takes focus when the panel opens, so a ring
  // would always be lit).
  assert.match(css, /\.gw-pick-find \{[\s\S]*?border-bottom: 1px solid var\(--mac-hair\);/);
  assert.match(css, /\.gw-pick-find:focus-within \{\s*color: var\(--g-ink\);/);
  assert.match(css, /\.gw-pick-find input \{[\s\S]*?outline: none;[\s\S]*?caret-color: var\(--g-accent\);/);
});

/* ── One heading face across every tab ──

   Every tab, Overview included, opens through the same header in the same face. */
test("every tab opens in the same face", async () => {
  const css = await source("src/components/Manage/manage-window.css");
  const fields = await source("src/components/Manage/fields.tsx");

  // Overview's treatment, and Overview is drawn by the same declaration, so
  // the two cannot drift apart again.
  assert.match(
    css,
    /\.manage-root \.gw-pane \.section-header-title,\n\.manage-root \.gw-pane \.overview-heading-copy h2 \{[\s\S]*?font-family: inherit;[\s\S]*?font-weight: 800;/,
  );
  // The serif is out of the pane; only the script signature keeps its face.
  const paneSerif = [...css.matchAll(/font-family: var\(--font-merriweather\)/g)];
  assert.equal(paneSerif.length, 0, "the pane still sets a serif somewhere");

  // No uppercase tracked headings.
  assert.doesNotMatch(fields, /uppercase tracking-\[0\.14em\]/);
  assert.match(fields, /className=\{`gw-h3 \$\{className\}`\}/);
  assert.match(css, /\.manage-root \.gw-pane \.gw-h3,[\s\S]*?text-transform: none;/);
});

/* ── A group led by a switch is still a group ──

   A lead-toggle group uses the same container and grid as every other group, so
   the page's layout does not stop and restart. */
test("a lead-toggle group is the same container as every other group", async () => {
  const schema = await source("src/components/Manage/schema-section.tsx");
  const css = await source("src/components/Manage/manage-window.css");

  assert.match(schema, /function ToggleGroup\([\s\S]{0,900}<section className="gw-set"/);
  // Header row inside the panel, then the switch as the first setting, then
  // what it gates. Same three pieces as a plain group.
  assert.match(schema, /<div className="gw-set-panel">[\s\S]{0,300}className="gw-set-head"/);
  // The master switch is the first thing under the header, as a full-width
  // option tile -- the same pressable tile every other boolean is.
  assert.match(schema, /<div className="gw-set-panel">[\s\S]{0,900}<OptionTile\s*\n\s*path=\{toggleField\.path\}[\s\S]{0,200}wide/);
  assert.match(schema, /className="gw-set-roll" data-open=\{enabled \? "true" : "false"\}/);
  assert.doesNotMatch(schema, /<ToggleConfigCard[\s\S]{0,200}enabled=\{enabled\}/);

  // 0fr → 1fr, which is the only way to animate to content height without
  // measuring it first.
  assert.match(css, /\.gw-set-roll \{[\s\S]*?grid-template-rows: 0fr;/);
  assert.match(css, /\.gw-set-roll\[data-open="true"\] \{\s*grid-template-rows: 1fr;/);

  // The tabs that lay their settings out by hand get the same panel, found by
  // what they contain rather than by a class anybody has to remember to add.
  assert.match(css, /:is\(\.grid, \.schema-grid\):has\(> \.gw-set-row\) \{/);
});

/* ── Written the way a person would say it ──

   Module and section descriptions are plain sentences, not comma-separated
   lists of field names. */
test("modules are described in plain words", async () => {
  const schema = await source("src/components/Manage/schema.ts");
  const overview = await source("src/components/Manage/sections/overview.tsx");

  assert.doesNotMatch(schema, /hierarchy routing/i);
  assert.match(schema, /description: "Promote and demote staff, and post who moved where\."/);
  assert.match(schema, /description: "Members DM the bot, you answer from a channel\."/);
  assert.doesNotMatch(overview, /Everything Gator can do in this server/);

  // No description on a module card is a list of four nouns and an "and".
  const descriptions = [...schema.matchAll(/^  \{ key: "[^"]+", label: "[^"]+", description: "([^"]+)"/gm)]
    .map((match) => match[1]);
  assert.ok(descriptions.length >= 25, `only ${descriptions.length} modules are described`);
  for (const line of descriptions) {
    const commas = (line.match(/,/g) || []).length;
    assert.ok(commas <= 2, `"${line}" is a feature list, not a sentence`);
  }
});

/* ── Nothing floats beside a box ──

   One container per settings group, with the group's name as its first row
   under the same border. Hand-written tabs that render their heading separately
   join it to the panel below. */
test("a settings group is one container with its name inside it", async () => {
  const section = await source("src/components/Manage/schema-section.tsx");
  const css = await source("src/components/Manage/manage-window.css");

  // The margin note is gone from the markup and from the stylesheet.
  assert.doesNotMatch(section, /gw-set-aside/);
  assert.doesNotMatch(css, /gw-set-aside/);

  // The panel comes first and the heading is its first row.
  assert.match(
    section,
    /<div className="gw-set-panel"[\s\S]{0,400}className="gw-set-head"/,
  );
  assert.match(section, /className="gw-set-head-name"/);
  assert.match(section, /className="gw-set-head-say"/);
  // Pressing that row is what opens and shuts the group.
  assert.match(section, /className="gw-set-head"\s*\n\s*aria-expanded=\{open\}/);

  // The group is one column, not two.
  const shell = css.slice(
    css.indexOf(".manage-root .gw-pane .gw-set {"),
    css.indexOf(".manage-root .gw-pane .gw-set:last-child"),
  );
  assert.ok(shell.length > 0, "the group shell has no rule");
  assert.doesNotMatch(shell, /grid-template-columns/);

  // The header row is joined to its rows by the same hairline that separates
  // them, so the seam reads as one box rather than two stacked.
  assert.match(css, /\.gw-set-head \+ \.gw-set-slot[\s\S]{0,140}border-top: 1px solid var\(--mac-hair\)/);

  // And a hand-written tab's heading is joined to the panel under it.
  assert.match(
    css,
    /\.schema-group-header:has\(\+ :is\(\.grid, \.schema-grid\) > \.gw-set-row\) \{[\s\S]*?border-radius: var\(--r-card\) var\(--r-card\) 0 0;/,
  );

  // One width for every container on a tab (status cards, `SettingsCard`,
  // groups): the pane's.
  assert.match(css, /--set-max: none;/);
  assert.match(css, /\.manage-root \.gw-pane \.gw-set \{[\s\S]*?max-width: var\(--set-max\);/);
});

/* ── The card's control is not on its title line ──

   The switch sits at the card's foot on the leading edge, with "Settings"
   opposite it, below the copy. On the title line it competed with the module's
   name. */
test("the module card is the switch, and settings is the cog in its corner", async () => {
  const css = await source("src/components/Manage/manage-window.css");
  const modules = await source("src/components/Manage/sections/modules.tsx");

  // The fill is a registered property, so it interpolates; the clip that
  // reveals it and the band on its edge both read it, so they stay in step.
  assert.match(css, /@property --gw-fill \{\s*syntax: "<percentage>";/);
  // A feathered edge: the mask runs a quarter of the card's width ahead of the
  // fill, so it reads as colour arriving rather than a stripe.
  assert.match(css, /mask-image: linear-gradient\(\s*to right,\s*#000 calc\(var\(--gw-fill\) \* 1\.25 - 25%\),\s*transparent calc\(var\(--gw-fill\) \* 1\.25\)\s*\);/);
  assert.match(css, /transition: --gw-fill 680ms var\(--gw-ease\);/);

  // Under a pointer it leans toward what a press would do, and the lean ends
  // with the press -- otherwise the card you just turned on sits at 88%.
  assert.match(css, /\.gw-mod\[data-enabled="false"\]:not\(\[data-settled="false"\]\):hover \.gw-mod-fill \{\s*--gw-fill: 14%;/);
  assert.match(modules, /data-settled=\{settled \? undefined : "false"\}/);
  assert.match(modules, /onPointerLeave=\{\(\) => setSettled\(true\)\}/);

  // Settings is the cog, in the corner, bare.
  const cog = css.slice(css.indexOf(".gw-mod-cog {"), css.indexOf(".gw-mod-cog svg {"));
  assert.ok(cog.length > 0, "the cog has no rule");
  assert.match(cog, /background: transparent;/);
  assert.match(css, /\.gw-mod-cog-spot \{[\s\S]*?right: var\(--u2\);[\s\S]*?bottom: var\(--u2\);/);
});

/* ── The window fits the screen it is on ──

   Four things, checked below:

     The module card's switch keeps its size on a phone: the phone rule for
     `role="switch"` sized every switch to the Toggle's 18px oval.

     The server picker is placed within the viewport, not hung off the tab's
     left edge past the right side of a phone.

     The save prompt has a real background: `bg-[var(--x)]/97` (an arbitrary
     colour plus an opacity modifier) does not compile, so it had none.

     The structure is fluid (clamp), not fixed pixels with breakpoints. */
test("the dashboard is sized for the screen rather than for three of them", async () => {
  const win = await source("src/components/Manage/manage-window.css");
  const restyle = await source("src/components/Manage/manage-restyle.css");
  const picker = await source("src/components/Manage/server-picker.tsx");

  // Structure interpolates instead of stepping.
  for (const name of ["--gw-rail", "--gw-card"]) {
    assert.match(
      win,
      new RegExp(`${name}: clamp\\(\\d+px, [\\d.]+vw, \\d+px\\)`),
      `${name} is not fluid`,
    );
  }

  // Reading sizes step up where the pointer is a finger.
  const coarse = win.slice(
    win.indexOf("@media (pointer: coarse) {"),
    win.indexOf("@media (max-width: 900px)"),
  );
  assert.match(coarse, /--t-body: 15px;/);

  // The phone rule that sizes switches is keyed on the `Toggle` component's
  // class, so the module card -- a switch the size of a card -- keeps its size.
  assert.match(restyle, /\.manage-content \.gator-switch \{/);

  // The picker stays on the screen it is anchored in.
  assert.match(picker, /const rightmost = Math\.max\(gutter, window\.innerWidth - width - gutter\)/);
  assert.match(picker, /const left = Math\.min\(Math\.max\(gutter, rect\.left\), rightmost\);/);

  // The save prompt paints a background of its own.
  assert.match(
    win,
    /\.gw-save \{[^}]*background: color-mix\(in srgb, var\(--mac-raise\) 96%/,
  );
  // One row on a phone: "Save" and a dot leave the count room to be read, and
  // it ellipsises rather than wrapping the bar to twice its height.
  assert.match(win, /\.gw-save-say \{[^}]*text-overflow: ellipsis/);
  assert.doesNotMatch(win, /\[aria-label="Unsaved changes"\] > div/);
});

/* ── A save prompt with nothing to save ──

   The message designer writes its "nothing saved yet" baseline once, so the
   draft seed and the dirty check cannot disagree (they differed by
   `v2_explicit_layout: false` and showed the prompt on load). It is not dirty
   while a fetch is in flight either. */
test("a message designer is clean until something in it changes", async () => {
  const design = await source("src/components/Manage/message-design.tsx");
  assert.match(design, /function defaultBaseline\(\)/);
  // One definition, used by every place that needs "unsaved".
  assert.match(design, /: defaultBaseline\(\);\n\s*setSaved\(doc \? base : null\);/);
  assert.match(design, /const baseline = saved \?\? defaultBaseline\(\);/);
  assert.doesNotMatch(design, /saved \?\? \{\s*\.\.\.defaults/);
  // Nothing loaded is nothing changed.
  assert.match(design, /const dirty = useMemo\(\(\) => \{[\s\S]{0,400}if \(loading\) return false;/);
});

/* ── A blocked tab change shakes once ──

   The shake is an animation played on the node, not a class keyed on the
   blocked-navigation counter (which shook every later tab and remounted it). */
test("a blocked tab change shakes once, and nothing after", async () => {
  const shell = await source("src/components/Manage/manage-shell.tsx");
  const bar = await source("src/components/Manage/save-bar.tsx");
  assert.doesNotMatch(shell, /shakeSignal \? "gator-shake"/);
  assert.match(shell, /key=\{sectionPath\}\s*ref=\{placeRef\}\s*className="gw-place"\s*data-measure=\{measureOf\(section\)\}/);
  assert.doesNotMatch(shell, /key=\{`\$\{sectionPath\}-\$\{shakeSignal\}`\}/);
  assert.match(shell, /function shakePane\(node: HTMLElement \| null\)[\s\S]{0,300}node\.animate\(/);
  // And the save prompt's red flash belongs to the navigation that asked for
  // it, not to the next prompt, minutes later.
  assert.match(bar, /if \(!dirty\) setFlashKey\(0\);/);
});

/* ── Writing a value you just chose ──

   `stage()` then `save()` in one handler saves the edits of the render the
   handler was made in, which do not include the one staged a line earlier.
   `commit()` takes the values as arguments. */
test("on and off are written directly, and a toast can undo them", async () => {
  const context = await source("src/components/Manage/manage-context.tsx");
  const gate = await source("src/components/Manage/module-gate.tsx");
  const sessions = await source("src/components/Manage/sections/sessions.tsx");
  const modules = await source("src/components/Manage/sections/modules.tsx");
  const bar = await source("src/components/Manage/save-bar.tsx");

  assert.match(context, /commit: \(changes: Record<string, any>, module\?: string\) => Promise<boolean>;/);
  // Shown written before the bot answers, and put back if it says no.
  assert.match(context, /setConfig\(optimistic\);[\s\S]{0,2000}catch \(caught\) \{[\s\S]{0,200}setConfig\(previous\);/);
  // Two presses in flight: only the newest answer is put on screen, or the
  // card fills and empties twice.
  assert.match(context, /if \(seq !== commitSeq\.current\) return true;/);
  for (const [name, file] of [["module gate", gate], ["sessions", sessions]] as const) {
    assert.doesNotMatch(file, /stage\(`?"?Modules\.[\s\S]{0,80}\);\s*\n\s*save\("Modules"\)/, `${name} still stages then saves`);
    assert.match(file, /commit\(\{/, `${name} does not commit`);
  }
  // A module switch is the Gmail pattern: done at once, undoable for seconds.
  assert.match(modules, /action: \{ label: "Undo", run: \(\) => toggle\(key, !next, true\) \}/);
  assert.match(context, /value\.action \? 7000 : 4200/);
  assert.match(bar, /actionButton: "gw-toast-act"/);
});

/* ── Auto, on a device set to light ──

   Auto (no stored choice) is written down on /manage as an explicit
   `data-theme` from the media query, so older styles that read "not light" as
   dark agree with the window's tokens. */
test("auto is written down on /manage so every stylesheet agrees", async () => {
  const theme = await source("src/components/site/theme.ts");
  const shell = await source("src/components/Manage/manage-shell.tsx");
  assert.match(theme, /location\.pathname\.indexOf\("\/manage"\)===0\)\{r\.setAttribute\("data-theme",matchMedia\("\(prefers-color-scheme: light\)"\)\.matches\?"light":"dark"\)/);
  assert.match(theme, /export function resolveAutoTheme\(\): \(\) => void/);
  assert.match(shell, /useEffect\(\(\) => resolveAutoTheme\(\), \[\]\);/);
});

/* ── A blur that can see ──

   The scrim's `backdrop-filter` must not sit inside a backdrop root: the motion
   contract gives `data-enter` elements a `will-change` of transform and
   opacity, which makes them one, and the blur saw only the layer's own empty
   contents. */
test("the page behind the server picker actually blurs", async () => {
  const css = await source("src/components/Manage/manage-window.css");
  assert.match(css, /\.gw-pick-layer \{[\s\S]*?will-change: auto;/);
  assert.match(css, /\.gw-sheet-layer \{[\s\S]*?will-change: auto;/);
  // At full strength from the first frame, revealed top-down by a clip on the
  // panel's curve. Animating the radius looked like a delay and re-blurred the
  // window every frame.
  const scrim = css.slice(css.indexOf(".gw-pick-scrim {"), css.indexOf("@keyframes gw-veil-down"));
  assert.match(scrim, /backdrop-filter: blur\(10px\)/);
  assert.doesNotMatch(scrim, /transition:[^;]*backdrop-filter/);
  assert.match(css, /\.gw-pick-layer\[data-open="true"\] \.gw-pick-scrim \{\s*animation: gw-veil-down/);
  const picker0 = await source("src/components/Manage/server-picker.tsx");
  // Grown from the bar with a transform, which every engine animates on the
  // compositor -- Safari does not redraw a blurred layer's clip as it moves.
  assert.match(css, /@keyframes gw-veil-down \{\s*from \{\s*transform: scaleY\(0\);/);
  assert.match(picker0, /const showing = open \|\| presence\.mounted;/);
  // On the page and nothing else: the card's own box and corners, written to
  // the element on the press itself so the first frame has the right shape.
  const picker = await source("src/components/Manage/server-picker.tsx");
  // Everything under the bar: the rail, the page and the foot, to the
  // window's own lower corners. Only the bar stays sharp.
  assert.match(picker, /document\.querySelector<HTMLElement>\("\.manage-root \.gw"\)/);
  assert.match(picker, /\{ top: barBox\.bottom, left: winBox\.left, width: winBox\.width, height: Math\.max\(0, winBox\.bottom - barBox\.bottom\) \}/);
  assert.match(picker, /veil\.style\.top = `\$\{r\.top\}px`;/);
  assert.match(picker, /window\.addEventListener\("gw-pick-arm", place\);/);
  const shell = await source("src/components/Manage/manage-shell.tsx");
  assert.match(shell, /window\.dispatchEvent\(new Event\("gw-pick-arm"\)\);/);
  /* The layer is always opaque and still (no shared entrance fade, which made
     it a backdrop root until the fade ended), and the blurred box grows down by
     its height, painted every frame. */
  assert.match(css, /\.gw-pick-layer\[data-enter\] \{\s*opacity: 1;\s*transform: none;\s*transition: none;/);
  assert.match(css, /\.gw-sheet-layer\[data-enter\] \{\s*opacity: 1;\s*transform: none;\s*transition: none;/);
  assert.match(css, /\.gw-pick-layer\[data-open="true"\] \.gw-pick-scrim \{\s*animation: gw-blur-pour 420ms/);
  assert.match(css, /@keyframes gw-blur-pour \{\s*from \{\s*height: 0;\s*\}\s*to \{\s*height: var\(--gw-veil-h, 100%\);/);
  assert.doesNotMatch(css, /@keyframes gw-blur-in/);
  assert.match(picker, /veil\.style\.setProperty\("--gw-veil-h", `\$\{r\.height\}px`\);/);
});

/* ── Everything that opens also closes ───────────────────────────────────────
 */
test("popups arrive and leave, and tips are never clipped", async () => {
  const tip = await source("src/components/Manage/hover-tip.tsx");
  const fields = await source("src/components/Manage/fields.tsx");
  const section = await source("src/components/Manage/schema-section.tsx");
  const css = await source("src/components/Manage/manage-window.css");

  // Tooltips: portalled, measured, flipped, and held for an exit.
  assert.match(tip, /createPortal\(\s*<span\s*ref=\{tip\}\s*role="tooltip"\s*className="gw-tip"/);
  assert.match(tip, /const presence = usePresence\(show, \{ duration: 160 \}\);/);
  // Coach marks: once, then gone for good.
  assert.match(tip, /const COACH_PREFIX = "gator-coach:";/);
  assert.match(tip, /onPointerDownCapture=\{retire\}/);

  // Dropdowns: an entrance by direction, and a ghost for the exit.
  assert.match(fields, /className="gw-menu"\s*\n\s*data-dir=/);
  assert.match(fields, /exitGhost\(\s*\n?\s*node,/);
  assert.match(css, /@keyframes gw-menu-in \{/);

  // Groups roll rather than snap, and a shut group is out of the tab order.
  assert.match(section, /<div className="gw-set-roll" data-open=\{open \? "true" : "false"\}>\s*\n\s*<div className="gw-set-roll-clip" inert=\{!open\}>/);
  assert.match(css, /\.gw-set-roll \{\s*display: grid;\s*grid-template-rows: 0fr;\s*transition: grid-template-rows 420ms/);

  // Booleans are tiles you press, and runs of them sit side by side.
  assert.match(section, /function fieldRuns\(fields: FieldDef\[\]\): FieldRun\[\]/);
  // One option card, drawn by the fields module for every tab.
  assert.match(section, /<OptionCard/);
  assert.match(fields, /role="switch"\s*\n\s*aria-checked=\{checked\}\s*\n\s*disabled=\{disabled\}\s*\n\s*className="gw-opt"/);
});

/* ── Light mode, kept across a server switch ──

   An explicit choice survives the shell remounting: the teardown only clears
   the attribute it set for Auto, and the new mount writes the stored choice
   back. */
test("an explicit appearance survives the shell remounting", async () => {
  const theme = await source("src/components/site/theme.ts");
  const fn = theme.slice(theme.indexOf("export function resolveAutoTheme"));
  // An explicit choice is written, and clears the Auto marker.
  assert.match(fn, /if \(choice === "light" \|\| choice === "dark"\) \{\s*root\.removeAttribute\("data-theme-auto"\);\s*if \(root\.getAttribute\("data-theme"\) !== choice\) root\.setAttribute\("data-theme", choice\);/);
  // Any change to the attribute is re-read against storage.
  assert.match(fn, /new MutationObserver\(resolve\)/);
  // The teardown asks storage, not the marker.
  assert.match(fn, /const choice = stored\(\);\s*if \(choice !== "light" && choice !== "dark"\) \{\s*root\.removeAttribute\("data-theme-auto"\);\s*root\.removeAttribute\("data-theme"\);/);
});

/* ── The fill is registered from script ──

   The production minifier rewrote `initial-value: 0%` to `0`, which is not a
   valid `<percentage>`, so the `@property` rule was dropped and fills snapped.
   Registered from JS, the value never passes through the minifier. */
test("the fill property is registered where the minifier cannot reach it", async () => {
  const register = await source("src/components/Manage/register-properties.ts");
  const shell = await source("src/components/Manage/manage-shell.tsx");
  assert.match(register, /name: "--gw-fill", syntax: "<percentage>", inherits: false, initialValue: "0%"/);
  assert.match(register, /css\.registerProperty\(definition\)/);
  assert.match(shell, /import "\.\/register-properties";/);
});

/* ── The tab sits in the middle of the pane ──────────────────────────────── */
test("a settings tab uses the whole pane, and a row stacks when it is narrow", async () => {
  const css = await source("src/components/Manage/manage-window.css");
  const shell = await source("src/components/Manage/manage-shell.tsx");
  assert.match(css, /\.manage-root \.gw-pane > \.gw-place \{\s*width: 100%;\s*max-width: var\(--set-max\);\s*margin-inline: auto;/);
  assert.match(css, /\.gw-place\[data-measure="wide"\] \{\s*max-width: var\(--wide-max\);/);
  assert.match(css, /--wide-max: none;/);
  // The row decides by its own width, not the viewport's.
  assert.match(css, /container: gw-row \/ inline-size;/);
  assert.match(css, /@container gw-row \(max-width: 620px\)/);
  // Decided by the tab, not measured from content that arrives late.
  assert.match(shell, /const WIDE_TABS = new Set\(\[/);
  assert.match(shell, /data-measure=\{measureOf\(section\)\}/);
});

/* ── The server picker: no wait for the list, no second animation ─────────── */
test("the server list is read before the picker opens, once", async () => {
  const picker = await source("src/components/Manage/server-picker.tsx");
  const css = await source("src/components/Manage/manage-window.css");
  assert.match(picker, /node\.addEventListener\("pointerenter", warm, \{ once: true \}\)/);
  assert.match(picker, /if \(inflight\.current\) return;/);
  // The rows have no entrance of their own competing with the panel's.
  assert.doesNotMatch(css, /animation: gw-row-in/);
  assert.match(picker, /usePresence\(open, \{ duration: 200 \}\)/);
});

/* ── The channel dropdown ────────────────────────────────────────────────── */
test("a category is said once, over its channels, and the list answers the keyboard", async () => {
  const fields = await source("src/components/Manage/fields.tsx");
  const css = await source("src/components/Manage/manage-window.css");
  // Grouped, not a hint repeated on every row.
  assert.match(fields, /group: channel\.parentId \? categoryNames\.get\(channel\.parentId\) : undefined/);
  assert.doesNotMatch(fields, /hint: channel\.parentId/);
  assert.match(fields, /<div className="gw-menu-group" aria-hidden="true">/);
  assert.match(css, /\.gw-menu-group \{\s*position: sticky;/);
  // Each category says how many it holds, and its channels hang from it.
  assert.match(fields, /<span className="gw-menu-group-count">\{run\.items\.length\}<\/span>/);
  assert.match(css, /\.gw-menu-run\[data-grouped="true"\]::before \{/);
  // Arrow keys and Enter, from the search field.
  assert.match(fields, /onKeyDown=\{onFindKey\}/);
  assert.match(fields, /if \(event\.key === "ArrowDown" \|\| event\.key === "ArrowUp"\)/);
  /* On a desktop: the search is a pill that rings while typed in and counts
     what it found, one highlight glides between rows, what was typed is
     picked out in each name, and a long list has a foot with its keys. */
  assert.match(css, /\.gw-menu-find:focus-within \{[^}]*box-shadow: inset 0 0 0 1px var\(--g-accent-line\);/);
  assert.match(fields, /<span className="gw-menu-lit" ref=\{lit\} aria-hidden="true" \/>/);
  assert.match(fields, /<Matched text=\{option\.label\} query=\{query\} \/>/);
  assert.match(fields, /!phone && options\.length >= FOOT_FROM \?/);
  assert.match(css, /\.gw-menu-sheet-body \.gw-menu-lit \{\s*display: none;/);
  // Lined up with its field, at least 280px wide, never a fixed guess.
  assert.match(fields, /Math\.max\(box\.width, minWidth\)/);
  assert.match(fields, /minWidth = 280,/);
});

test("scrollbars have no arrow buttons in Chromium", async () => {
  const css = await source("src/components/Manage/manage-window.css");
  const block = css.slice(css.indexOf("/* ── scrollbars ──"));
  // Chrome 121+ prefers the standard scrollbar properties over
  // `::-webkit-scrollbar`, and on Windows the standard thin scrollbar has
  // arrows. So they are reset where the webkit rules apply and kept for
  // Firefox.
  assert.match(block, /:root \.gw-menu-list,[\s\S]*?\{\s*scrollbar-width: auto;\s*scrollbar-color: auto;/);
  assert.match(block, /::-webkit-scrollbar-button \{\s*display: none;/);
  assert.match(block, /@supports not selector\(::-webkit-scrollbar\)/);
});

/* ── The strips at the top and the bottom ────────────────────────────────── */
test("the mark lines up with the tab, and the breadcrumb leads with where you are", async () => {
  const css = await source("src/components/Manage/manage-window.css");
  const shell = await source("src/components/Manage/manage-shell.tsx");
  assert.match(css, /\.gw-zone \{\s*display: flex;\s*align-items: center;\s*align-self: flex-end;\s*height: var\(--u10\);/);
  assert.match(shell, /<span className="gw-path-server">/);
  assert.match(shell, /<span className="gw-path-here">\{activeLabel\}<\/span>/);
  assert.match(css, /\.gw-path-here \{\s*flex: none;\s*font-weight: 700;\s*color: var\(--g-ink\);/);
});

/* ── Tickets ──────────────────────────────────────────────────────────────── */
test("the Tickets tab is called Tickets and is built from groups", async () => {
  const tickets = await source("src/components/Manage/sections/tickets.tsx");
  assert.match(tickets, /title="Tickets"/);
  assert.doesNotMatch(tickets, /Ticketing/);
  assert.match(tickets, /<TicketGroup\s+title="Subjects"/);
  assert.match(tickets, /<TicketGroup\s+title="Panels"/);
  // Items open in place, with the dashboard's unfold.
  assert.match(tickets, /<div className="gw-set-roll" data-open=\{open \? "true" : "false"\}>/);
  // No full-width number field under a paragraph.
  assert.doesNotMatch(tickets, /SettingsCard title="Inactivity settings"/);
  // The ticket save prompt is on the window's surface, not hard-coded black.
  assert.doesNotMatch(tickets, /bg-\[#111010\]/);
});

test("turning a module off says so in the words the card uses", async () => {
  const gate = await source("src/components/Manage/module-gate.tsx");
  assert.doesNotMatch(gate, /Disable Plugin/);
  // The words on a desktop; on a phone the mark alone, not a word-wide button.
  assert.match(gate, /<span className="gw-power-label">Turn off<\/span>/);
  assert.match(gate, /aria-label=\{`Turn off \$\{moduleLabel\}`\}/);
});

/* ── The message editors ─────────────────────────────────────────────────── */
test("both message editors share one bar, and the embed is one list", async () => {
  const chrome = await source("src/components/Manage/message-chrome.tsx");
  const editor = await source("src/components/Manage/config-message.tsx");
  const designer = await source("src/components/Manage/message-design.tsx");
  const embed = await source("src/components/Manage/embed-editor.tsx");
  const css = await source("src/components/Manage/manage-window.css");
  assert.match(chrome, /export function ModeSwitch/);
  assert.match(css, /\.gw-md-bar \{\s*position: sticky;/);
  for (const file of [editor, designer]) {
    assert.match(file, /<MessageEditorBar/);
    assert.doesNotMatch(file, /Formats the field you were typing in/);
  }
  assert.doesNotMatch(embed, /Every part Discord supports/);
  assert.match(embed, /className="gw-md-part" data-open=\{open \? "true" : "false"\}/);
  // "Global" is not printed twice over a list of global variables.
  assert.doesNotMatch(embed, /"GLOBAL"/);
});

/* ── Home, as a journey ──────────────────────────────────────────────────── */
test("the mark takes you home through a view transition, guarded like a tab", async () => {
  const shell = await source("src/components/Manage/manage-shell.tsx");
  const trip = await source("src/utils/travel.ts");
  const globals = await source("src/app/globals.css");
  assert.match(shell, /className="gw-mark"\s+href="\/"\s+aria-label="Gator"\s+onClick=\{leaveHome\}/);
  assert.match(shell, /travel\(router, "\/", "home", \(\) => Boolean\(document\.querySelector\("\.g-mac"\)\)\)/);
  assert.match(trip, /root\.setAttribute\("data-leaving", kind\);/);
  assert.match(trip, /document\.startViewTransition\(/);
  // Held while the new page renders, polled on a timer because frame
  // callbacks are paused while the update is pending.
  assert.match(trip, /window\.setTimeout\(check, 16\)/);
  // Not for long: past the hold the trip goes on without the animation
  // rather than freezing the screen, and the page is fetched beforehand.
  assert.match(trip, /transition\?\.skipTransition\(\)/);
  assert.match(shell, /onPointerEnter=\{\(\) => warmTrip\(router, "\/"\)\}/);
  assert.match(shell, /if \(dirty && blockedTargetRef\.current !== HOME\)/);
  // Named only for the trip, in a sheet both pages load.
  assert.match(globals, /:root\[data-leaving="home"\] \.gw,\n:root\[data-leaving="home"\] \.g-mac \{\s*view-transition-name: gator-window;/);
  assert.match(globals, /::view-transition-group\(gator-window\) \{/);
});

/* ── Settings you read top to bottom ─────────────────────────────────────── */

test("a setting's field sits under its name, two across, not across the pane", async () => {
  const css = await source("src/components/Manage/manage-window.css");
  const section = await source("src/components/Manage/schema-section.tsx");

  // The name, its sentence and the control stack; the eye goes down, not
  // across nine hundred pixels to a box at the far edge.
  assert.match(css, /\.gw-set-row:has\(> \.gw-set-control\) \{\s*grid-template-columns: minmax\(0, 1fr\);/);
  // Two to a line in a panel wide enough, one in a narrow one.
  assert.match(css, /\.gw-set-roll-clip,\s*\n\.manage-root \.gw-pane \.gw-set-panel\[data-bare="true"\] \{\s*display: grid;\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(css, /@container gw-panel \(max-width: 720px\)/);
  // And no glyph column down the left of every panel: only the warning mark.
  assert.match(section, /\{problem \? \(\s*\n\s*<span className="field-icon" data-problem="true">[\s\S]{0,120}\) : null\}/);
});

test("an option alone in a panel is the panel's row, centred on its one line", async () => {
  const css = await source("src/components/Manage/manage-window.css");
  // Centred on what it marks, one line or two.
  assert.match(css, /\.manage-root \.gw-pane \.gw-opt \{\s*align-items: center;/);
  assert.match(css, /\.gw-opts > \.gw-opt:only-child,\s*\n\.manage-root \.gw-pane \.gw-card-body > \.gw-opt \{[^}]*border: 0;[^}]*border-radius: 0;/);
});

test("names in a list arrive, leave and close the gap with motion", async () => {
  const fields = await source("src/components/Manage/fields.tsx");
  const css = await source("src/components/Manage/manage-window.css");
  // Through the shared list: added, removed, or put back by Discard, a chip
  // arrives and leaves the same way, and the rest slide over.
  assert.match(fields, /<PresenceList\s*\n\s*items=\{values\}\s*\n\s*keys=\{values\}\s*\n\s*inline/);
  assert.match(fields, /function useFlipList\(/);
  const globals = await source("src/app/globals.css");
  assert.match(globals, /\.g-li\[data-inline="true"\]\[data-state="leave"\] \{/);
  void css;
  // And no typed-in colours: the chips are the window's parts.
  const editor = fields.slice(fields.indexOf("export function StringListEditor"));
  assert.doesNotMatch(editor.slice(0, editor.indexOf("\n}\n")), /#f5f2f2|white\/\[/);
});

test("the rank hierarchy rolls open rather than appearing", async () => {
  const hierarchy = await source("src/components/Manage/sections/infraction-hierarchy.tsx");
  assert.match(hierarchy, /className="gw-disclose-head"/);
  assert.match(hierarchy, /<div className="gw-set-roll" data-open=\{open \? "true" : "false"\}>\s*\n\s*<div className="gw-set-roll-clip" inert=\{!open\}>/);
  // The window's picker, not the browser's select, and no typed-in colours.
  assert.doesNotMatch(hierarchy, /<select|#f5f2f2|white\/\[/);
  // "One rank down" is a choice, not the picker's empty state.
  assert.match(hierarchy, /const ONE_DOWN = /);
});

test("the save prompt is a capsule that says it in words", async () => {
  const bar = await source("src/components/Manage/save-bar.tsx");
  const css = await source("src/components/Manage/manage-window.css");
  assert.doesNotMatch(bar, /gw-save-dot/);
  assert.doesNotMatch(css, /\.gw-save-dot \{/);
  assert.match(bar, /<span className="gw-save-count" key=\{count\}>/);
  assert.match(css, /\.gw-save \{[^}]*border-radius: 16px;/);
  // Stopped from leaving, it shakes its head instead of flashing red.
  assert.match(css, /\.gw-save\.gator-save-flash \{\s*animation: gw-save-nudge/);
  // Nothing on the window pulses while nothing is happening.
  assert.doesNotMatch(css, /@keyframes gw-beacon/);
});

test("a picture you set develops in, and shows it is going up", async () => {
  const section = await source("src/components/Manage/sections/customization.tsx");
  const css = await source("src/components/Manage/manage-window.css");
  assert.match(section, /<img key=\{preview\} src=\{preview\} alt="" className="gw-upload-img" \/>/);
  assert.match(section, /onDrop=\{\(event\) =>/);
  assert.match(section, /uploading=\{saving && Boolean\(avatar\?\.startsWith\("data:"\)\)\}/);
  assert.match(css, /@keyframes gw-develop/);
  assert.match(css, /\.gw-upload-tile\[data-busy="true"\]::after/);
});

test("a tab's header carries its glyph faintly, with no tile and no label", async () => {
  const header = await source("src/components/Manage/section-header.tsx");
  const css = await source("src/components/Manage/manage-window.css");
  assert.match(header, /className="gw-hero-ghost" aria-hidden="true"/);
  assert.doesNotMatch(header, /gw-hero-mark/);
  assert.doesNotMatch(css, /\.gw-hero-mark|\.gw-hero-eyebrow/);
  // On a phone the off switch is the mark alone.
  assert.match(css, /\.gw-power-label \{\s*display: none;/);
});

test("filtering the modules moves the cards rather than swapping the page", async () => {
  const modules = await source("src/components/Manage/sections/modules.tsx");
  const css = await source("src/components/Manage/manage-window.css");

  /* All, On and Off run inside a view transition: each visible card and heading
     is named, so the ones that stay slide to their new place and the rest fade
     out. */
  assert.match(modules, /import \{ flushSync \} from "react-dom";/);
  assert.match(modules, /onClick=\{\(\) => choose\(/);
  assert.match(modules, /data-category=\{group\.category\}/);
  assert.match(modules, /doc\.setAttribute\("data-filtering", "true"\);/);
  assert.match(modules, /flushSync\(\(\) => setOnly\(next\)\);\s*name\(\);/);
  // Named only for the transition, and only if they are on screen: a named
  // element is drawn above its scroller's clip while it moves.
  assert.match(modules, /if \(box\.bottom < view\.top \|\| box\.top > view\.bottom\) return;/);
  assert.match(modules, /element\.style\.viewTransitionName = ""/);
  assert.match(modules, /transition\.finished\.then\(done, done\);/);
  // And nothing to wait for where it cannot animate.
  assert.match(modules, /"\(prefers-reduced-motion: reduce\)"\)\.matches\s*\) \{\s*setOnly\(next\);/);

  assert.match(css, /:root\[data-filtering\]::view-transition-old\(root\) \{/);
  assert.match(css, /:root\[data-filtering\]::view-transition-group\(\*\) \{[\s\S]{0,200}cubic-bezier\(0\.32, 0\.72, 0, 1\)/);
});

test("on a phone, a part of the message opens into a sheet you can type in", async () => {
  const message = await source("src/components/Manage/discord-message.tsx");
  const embed = await source("src/components/Manage/embed-canvas.tsx");
  const container = await source("src/components/Manage/container-canvas.tsx");
  const surface = await source("src/components/Manage/discord-surface.css");
  const windowCss = await source("src/components/Manage/manage-window.css");

  /* On a phone the canvas stays the preview and text is typed in a sheet;
     inline typing at 390px meant a 14px field in a 180px strip. */
  assert.match(message, /export function usePhone\(query = "\(max-width: 640px\)"\)/);
  assert.match(message, /export function PartSheet\(/);
  assert.match(message, /export function SheetField\(/);
  // Portalled into the editor, so `{` and the insert menu still hear it.
  assert.match(message, /createPortal\(\s*<div\s+className="gw-psheet-layer"/);
  assert.match(message, /role="dialog" aria-label=\{shownTitle\} data-md-keep/);
  assert.match(message, /<MarkdownToolbar containerRef=\{sheet\} className="gw-psheet-format" \/>/);
  assert.match(message, /<InsertMenu containerRef=\{sheet\} \/>/);
  // Sixteen pixels, or iOS zooms the page into the field.
  assert.match(surface, /\.gw-psheet-input \{[\s\S]{0,500}font-size: 16px;/);
  // The keyboard pushes the sheet up rather than covering it.
  assert.match(message, /function useKeyboardCover\(active: boolean\)/);
  assert.match(surface, /margin-bottom: var\(--kb, 0px\);/);

  for (const [name, canvas] of [["embed", embed], ["container", container]] as const) {
    assert.match(canvas, /const phone = usePhone\(\);/, `${name}: no phone check`);
    assert.match(canvas, /<PartSheet host=\{host(\.current)?\} open=\{phone && (active|contentActive) !== null\}/, `${name}: no sheet`);
    assert.match(canvas, /data-phone=\{phone \? "true" : undefined\}/, `${name}: the canvas does not know`);
  }
  // A part is never typed into on the canvas while the sheet is the editor.
  assert.match(embed, /open=\{!phone && active === id\}/);
  assert.match(container, /editing=\{!phone && editing === key\}/);
  // Everything the desktop's tools could do to a block is in its sheet.
  for (const action of ["Up", "Down", "Copy", "Below", "Unbox", "Remove"]) {
    assert.match(container, new RegExp(`/> ${action}\\n`), `the container sheet cannot ${action}`);
  }

  // It covers the screen, not the panel: nothing between it and the page may
  // hold a transform, contain its layout or clip it.
  assert.match(surface, /\.gw-psheet-layer \{\s*position: fixed;\s*inset: 0;/);
  assert.match(windowCss, /\.gw-place \{\s*animation-fill-mode: backwards;/);
  assert.match(windowCss, /\.gw-md-mode \{\s*animation-fill-mode: backwards;/);
  assert.match(windowCss, /\.gw-set-panel:has\(\.gw-md\),[\s\S]{0,80}\.gw-set-row:has\(\.gw-md\) \{\s*container-type: normal;/);
  assert.match(windowCss, /\.gw-set-panel:has\(\.gw-md\) \{\s*overflow: visible;\s*clip-path: none;/);
  // And the save prompt and the dock step out of its way.
  assert.match(message, /root\.setAttribute\("data-psheet", "open"\);/);
  assert.match(surface, /:root\[data-psheet\] \.gw-save-layer,\s*:root\[data-psheet\] \.gw-dock \{/);
});

test("Customization saves with the prompt, not with a button of its own", async () => {
  const section = await source("src/components/Manage/sections/customization.tsx");
  const context = await source("src/components/Manage/manage-context.tsx");
  const bar = await source("src/components/Manage/save-bar.tsx");

  /* The profile registers with the save prompt like every other editor that
     saves to its own endpoint, instead of an always-visible Save button. */
  assert.doesNotMatch(section, /Save profile/);
  assert.doesNotMatch(section, /gw-profile-go/);
  assert.match(section, /registerExternalDraft\("bot-profile", \{[\s\S]{0,160}label: "the bot's profile",/);
  assert.match(section, /setExternalDraftDirty\("bot-profile", dirty\)/);
  // Discard puts the saved profile back.
  assert.match(section, /setDisplayName\(profile\?\.display_name \|\| ""\);\s*setAvatar\(profile\?\.avatar \|\| null\);/);

  // Every such editor is named in the prompt's list, not called a message design.
  assert.match(context, /label\?: string;/);
  assert.match(context, /externalHandlers\.current\.get\(key\)\?\.label \?\? "message design"/);
  assert.match(bar, /new Intl\.ListFormat\("en", \{ type: "conjunction" \}\)/);
  for (const [file, label] of [
    ["src/components/Manage/sections/gator-ai.tsx", "GatorAI's settings"],
    ["src/components/Manage/sections/infraction-hierarchy.tsx", "the infraction types"],
    ["src/components/Manage/sections/tickets.tsx", "a ticket panel"],
    ["src/components/Manage/workflow/workflow-workspace.tsx", "the workflows"],
  ]) {
    assert.ok((await source(file)).includes(`label: "${label}"`), `${file} is not named in the prompt`);
  }
});

test("a title is drawn as the window's own tip, not the browser's", async () => {
  const tips = await source("src/components/Manage/hover-tip.tsx");
  const shell = await source("src/components/Manage/manage-shell.tsx");

  /* Native `title` tooltips are replaced: one listener lifts the attribute
     while the pointer is on the element (so the browser never shows its own),
     draws the text in a `.gw-tip`, and puts the attribute back. */
  assert.match(tips, /export function TitleTips\(\)/);
  assert.match(tips, /element\.setAttribute\("data-gw-title", element\.getAttribute\("title"\) \|\| ""\);\s*element\.removeAttribute\("title"\);/);
  assert.match(tips, /element\.setAttribute\("title", text\);/);
  assert.match(tips, /className="gw-tip"/);
  // Placed as a HoverTip is placed, and gone on a press, a key or a scroll.
  assert.match(tips, /function placeTip\(/);
  assert.match(tips, /document\.addEventListener\("pointerdown", onPress, true\);/);
  assert.match(tips, /window\.addEventListener\("scroll", onPress, true\);/);
  assert.match(shell, /<div className="manage-root">\s*<TitleTips \/>/);

  // The chip uses the dashboard's style, not a peach pill.
  const tickets = await source("src/components/Manage/sections/tickets.tsx");
  assert.match(tickets, /className="gw-always"\s*data-on=\{effective \? "true" : undefined\}/);
  assert.doesNotMatch(tickets, /rounded-full border px-3 text-\[11px\]/);
});

test("a dropdown keeps its place while it is scrolled", async () => {
  const fields = await source("src/components/Manage/fields.tsx");

  /* The reset depends on a string key of the types, not the array: `types` was
     a default parameter, so it was a new array every render and the reset
     scrolled the list back to the top. */
  assert.match(fields, /const typeKey = types\.join\(","\);/);
  assert.match(fields, /\}, \[channels, typeKey, categoryNames\]\);/);
  assert.match(fields, /const optionsKey = useMemo\(\(\) => options\.map\(\(option\) => option\.id\)\.join\("\\n"\), \[options\]\);/);
  assert.match(fields, /\}, \[open, query, optionsKey\]\);/);
  // And a row the pointer lit is not scrolled to: it is under the pointer.
  assert.match(fields, /if \(!open \|\| !follow\.current\) return;/);
  assert.match(fields, /follow\.current = false;\s*setActive\(index\);/);
});

test("the dashboard and everything it opens are neutral greys", async () => {
  const css = await source("src/components/Manage/manage-window.css");

  /* The shared window tokens are neutral and declared on the root, so the
     window, its portalled menus and the landing's copy agree. */
  const tokens = await source("src/components/site/tokens.css");
  const dark = tokens.slice(tokens.indexOf(":root {"), tokens.indexOf(':root[data-theme="light"] {'));
  assert.match(dark, /--mac-bar: #0e0e0e;/);
  assert.match(dark, /--mac-raise: #131313;\s*--mac-raise-2: #1a1a1a;/);
  assert.match(dark, /--mac-label-dim: #9e9c99;/);
  for (const blue of ["#0d0d0f", "#111113", "#17171a", "#dbdee1", "#949ba4"]) {
    assert.ok(!new RegExp(`--mac-[a-z0-9-]+: ${blue};`).test(dark), `a window token is still ${blue}`);
  }
  assert.match(css, /:root:not\(\[data-theme="light"\]\):has\(\.manage-root\) body \{\s*background: #0a0a0a;/);
  // The list of tabs answers the pointer.
  assert.match(css, /\.gw-sheet-row:not\(\[data-current="true"\]\):hover,\s*\.gw-dock-row:not\(\[data-current="true"\]\):hover \{/);
});

test("a part of the message opens and shuts, rather than appearing", async () => {
  const message = await source("src/components/Manage/discord-message.tsx");
  const embed = await source("src/components/Manage/embed-canvas.tsx");
  const container = await source("src/components/Manage/container-canvas.tsx");
  const surface = await source("src/components/Manage/discord-surface.css");

  /* One element open or shut, so the wash has something to move between; it
     was a <div> shut and a <span> open. */
  assert.match(message, /data-open=\{open \? "true" : undefined\}\s*data-empty=\{!open && !value \? "true" : undefined\}\s*\{\.\.\.shut\}/);
  assert.doesNotMatch(message, /<span className=\{`dc-inline \$\{className\}`\} data-open="true">/);
  // Shut, it is a role="button", and the pane's rule for those had no shadow
  // in its transition, so it needs the pane's weight to keep its own.
  assert.match(surface, /\.manage-root \.gw-pane \.dc-inline\[role="button"\] \{\s*box-shadow: 0 0 0 0 transparent;/);

  // A part's tools roll open and shut, kept mounted for the roll.
  assert.match(message, /export function PartRoll\(\{ open, children \}/);
  assert.match(message, /usePresence\(open, \{ duration: 300 \}\)/);
  assert.match(message, /<div className="gw-cv-roll-clip" inert=\{!open\}>/);
  assert.equal((embed.match(/<PartRoll open=\{!phone && active === /g) || []).length, 7);
  assert.doesNotMatch(embed, /\{!phone && active === [^?\n]+ \? \(\s*<PartTools/);
  assert.match(container, /\{tools \? <PartRoll open=\{active\}>\{tools\}<\/PartRoll> : null\}/);
  assert.match(surface, /\.gw-cv-roll \{\s*display: grid;\s*grid-template-rows: 0fr;/);
  assert.match(surface, /\.gw-cv-roll\[data-state="to"\] \{\s*grid-template-rows: 1fr;/);
});

test("a field alone on its line has the whole line", async () => {
  const schema = await source("src/components/Manage/schema-section.tsx");
  const css = await source("src/components/Manage/manage-window.css");
  /* Fields sit two across; the last of an odd run sat in the left half with
     its hover stopping in the middle of the panel. */
  assert.match(schema, /function aloneFields\(runs: FieldRun\[\]\): Set<string>/);
  assert.match(schema, /if \(run\.length % 2 === 1\) alone\.add\(run\[run\.length - 1\]\);/);
  assert.match(schema, /data-wide=\{WIDE_FIELD_TYPES\.has\(run\.field\.type\) \|\| alone\.has\(run\.field\.path\) \? "true" : undefined\}/);
  assert.match(css, /> \.gw-set-row:last-child:nth-child\(odd\) \{\s*grid-column: 1 \/ -1;/);
});

test("a tab's title has no line under it restating the module", async () => {
  const header = await source("src/components/Manage/section-header.tsx");
  assert.doesNotMatch(header, /section-header-description/);
  assert.doesNotMatch(header, /description\?: string;/);
  const overview = await source("src/components/Manage/sections/overview.tsx");
  assert.doesNotMatch(overview, /overview-description/);
  for (const file of await readdir(path.join(root, "src/components/Manage/sections"))) {
    if (!file.endsWith(".tsx")) continue;
    const text = await source(`src/components/Manage/sections/${file}`);
    assert.doesNotMatch(text, /<SectionHeader[^>]*\sdescription=/, `${file} still describes its own tab`);
  }
});

test("⌘Z takes back a change to the settings, and ⇧⌘Z puts it back", async () => {
  const context = await source("src/components/Manage/manage-context.tsx");
  const shell = await source("src/components/Manage/manage-shell.tsx");
  // Every staged change is a step; typing into one field is one step.
  assert.match(context, /if \(path && steps\.last && steps\.last\.path === path && now - steps\.last\.at < 900\)/);
  assert.match(context, /if \(!\(path in staged && configValuesEqual\(staged\[path\], nextValue\)\)\) remember\(path\);/);
  assert.match(context, /const undo = useCallback\(\(\) => stepTo\("past"\), \[stepTo\]\);/);
  assert.match(context, /const redo = useCallback\(\(\) => stepTo\("future"\), \[stepTo\]\);/);
  // Saving ends the draft the history was stepping through.
  assert.match(context, /history\.current = \{ past: \[\], future: \[\], last: null \};\s*return true;/);
  // Not while typing: a text field's own undo is the one meant there.
  assert.match(shell, /if \(typing\(event\.target\)\) return;/);
  assert.match(shell, /const again = \(key === "z" && event\.shiftKey\) \|\| \(key === "y" && !event\.metaKey\);/);
  // One toast however many presses, naming what moved.
  assert.match(shell, /id: "gw-undo",/);
  assert.match(shell, /\$\{back \? "Undid" : "Redid"\}/);
});

test("a picture being dragged in lights every place it can go", async () => {
  const shell = await source("src/components/Manage/manage-shell.tsx");
  const surface = await source("src/components/Manage/discord-surface.css");
  assert.match(shell, /root\.setAttribute\("data-file-drag", "true"\);/);
  // Let go anywhere else, it is caught rather than opened in place of the page.
  assert.match(shell, /const drop = \(event: DragEvent\) => \{\s*if \(carriesFiles\(event\)\) event\.preventDefault\(\);/);
  assert.match(surface, /:root\[data-file-drag\] \.dc-imgdrop,/);
  assert.match(surface, /:root\[data-file-drag\] \.dc-imgslot::after \{\s*content: "Drop to replace";/);
});

test("the embed's colour has the same picker as a container's accent", async () => {
  const canvas = await source("src/components/Manage/embed-canvas.tsx");
  assert.match(canvas, /import \{ ColorPicker, OptionCard \} from "\.\/fields";/);
  assert.match(canvas, /<ColorPicker\s+label="Embed colour"/);
});

test("a message holds several embeds, on the canvas and in what is saved", async () => {
  const canvas = await source("src/components/Manage/embed-canvas.tsx");
  const designer = await source("src/components/Manage/message-design.tsx");
  // Added from the foot of the message, like a container's blocks, without
  // a menu of kinds.
  assert.match(canvas, /<button type="button" className="gw-cv-add gw-cv-add-embed" onClick=\{add\}>/);
  assert.match(canvas, /onEmbeds\(\[\.\.\.embeds, \{\}\]\);\s*setActive\(\{ at: embeds\.length, part: "title" \}\);/);
  assert.match(canvas, /<PresenceList\s+items=\{embeds\}\s+className="gw-cv-embeds"/);
  // Loaded and saved in the bot's own shape.
  assert.match(designer, /embeds: Array\.isArray\(doc\.embeds\) && doc\.embeds\.length > 1 \? doc\.embeds : undefined,/);
  assert.match(designer, /embed: cleanEmbed\(draftEmbeds\[0\] \|\| \{\}\),/);
});

test("a row that has finished arriving stops clipping", async () => {
  const motion = await source("src/components/motion.tsx");
  /* A row is "entering" only briefly: an entering row clips its contents, and
     rows stayed in that state for as long as they were on the page. */
  assert.match(motion, /const fresh = useRef<Map<string, number>>\(new Map\(\)\);/);
  assert.match(motion, /if \(now - at >= ENTER_MS\) fresh\.current\.delete\(key\);/);
});

test("each department is its own section, with an ordered ladder", async () => {
  const fields = await source("src/components/Manage/special-fields.tsx");
  const css = await source("src/components/Manage/manage-window.css");
  assert.match(fields, /<section className="gw-dept" aria-label=/);
  assert.match(fields, /<RankLadderField\s+roles=\{roles\}\s+value=\{ranks\}/);
  // Added already named, focused, and unrolled into place.
  assert.match(fields, /let name = "New department";/);
  assert.match(fields, /<PresenceList\s+items=\{departments\}/);
  // Two with one name are a problem the bot would not tell you about.
  assert.match(fields, /Another department has this name\. Give each one its own\./);
  // The field does not light up as one block.
  assert.match(css, /\.gw-set-row:has\(\.gw-depts\):hover \{\s*background: transparent;/);
  // The ladder's ends are named in sentence case, not in tracked capitals.
  assert.doesNotMatch(fields, /uppercase tracking-\[0\.1em\]/);
});

test("the pun arrives rather than swapping, and keeps its hyphen whole", async () => {
  const shell = await source("src/components/Manage/manage-shell.tsx");
  const css = await source("src/components/Manage/manage-window.css");
  assert.match(shell, /<span key=\{clicks\} className="gw-joke">/);
  assert.match(shell, /<span className="gw-joke-whole">\{word\}<\/span>/);
  assert.match(css, /\.gw-joke \{\s*display: inline-block;\s*animation: gw-joke-in/);
});

test("no dash reaches a page from the site's own words", async () => {
  /* Em and en dashes out of everything a person reads: text in the markup,
     strings, placeholders, toasts. Comments may keep theirs. */
  const strip = (text: string) =>
    text
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  const walk = async (dir: string): Promise<string[]> => {
    const out: string[] = [];
    for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) out.push(...(await walk(rel)));
      else if (/\.(tsx|ts)$/.test(entry.name)) out.push(rel);
    }
    return out;
  };
  const offenders: string[] = [];
  for (const file of await walk("src")) {
    const code = strip(await source(file));
    for (const line of code.split("\n")) {
      if (!/[—–]/.test(line)) continue;
      // A pattern that removes dashes from text is not a dash on a page.
      if (/replace\(\/.*[—–].*\//.test(line)) continue;
      offenders.push(`${file}: ${line.trim().slice(0, 100)}`);
    }
  }
  assert.deepEqual(offenders, []);
});

/** Whether a file is gone from the repository. */
async function isGone(relativePath: string) {
  try {
    await readFile(path.join(root, relativePath));
    return false;
  } catch {
    return true;
  }
}

test("the pages with one thing to say share the site's status screen", async () => {
  const screen = await source("src/components/status-screen.tsx");
  assert.match(screen, /export function StatusScreen\(/);
  assert.match(screen, /<main className="g-root gs-status">/);
  // The 404's gator has something to say when pressed.
  const missing = await source("src/app/not-found.tsx");
  assert.match(missing, /<StatusScreen\s+label="404"/);
  assert.match(missing, /"It went for a swim\."/);
  for (const file of ["src/app/error.tsx", "src/app/panel/[id]/error.tsx", "src/components/unauthorised.tsx", "src/app/verified/page.tsx"]) {
    const text = await source(file);
    assert.match(text, /<StatusScreen/, `${file} is not on the status screen`);
    assert.doesNotMatch(text, /bg-gradient-to-b|bg-black text-white|Unauthorized Access|Something went wrong!/, `${file} kept its old dress`);
  }
  // Read the way this version of Next hands it over.
  assert.match(await source("src/app/verified/page.tsx"), /const query = use\(searchParams\)\.u \|\| "";/);
});

test("the infractions panel is on the site, and opens without fetching every case", async () => {
  const page = await source("src/app/panel/[id]/page.tsx");
  const table = await source("src/components/Admin/infraction-table.tsx");
  const detail = await source("src/app/panel/[id]/[infid]/infraction-detail.tsx");
  assert.match(page, /<main className="g-root gs-panel">/);
  assert.match(page, /<SiteNav leading="back"/);
  assert.doesNotMatch(page, /GradientBackground|components\/Landing\/header/);
  // One prefetch as the pointer reaches a row, not one per row on mount.
  assert.match(table, /prefetch=\{false\}/);
  assert.match(table, /onPointerEnter=\{\(\) => router\.prefetch\(`\/panel\/\$\{guildId\}\/\$\{infraction\.id\}`\)\}/);
  assert.doesNotMatch(table, /console\.log/);
  // No average colour of somebody's avatar as the page's background.
  assert.doesNotMatch(detail, /getAverageColor|useGradient/);
  // Delete asks by changing its own label, not with a modal.
  assert.match(detail, /confirming \? "Press again to delete" : "Delete"/);
  assert.ok(await isGone("src/app/panel/[id]/gradient-background.tsx"));
});

test("a transcript sits under the site's header in Discord's own colours", async () => {
  const page = await source("src/app/transcript/[id]/page.tsx");
  const view = await source("src/app/transcript/[id]/transcript.tsx");
  assert.match(page, /<SiteNav leading="back" backHref="\/servers"/);
  assert.match(view, /className="gs-day" role="separator"/);
  assert.doesNotMatch(view, /bg-\[#36393f\]/);
  assert.doesNotMatch(view, /from "next\/head"/);
});

test("the small things someone thought of", async () => {
  const shell = await source("src/components/Manage/manage-shell.tsx");
  const overview = await source("src/components/Manage/sections/overview.tsx");
  // An unsaved dashboard says so in the browser tab.
  assert.match(shell, /document\.title = dirty \? `• \$\{base\}` : base;/);
  // A press of ⌘Z with nothing to undo is answered.
  assert.match(shell, /back \? "Nothing to undo" : "Nothing to redo"/);
  // Every module on is said as such.
  assert.match(shell, /\? "All on" :/);
  // The server's birthday, once a year.
  assert.match(overview, /function ServerBirthday\(\)/);
  assert.match(overview, /today\.getMonth\(\) !== made\.getMonth\(\) \|\| today\.getDate\(\) !== made\.getDate\(\)/);
  // After midnight, and the old code.
  assert.match(shell, /hour < 5 \? "Up late\? So is the gator\." : null/);
  assert.match(shell, /const KONAMI = \["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"\];/);
  // And no "New" lozenge ahead of a sentence.
  assert.doesNotMatch(await source("src/components/Manage/sections/modules.tsx"), /gw-teach-new/);
  assert.doesNotMatch(await source("src/components/Manage/hover-tip.tsx"), /gw-coach-new/);
});

test("the site is lighter to load and to install", async () => {
  const pkg = JSON.parse(await source("package.json"));
  for (const gone of ["@headlessui/react", "@hookform/resolvers", "mongodb", "react-hook-form", "zod", "gradient-shimmer"]) {
    assert.ok(!(gone in pkg.dependencies), `${gone} is installed again and nothing imports it`);
  }
  assert.ok(!("@types/canvas-confetti" in pkg.dependencies), "a types package is a runtime dependency again");
  assert.deepEqual(pkg.browserslist.slice(0, 1), ["chrome >= 111"]);
  const config = await source("next.config.js");
  assert.match(config, /formats: \['image\/avif', 'image\/webp'\]/);
  assert.match(config, /'\/modules\/:path\*'/);
  assert.match(config, /public, max-age=604800, stale-while-revalidate=2592000/);
  for (const gone of ["public/modules/sessions-before.gif", "public/gator-hero-editorial.png", "public/assets/servers/fsrp.png"]) {
    assert.ok(await isGone(gone), `${gone} is back`);
  }
  assert.match(await source("tsconfig.json"), /"target": "es2022"/);
});

test("route params and cookies are awaited, as this version of Next hands them over", async () => {
  for (const file of [
    "src/app/api/infractions/[id]/route.ts",
    "src/app/api/infractions/[id]/[singleid]/update/route.ts",
    "src/app/transcript/[id]/page.tsx",
    "src/app/panel/[id]/[infid]/actions.ts",
  ]) {
    const text = await source(file);
    assert.doesNotMatch(text, /[^(]cookies\(\)\.toString\(\)/, `${file} reads cookies synchronously`);
    assert.doesNotMatch(text, /params: \{ [a-z]+: string/, `${file} types params as a plain object`);
  }
});

test("the ticket AI's options say what they do", async () => {
  const behaviour = await source("src/components/Manage/ticket-ai-behaviour.tsx");
  assert.match(behaviour, /What it can do/);
  assert.match(behaviour, /Things the AI is allowed to do in a ticket\. If one is off, it asks staff instead\./);
  assert.doesNotMatch(behaviour, /Your knowledge can ask for these/);
  // The channels it can post in roll open with the switch.
  assert.match(behaviour, /<Reveal when=\{Boolean\(actions\.allow_notify\)\}>/);
});

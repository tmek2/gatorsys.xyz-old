# Gator product improvement roadmap

This backlog is organized around the pages and modules people already use.

- **Now:** high value and a clear delivery path.
- **Next:** larger workflow or cross-module work.
- **Later:** expansion after the core experience is calmer.
- **Shipped foundation:** already available; the row names the next useful step.

Every idea includes the user outcome, a check that tells us when it works, and
the main dependency. Ownership can be assigned during planning.

## Shared dashboard and navigation

| Priority | Status | Idea and user outcome | Acceptance check | Depends on |
| --- | --- | --- | --- | --- |
| Now | Proposed | Expand search into a command palette for navigation, creation, and recent edits. | A permitted user can reach any available module or create flow without using the sidebar. | Permission-aware route index |
| Now | Proposed | Show one plain-English review of all pending changes before a multi-module save. | The review lists each changed setting and its old and new value. | Shared draft registry |
| Now | Proposed | Add a health strip for Discord, bot API, PRC, and delayed jobs. | Every degraded dependency identifies the affected features and a recovery action. | Health endpoints |
| Next | Proposed | Add role-based dashboard homes for owners, managers, moderators, trainers, and department members. | Each role sees its pending work first and cannot see restricted work. | Permission simulator |
| Next | Proposed | Add an automatic setup checklist that links directly to missing channels, roles, and permissions. | A new server can move from incomplete to ready without searching through modules. | Configuration validation |
| Later | Proposed | Copy module presets between servers with a review before applying them. | No setting is copied until the owner approves the diff. | Versioned configuration snapshots |

## Overview

| Priority | Status | Idea and user outcome | Acceptance check | Depends on |
| --- | --- | --- | --- | --- |
| Now | Proposed | Replace simple enabled counts with `Needs attention` cards. | Missing channels, deleted roles, failed webhooks, and stale integrations appear with direct repair links. | Configuration validation |
| Next | Proposed | Add recent work and safe draft recovery. | A returning admin can resume the last three unfinished edits without losing newer saved data. | Draft version checks |
| Later | Proposed | Add owner-defined overview cards. | Owners can pin, reorder, and hide cards without changing staff permissions. | Dashboard preferences |

## Customization

| Priority | Status | Idea and user outcome | Acceptance check | Depends on |
| --- | --- | --- | --- | --- |
| Now | Proposed | Add a live theme preview for bot messages and public pages. | Color, logo, and wording changes can be previewed before saving. | Shared preview renderer |
| Next | Proposed | Add named brand presets for departments or events. | Switching a preset updates only the fields shown in its review. | Preset storage |
| Later | Proposed | Add accessibility checks for contrast, button labels, and image descriptions. | The page flags every failing value and suggests a compliant replacement. | Contrast and content rules |

## Permissions

| Priority | Status | Idea and user outcome | Acceptance check | Depends on |
| --- | --- | --- | --- | --- |
| Now | Proposed | Add a permission simulator for a selected role or member. | The preview shows every page, control, and review action the subject can use. | Shared permission evaluator |
| Now | Proposed | Warn about permission gaps before a module is enabled. | The owner sees the exact missing Discord permissions and affected actions. | Bot permission inventory |
| Later | Proposed | Add reusable permission profiles with a review before applying them. | Applying a profile never silently removes custom overrides. | Permission diff |

## Logging

| Priority | Status | Idea and user outcome | Acceptance check | Depends on |
| --- | --- | --- | --- | --- |
| Now | Proposed | Add delivery health for every configured log destination. | Deleted channels, missing permissions, and repeated send failures appear with repair actions. | Log delivery telemetry |
| Next | Proposed | Add retention controls and export by log type. | Owners can export a bounded date range and see when each category expires. | Export worker |
| Later | Proposed | Add anomaly alerts for sudden drops or spikes in expected logs. | The alert names the module, baseline, and affected period. | Historical metrics |

## Audit

| Priority | Status | Idea and user outcome | Acceptance check | Depends on |
| --- | --- | --- | --- | --- |
| Now | Proposed | Add filters for person, module, action, result, and date. | A reviewer can isolate one incident without scanning unrelated records. | Indexed audit fields |
| Next | Proposed | Add a human-readable before-and-after comparison. | Every configuration change shows only the values that changed. | Structured audit payloads |
| Next | Proposed | Send scheduled owner summaries for risky changes and repeated failures. | Owners can choose cadence, audience, and risk threshold. | Scheduled jobs |
| Later | Proposed | Add reversible configuration snapshots. | Restoring a snapshot shows and confirms the full diff first. | Versioned config store |

## Staff panel and departments

| Priority | Status | Idea and user outcome | Acceptance check | Depends on |
| --- | --- | --- | --- | --- |
| Now | Proposed | Add one staff inbox for leave, promotions, feedback, applications, and reviews. | A manager can process all assigned work without changing modules. | Normalized assignment states |
| Now | Proposed | Add bulk roster actions with preview and confirmation. | The preview identifies every member and role change before execution. | Bulk action API |
| Next | Proposed | Add shift handoff notes, staffing gaps, and an availability calendar. | The next shift can see uncovered roles and acknowledged handoff items. | Schedule data |
| Next | Proposed | Add editable department starters for Police, Fire, EMS, Dispatch, DOT, and Judicial. | A starter creates a working draft and never locks fields. | Department templates |
| Later | Proposed | Add cross-department incident workspaces with assignments, resources, and an after-action report. | One incident produces a complete, permission-aware timeline. | Cross-department access rules |

## Moderation and staff operations

| Priority | Module | Idea and user outcome | Acceptance check | Depends on |
| --- | --- | --- | --- | --- |
| Now | Infractions | Group related cases, evidence, appeal status, and expiring actions. | A reviewer can follow one case from report through final outcome. | Case relation IDs |
| Now | Promotions | Add eligibility rules and approval chains. | Ineligible requests explain the exact unmet rule before submission. | Rank rules |
| Next | Promotions | Roll back cleanly when a Discord role update fails. | The record and Discord roles never disagree silently. | Compensating actions |
| Now | Suspensions | Add return-to-duty checklists and end reminders. | The assigned manager sees every incomplete step before reinstatement. | Scheduled reminders |
| Next | Leave of Absence | Warn about calendar overlap and staffing impact; delegate approval when needed. | The approver sees uncovered roles and the active delegate. | Schedule and delegation data |
| Now | Message Quota | Prorate for leave, new staff, and partial weeks; warn before failure. | The calculation explains the target and each adjustment. | Staff activity periods |
| Later | Staff history | Combine roles, attendance, infractions, leave, feedback, and training. | Authorized staff can review one chronological member history. | Cross-module event model |

## Staff feedback and Training Academy

| Priority | Status | Idea and user outcome | Acceptance check | Depends on |
| --- | --- | --- | --- | --- |
| Now | Proposed | Add named or anonymous feedback, follow-up status, and private reviewer notes. | The submitter knows the privacy mode before sending and reviewers can track resolution. | Feedback visibility rules |
| Next | Proposed | Add training paths with prerequisites, practical evaluations, retries, and certificate expiry. | A trainee always sees the next available requirement and why others are locked. | Training graph |
| Next | Proposed | Recommend training from recent feedback or repeated moderation mistakes. | Every recommendation cites the rule that triggered it and can be dismissed. | Recommendation rules |
| Later | Proposed | Launch scenario evaluations into a Discord thread and collect assessor scores. | The final score links back to evidence and assessor notes. | Thread workflow |

## Tickets and modmail

| Priority | Status | Idea and user outcome | Acceptance check | Depends on |
| --- | --- | --- | --- | --- |
| Now | Proposed | Add routing by topic, role, language, working hours, and department. | A test case shows the exact route before the rule is published. | Routing evaluator |
| Now | Proposed | Add saved replies with variables and a send preview. | The preview resolves variables and blocks missing required values. | Shared variable renderer |
| Next | Proposed | Add service targets, escalation timers, handoff notes, collision warnings, and workload balancing. | Two staff cannot unknowingly answer the same case and overdue work has an owner. | Assignment presence |
| Next | Proposed | Add one member contact timeline across tickets, modmail, forms, and appeals. | Authorized staff can trace a conversation without exposing unrelated private content. | Privacy-aware event model |
| Later | Proposed | Sample closed conversations for configurable quality review. | Review selection, scoring, and follow-up are auditable. | Review queue |

## Community modules

| Priority | Module | Idea and user outcome | Acceptance check | Depends on |
| --- | --- | --- | --- | --- |
| Now | Suggestions | Add duplicate detection, roadmap links, status history, and a shipped changelog. | A possible duplicate appears before submission and accepted ideas can link to delivery. | Text similarity and public status |
| Now | Daily Questions | Add a calendar, prompt library, highlights, and quiet-day skip rules. | Staff can preview the next month and reschedule without duplicates. | Scheduler |
| Next | Welcome | Add audience rules for account age, verification, referral source, and returning members. | A sample member preview explains which message and roles they receive. | Rule tester |
| Now | Auto Response | Add sample-message testing, priority order, cooldown preview, and a match log. | A rule test shows the winning rule and why others lost. | Deterministic rule engine |
| Later | Community analytics | Connect prompts and welcomes to meaningful participation rather than raw messages. | Reports define the activity signal and comparison period. | Event analytics |

## Utility and integration modules

| Priority | Module | Idea and user outcome | Acceptance check | Depends on |
| --- | --- | --- | --- | --- |
| Now | Connection Roles | Add dependency warnings, loop detection, history, and `Repair now`. | Invalid chains cannot be published and drift can be repaired safely. | Role graph |
| Next | Giveaways | Add eligibility preview, fraud signals, reroll history, sponsor fields, and follow-up messages. | Every winner and reroll records the evaluated rules. | Entry audit |
| Next | Reminders | Add recurring schedules, time-zone preview, retries, and a calendar. | The next three deliveries are visible in the user's selected zone. | Recurrence engine |
| Next | Partnerships | Add intake, directory, renewal reminders, and performance follow-up. | Staff can see each partner's owner, term, and next action. | Partner records |
| Next | Packages | Add versions, usage, expiry, limited claims, and a recipient dry run. | The dry run lists every resulting role, command, and message. | Versioned package model |
| Now | PRC | Validate commands and add incident presets, health history, and guarded emergency controls. | A dangerous command names its audience and requires the configured confirmation. | PRC command metadata |
| Next | Sessions | Add a live control room for staffing, queue, votes, attendance gaps, and the after-action summary. | Hosts can run the session from one page and export the final timeline. | Live session events |
| Next | Roblox | Add purchase history, failed-delivery repair, mapping checks, and test transactions. | A test transaction proves the mapping without granting a real product. | Sandbox delivery path |
| Later | Cross-module incidents | Connect PRC, sessions, and department activity into one timeline. | One incident ID links the related events without duplicating them. | Shared incident model |

## Commands

| Priority | Status | Idea and user outcome | Acceptance check | Depends on |
| --- | --- | --- | --- | --- |
| Shipped foundation | Available | Command AI can draft the command name, inputs, message, embeds, buttons, forms, review actions, permissions, and multi-step workflows from one outcome description. | The full draft is editable before it is saved, and website and bot tests cover the complete payload. | None |
| Now | Proposed | Add `Test privately` before publishing a command. | The test uses real validation and shows the exact private response without syncing the command. | Dry-run executor |
| Now | Proposed | Add an AI draft review that highlights every created dependency and unresolved role or channel. | A draft cannot be published until missing dependencies are fixed or intentionally removed. | Dependency validator |
| Now | Proposed | Show dependencies before deletion. | The confirmation lists every button, template, and panel that would break. | Usage index |
| Next | Proposed | Add workflow run logs with variables, result, failure, and retry. | Staff can trace every step without exposing secrets. | Structured execution events |
| Next | Proposed | Add an editable workflow recipe library for common staff and community tasks. | Applying a recipe creates a normal draft and never publishes automatically. | Recipe storage |

## Message templates

| Priority | Status | Idea and user outcome | Acceptance check | Depends on |
| --- | --- | --- | --- | --- |
| Shipped foundation | Available | Commands and templates now have separate library views, guided editing, and delete/discard confirmations. | Covered by website regression tests. | None |
| Now | Proposed | Add duplicate-and-edit, usage locations, and dependency-aware deletion. | A template shows every consumer and deletion cannot surprise the user. | Usage index |
| Next | Proposed | Add versions and side-by-side change review. | Staff can restore or compare any published version. | Template version store |

## Forms and review workflows

| Priority | Status | Idea and user outcome | Acceptance check | Depends on |
| --- | --- | --- | --- | --- |
| Shipped foundation | Available | Form buttons support inline questions, answer channels, cooldowns, blacklist roles, post-submit workflows, ban appeals, and generic reviewed forms with fully editable decision buttons. | Website regressions and the complete bot test suite pass. | None |
| Shipped foundation | Available | Every form answer card identifies the Discord submitter, and forms that require Roblox verification also include the verified Roblox identity. | Submission rendering tests cover both Discord and Roblox identity details. | None |
| Now | Proposed | Add `Test privately` with a full sample submission and review path. | The test resolves variables and exercises review permissions without creating a real case. | Dry-run executor |
| Now | Proposed | Add an assignment and review queue for applications, reports, approvals, and exception requests. | Every reviewed form has an owner, status, due date, and complete decision history. | Review assignment model |
| Next | Proposed | Add starts, completions, decisions, response time, and question drop-off analytics. | Reports separate abandoned forms from submitted and reviewed forms. | Form event tracking |
| Next | Proposed | Add saved workflow recipes for role menus, rules acknowledgement, applications, incident reports, ban appeals, ticket launchers, and ER:LC commands. | Applying a recipe creates an editable draft and lists every dependency. | Recipe library |

## Resources

| Priority | Status | Idea and user outcome | Acceptance check | Depends on |
| --- | --- | --- | --- | --- |
| Now | Proposed | Add a clear public/private access preview and expiring share links. | The preview names who can open the resource before publishing. | Share token service |
| Next | Proposed | Add approvals and scheduled publishing. | A pending version cannot replace the live resource without the required approval. | Resource versions |
| Later | Proposed | Add viewer analytics with privacy controls. | Owners can see aggregate use without exposing unnecessary member data. | Privacy-safe analytics |

## Public pages

| Priority | Page | Idea and user outcome | Acceptance check | Depends on |
| --- | --- | --- | --- | --- |
| Shipped foundation | Landing | The hero, scrolling story, card deck, cursor labels, page transitions, and animated footer now use source-matched editorial motion without copying the reference brand or imagery. | Desktop browser evidence and responsive regressions are recorded in `design-qa.md`. | None |
| Now | Landing | Add two short interactive module stories deeper on the page. | Each story has one working task and a direct dashboard destination. | Public demo data |
| Shipped foundation | Servers | A route loading shell, stale-cache path, and hard request deadline prevent indefinite waiting. | Website tests cover the shell and deadline; signed-in browser QA remains to be added. | None |
| Now | Servers | Add search, recent servers, favorites, keyboard opening, last-known-data timestamps, and per-service retry details. | A user with many servers can open one quickly and can tell whether Discord, the bot, or cached data caused a degraded result. | User preferences and service health |
| Now | Manage | Add pinned modules and `Continue editing` with safe draft recovery. | A returning user resumes the correct draft or sees a conflict review. | Draft version checks |
| Next | Departments | Add a member home with schedule, announcements, resources, and responsibilities. | A member can find today's work without opening admin pages. | Member portal queries |
| Later | Public status | Publish bot, dashboard, PRC, and Discord integration health. | Each incident has a start time, affected functions, and update history. | Public health feed |

## Account and public utility pages

| Priority | Page family | Idea and user outcome | Acceptance check | Depends on |
| --- | --- | --- | --- | --- |
| Now | Discord sign-in and session recovery | Explain expired sessions and return people to the page they originally opened after signing in again. | A forced expiry names the problem, preserves the destination, and never loops between Gator and Discord. | Auth return-state storage |
| Now | Roblox account linking | Show current verification, affected features, and a safe relink path. | A user can test the link and see which forms, roles, or purchases depend on it before unlinking. | Verification health endpoint |
| Next | Owner tools | Add server health, queued jobs, safe support actions, and a complete action history. | Every owner action names its scope, requires confirmation when risky, and appears in the audit trail. | Owner audit model |
| Now | Public panels, infractions, and transcripts | Add clear access explanations, print/export controls, and expiry states. | Authorized viewers can identify the server, record, privacy level, and expiry without exposing restricted data. | Public access policy |
| Now | Application submission and review | Add save-and-resume, completion progress, and a plain review-status timeline. | Applicants can return safely and reviewers can explain the current state without private notes leaking. | Versioned application drafts |
| Next | Shared resources and document readers | Add a contents panel, search, update notices, and expiring share links. | A reader can find a section, identify the current version, and understand when access ends. | Resource versions and share tokens |
| Now | Department join flows | Preview the destination, required verification, role changes, and application steps before joining. | A member sees every requirement and resulting access before confirming. | Join preview API |
| Later | Privacy and terms | Add a dated change summary and a route from each policy statement to its related account control. | A visitor can see what changed and act on the relevant data or account setting. | Policy change log |

## Suggested delivery order

1. Setup health, permission simulator, usage-aware deletion, and private testing.
2. AI dependency review, reviewed-form assignments, ticket routing, and workflow run logs.
3. Staff inbox, session control room, member history, analytics, and reusable server presets.

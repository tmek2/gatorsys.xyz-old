"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconArrowLeft, IconArrowRight, IconCheck, IconGitBranch, IconPlayerPlay, IconPlus, IconSearch, IconArrowBackUp, IconArrowForwardUp } from "@tabler/icons-react";
import { useManage } from "../manage-context";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BLOCKS_BY_TYPE } from "./blocks";
import {WorkflowCanvas, WorkflowShell, type WorkflowGraph, type WorkflowNode} from "./workflow-canvas";
import { automationToGraph, graphToAutomation } from "./serialize";
import { workflowIssues, type WorkflowCapabilities, type WorkflowIssue } from "./validation";
import "./workflow.css";
import "./workspace.css";

type Workflow = { _id: string; name: string; enabled: boolean; trigger: string; graph?: WorkflowGraph; steps?: { type: string }[]; cooldown_seconds?: number; last_run_at?: string; issues?: WorkflowIssue[] };
type Run = { _id: string; automation_id: string; automation_name: string; created_at: string; notes: string[] };
const empty: WorkflowGraph = { nodes: [], edges: [] };
const templates = [
  { name: "Welcome new members", category: "Discord", description: "Give the joining member a role and send a welcome message.", trigger: "member.joined", steps: ["role_add", "dm"], text: "Welcome to the server, {user.name}!" },
  { name: "Announce shift starts", category: "Staff", description: "Post in your staff channel when someone clocks in.", trigger: "shift.started", steps: ["send"], text: "{user.mention} has started their shift." },
  { name: "Low player-count alert", category: "ER:LC", description: "Notify Discord when your game drops below a chosen player count.", trigger: "erlc.count.dropped", steps: ["send"], text: "The game player count has dropped. Time for a session boost?" },
  { name: "Game welcome", category: "ER:LC", description: "Send a private in-game message to each arriving player.", trigger: "erlc.player.joined", steps: ["erlc.pm"], text: "Welcome! Please follow the server rules." },
  { name: "Application accepted", category: "Staff", description: "Give accepted applicants a role and explain their next steps.", trigger: "application.approved", steps: ["role_add", "dm"], text: "Your application was accepted! Welcome to the team." },
  { name: "Daily reminder", category: "Discord", description: "Post a recurring reminder at a specific UTC time.", trigger: "schedule.daily", steps: ["send"], text: "Daily reminder: check the announcements and upcoming sessions." },
  { name: "Ticket follow-up", category: "Discord", description: "Send a follow-up message when a member’s ticket closes.", trigger: "ticket.closed", steps: ["dm"], text: "Your ticket has closed. Thank you for contacting the team." },
  { name: "Staff-only message", category: "Conditions & data", description: "Check a member’s role, then reply only when the condition passes.", trigger: "message.sent", steps: ["guard", "reply"], text: "Thanks for checking in, {user.name}." },
];

export function starterGraph(template: typeof templates[number]): WorkflowGraph {
  const trigger = { id: "event", type: template.trigger, x: 80, y: 80, values: template.trigger === "schedule.daily" ? { time: "18:00" } : template.trigger.includes("count.") ? { threshold: "10" } : {} } as WorkflowNode;
  const graph: WorkflowGraph = { nodes: [trigger], edges: [] };
  let previous = trigger.id;
  template.steps.forEach((type, index) => {
    const id = `step-${index}`; const block = BLOCKS_BY_TYPE[type];
    const values: Record<string, string> = {};
    for (const p of block.inputs) if (["text", "content", "message"].includes(p.id) && p.type === "text") values[p.id] = template.text;
    graph.nodes.push({ id, type, x: 480 + index * 400, y: 80, values });
    graph.edges.push({ id: `flow-${index}`, from: { node: previous, port: "next" }, to: { node: id, port: "in" } });
    for (const p of block.inputs.filter(p => ["member", "player", "message"].includes(p.type))) {
      const source = BLOCKS_BY_TYPE[trigger.type].outputs.find(out => out.type === p.type);
      if (source) graph.edges.push({ id: `data-${index}-${p.id}`, from: { node: trigger.id, port: source.id }, to: { node: id, port: p.id } });
    }
    previous = id;
  });
  if (template.steps.includes("guard")) {
    graph.nodes.push({ id: "condition", type: "has_role", x: 80, y: 480 });
    graph.edges.push({ id: "condition-member", from: { node: "event", port: "member" }, to: { node: "condition", port: "member" } }, { id: "condition-result", from: { node: "condition", port: "result" }, to: { node: "step-0", port: "test" } });
  }
  return graph;
}

function errorMessage(data: any) { return typeof data?.detail === "string" ? data.detail : data?.detail?.message || data?.message || "The request failed. Please try again."; }

export function WorkflowWorkspace() {
  const { guildId, meta, registerExternalDraft, setExternalDraftDirty } = useManage();
  const canEdit = !!meta?.me.isAdmin;
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [capabilities, setCapabilities] = useState<WorkflowCapabilities>({ erlc: false, supported: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState<Workflow | null>(null);
  const [name, setName] = useState("");
  const [graph, setGraph] = useState<WorkflowGraph>(empty);
  const [saved, setSaved] = useState("");
  const [mode, setMode] = useState<"editor" | "history" | "settings">("editor");
  const [query, setQuery] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [undo, setUndo] = useState<WorkflowGraph[]>([]);
  const [redo, setRedo] = useState<WorkflowGraph[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const snapshot = JSON.stringify({ name, graph, cooldown });
  const dirty = editing && snapshot !== saved;
  const issues = useMemo(() => workflowIssues(graph, capabilities), [graph, capabilities]);
  const saveRef = useRef<() => Promise<boolean>>(async () => false);
  const discardRef = useRef<() => void>(() => {});
  const historyGroupRef = useRef<string | undefined>(undefined);

  const load = useCallback(async (refresh = false) => {
    if (!refresh) setLoading(true);
    setLoadFailed(false);
    try {
      const response = await fetch(`/api/manage/${guildId}/automations`, { signal: AbortSignal.timeout(20000) });
      const data = await response.json();
      if (!response.ok) throw Error(errorMessage(data));
      setWorkflows(data.automations || []); setRuns(data.runs || []);
      setCapabilities(data.capabilities || { erlc: false, supported: [] });
      const path = window.location.pathname.split("/");
      const id = path[path.indexOf("workflows") + 1];
      const linked = (data.automations || []).find((w: Workflow) => w._id === id);
      if (linked && !refresh) open(linked);
    } catch (e) { setLoadFailed(true); setNotice(e instanceof Error ? e.message : "Could not load workflows."); }
    finally { setLoading(false); }
  }, [guildId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => registerExternalDraft("workflows", { save: () => saveRef.current(), discard: () => discardRef.current(), label: "the workflows" }), [registerExternalDraft]);
  useEffect(() => { setExternalDraftDirty("workflows", dirty); return () => setExternalDraftDirty("workflows", false); }, [dirty, setExternalDraftDirty]);
  useEffect(() => {
    if (!dirty) return;
    const before = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", before); return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);

  function change(next: WorkflowGraph, historyGroup?: string) { if(!historyGroup || historyGroup !== historyGroupRef.current) setUndo(old => [...old.slice(-39), graph]); historyGroupRef.current = historyGroup; setRedo([]); setGraph(next); setNotice(""); }
  function open(workflow: Workflow | null, initial = empty, title = "Untitled workflow") {
    const next = workflow ? automationToGraph(workflow) : initial;
    setConfirmDelete(false); setCurrent(workflow); setGraph(next); setName(workflow?.name || title); setCooldown(workflow?.cooldown_seconds || 0);
    setSaved(JSON.stringify({ name: workflow?.name || title, graph: workflow ? next : empty, cooldown: workflow?.cooldown_seconds || 0 }));
    setEditing(true); setMode("editor"); setNotice(""); setUndo([]); setRedo([]);
  }
  async function request(body: Record<string, unknown>) {
    const response = await fetch(`/api/manage/${guildId}/automations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) });
    const data = await response.json(); if (!response.ok) throw Error(errorMessage(data)); return data;
  }
  async function save(enabled = current?.enabled || false) {
    if (!canEdit || busy || !graph.nodes.length) return false;
    if (enabled && issues.length) { setNotice("Fix the highlighted blocks before enabling this workflow."); return false; }
    setBusy(true); setNotice("");
    try {
      const derived = graphToAutomation(graph);
      const data = await request({ action: "upsert", id: current?._id, name, graph, ...derived, enabled, cooldown_seconds: cooldown });
      const list: Workflow[] = data.automations || []; setWorkflows(list);
      setCurrent(list.find(w => w._id === (data.id || current?._id)) || current);
      const savedId = data.id || current?._id;
      if (savedId && window.location.pathname.startsWith("/manage/")) window.history.replaceState(window.history.state, "", `/manage/${guildId}/workflows/${savedId}`);
      setSaved(snapshot); setNotice(enabled ? "Saved and enabled. Listening for the starting event." : "Draft saved. It will stay paused until you enable it."); return true;
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not save."); return false; }
    finally { setBusy(false); }
  }
  saveRef.current = () => save();
  discardRef.current = () => { if (current) open(current); else { setEditing(false); setGraph(empty); } };


  function leave() {
    setConfirmLeave(false);
    setEditing(false); setQuery("");
    if (window.location.pathname.startsWith("/manage/")) window.history.replaceState(window.history.state, "", `/manage/${guildId}/workflows`);
  }
  function back() { if (dirty) setConfirmLeave(true); else leave(); }
  async function check() {
    setBusy(true);
    try {
      const data = await request({action:"validate",graph,trigger:graphToAutomation(graph).trigger});
      setNotice(data.valid ? "Checked successfully. No actions were taken." : data.issues.map((i:WorkflowIssue)=>i.message).join(" "));
    } catch(e) { setNotice(e instanceof Error ? e.message : "Check failed."); }
    finally { setBusy(false); }
  }
  const status = <div className="wf-feedback" role="status">{notice}<button onClick={()=>setNotice("")} aria-label="Dismiss notice">×</button></div>;
  if (loading) return <p role="status">Loading workflows…</p>;
  if (!editing) return <section className="wf-index" aria-label="Workflows">
    <header><div><h1>Workflows</h1><p>Connect events, actions, and data on your canvas.</p></div><button className="wf-settings-action" disabled={!canEdit} onClick={()=>open(null)}>Create workflow <IconPlus size={16}/></button></header>
    {notice && status}
    {loadFailed && <button className="wf-settings-action" onClick={()=>void load()}>Try loading again</button>}
    <div className="wf-integration"><span>{capabilities.erlc ? "ER:LC connected" : "ER:LC not connected"}</span><a href={`/manage/${guildId}/prc`}>{capabilities.erlc ? "Manage connection" : "Connect ER:LC"} <IconArrowRight size={15}/></a></div>
    <label className="wf-index-search"><IconSearch size={16}/><input aria-label="Search workflows" placeholder="Search workflows" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <div className="wf-index-list">{workflows.filter(w=>w.name.toLowerCase().includes(query.toLowerCase())).map(w=><button key={w._id} onClick={()=>open(w)}><IconGitBranch size={20}/><span><strong>{w.name}</strong><small>{BLOCKS_BY_TYPE[w.trigger]?.label || w.trigger}</small></span><span className="wf-index-status">{w.issues?.length ? "Needs attention" : w.enabled ? "Enabled" : "Paused"}</span><IconArrowRight size={16}/></button>)}{!workflows.length&&<p>No workflows yet. Start with a blank canvas or a template below.</p>}</div>
    <h2>Start from a template</h2><p>A connected canvas to build on. Choose the channels, roles, and rules for your server.</p>
    <div className="wf-recipe-grid">{templates.map(t=><button key={t.name} disabled={!canEdit} onClick={()=>open(null,starterGraph(t),t.name)}><small>{t.category}</small><strong>{t.name}</strong><span>{t.description}</span><IconArrowRight size={16}/></button>)}</div>
  </section>;
  return <section className="wf-page wf-workspace-editor" aria-label="Workflow editor"><div className="wf-page-inner">
    <WorkflowShell name={name} onRename={canEdit && !busy ? setName : undefined} readOnly={!canEdit || busy} enabled={!!current?.enabled} onToggle={()=>{if(!busy)void save(!current?.enabled);}} tab={mode} onTab={setMode} status={!canEdit ? "View only" : dirty ? "Unsaved changes" : current ? "Saved" : "New draft"} actions={<>
      <button className="wf-settings-action" disabled={busy} onClick={()=>void back()} aria-label="Back to workflows"><IconArrowLeft size={16}/></button>
      <button className="wf-settings-action" disabled={!canEdit||busy||!undo.length} aria-label="Undo" onClick={()=>{setRedo(r=>[...r,graph]);setGraph(undo[undo.length-1]);setUndo(u=>u.slice(0,-1));setNotice("");}}><IconArrowBackUp size={16}/></button>
      <button className="wf-settings-action" disabled={!canEdit||busy||!redo.length} aria-label="Redo" onClick={()=>{setUndo(u=>[...u,graph]);setGraph(redo[redo.length-1]);setRedo(r=>r.slice(0,-1));setNotice("");}}><IconArrowForwardUp size={16}/></button>
      <button className="wf-settings-action" disabled={!canEdit||busy} onClick={()=>void check()}><IconCheck size={16}/>Check</button>
      <button className="wf-settings-action" disabled={!canEdit||busy||!graph.nodes.length} onClick={()=>void save()}>{busy ? "Saving…" : "Save"}</button>
    </>}>
      <div className="wf-editor-content">
        {notice && status}
        {mode === "editor" ? <WorkflowCanvas graph={graph} onChange={change} readOnly={busy||!meta?.me.isAdmin} capabilities={capabilities} workflows={workflows}/> : mode === "history" ? <div className="wf-workspace-panel"><h2>Run history</h2><p>Checking a workflow does not run its actions. These are actual attempts recorded by the bot.</p>
          {current?.trigger === "manual" && <button className="wf-settings-action" disabled={!canEdit||busy||dirty||!!issues.length} onClick={async()=>{setBusy(true);try{const data=await request({action:"run",id:current._id});setNotice((data.notes||[]).join(" ")||"Run completed.");await load(true);}catch(e){setNotice(e instanceof Error?e.message:"Run failed.");}finally{setBusy(false);}}}><IconPlayerPlay size={16}/>Run saved workflow now</button>}
          {runs.filter(r=>r.automation_id===current?._id).map(r=><article key={r._id}><strong>{new Date(r.created_at).toLocaleString()}</strong><ul>{r.notes?.length?r.notes.map((note,i)=><li key={i}>{note}</li>):<li>Completed with no reported issues.</li>}</ul></article>)}
          {!runs.some(r=>r.automation_id===current?._id)&&<p>No runs yet. Enable the workflow and perform its starting event.</p>}
        </div> : <div className="wf-workspace-panel"><h2>Workflow settings</h2><label>Minimum time between runs (seconds)<input disabled={!canEdit||busy} type="number" min={0} max={86400} value={cooldown} onChange={e=>setCooldown(Math.max(0,Math.min(86400,Number(e.target.value))))}/></label><p>Use a cooldown to avoid repeated actions on busy events. 0 allows every event.</p>
          <h3>{issues.length ? "Finish setup before enabling" : "Ready to enable"}</h3><ul>{issues.map((i,index)=><li key={index}>{i.message}</li>)}</ul>
          <button className="wf-settings-action" disabled={!canEdit||busy||!graph.nodes.length} onClick={()=>void save(!current?.enabled)}>{current?.enabled ? "Save and pause" : "Save and enable"}</button>
          <h3>Connections</h3><p>{capabilities.erlc ? "ER:LC is connected." : "ER:LC triggers, actions, and lookups require a linked server with its ERLC module enabled."}</p><a href={`/manage/${guildId}/prc`}>Open ERLC settings</a>
          {current&&canEdit&&<><h3>Delete workflow</h3><p>This removes the saved workflow and stops future runs.</p>{confirmDelete?<><button className="wf-settings-action wf-settings-action-danger" disabled={busy} onClick={async()=>{setBusy(true);try{const data=await request({action:"delete",id:current._id});setWorkflows(data.automations||[]);leave();setConfirmDelete(false);setNotice("Workflow deleted.");}catch(e){setNotice(e instanceof Error?e.message:"Could not delete.");}finally{setBusy(false);}}}>Delete permanently</button><button className="wf-settings-action" onClick={()=>setConfirmDelete(false)}>Keep workflow</button></>:<button className="wf-settings-action wf-settings-action-danger" onClick={()=>setConfirmDelete(true)}>Delete workflow</button>}</>}
        </div>}
      </div>
    </WorkflowShell>
  </div><Dialog open={confirmLeave} onOpenChange={setConfirmLeave}><DialogContent className="wf-leave-dialog" overlayClassName="z-[99]"><DialogTitle>Leave this workflow?</DialogTitle><DialogDescription>Your changes haven’t been saved.{current?.enabled ? " Saving a paused draft will also pause this workflow." : " You can save them as a paused draft and finish later."}</DialogDescription><div className="wf-leave-actions"><button className="wf-settings-action" onClick={()=>setConfirmLeave(false)}>Keep editing</button><button className="wf-settings-action" onClick={leave}>Discard changes</button><button className="wf-settings-action" disabled={!canEdit||busy||!graph.nodes.length} onClick={async()=>{if(await save(false))leave();}}>Save paused draft and leave</button></div></DialogContent></Dialog></section>;
}

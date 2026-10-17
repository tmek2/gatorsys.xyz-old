import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
const require=createRequire(import.meta.url);
const ts=require("typescript");
const cache:Record<string,any>={};
function load(name:string):any {
 if(cache[name])return cache[name];
 const filename=path.resolve("src/components/Manage/workflow",name+".ts");
 const source=ts.transpileModule(readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const module={exports:{}};
 new Function("require","module","exports",source)((name:string)=>load(name.replace("./","")),module,module.exports);
 return cache[name]=module.exports;
}
const {workflowIssues,connectionProblem}=load("validation");
const {portsCompatible}=load("blocks");
const {graphToAutomation,automationToGraph}=load("serialize");
const {insertFlowStep,removeFlowStep}=load("graph-editing");
const n=(id:string,type:string,values:Record<string,string>={})=>({id,type,x:0,y:0,values});
const e=(a:string,ap:string,b:string,bp:string)=>({id:`${a}:${ap}:${b}:${bp}`,from:{node:a,port:ap},to:{node:b,port:bp}});

test("inserting a step keeps both sides connected and preserves other routes and data",()=>{
 const graph={nodes:[n("t","member.joined"),n("r","role_add",{role:"123"}),n("s","send",{channel:"456",text:"hello"})],edges:[e("t","next","r","in"),e("r","next","s","in"),e("t","member","r","member")]};
 const before=JSON.stringify(graph);
 const result=insertFlowStep(graph,"r:next:s:in",n("w","wait",{seconds:"5"}));
 assert.ok(result);
 assert.ok(result.edges.some(link=>link.from.node==="r"&&link.to.node==="w"));
 assert.ok(result.edges.some(link=>link.from.node==="w"&&link.to.node==="s"));
 assert.ok(result.edges.some(link=>link.from.port==="member"&&link.to.node==="r"));
 assert.equal(result.nodes.find(node=>node.id==="s").x,410);
 assert.deepEqual(result.nodes.map(node=>node.id),["t","r","w","s"]);
 assert.equal(JSON.stringify(graph),before);
 assert.deepEqual(workflowIssues(result),[]);
});

test("insertion preserves a branch's unselected route and rejects data wires or branching replacements",()=>{
 const graph={nodes:[n("t","manual"),n("b","branch",{test:"true"}),n("a","wait",{seconds:"1"}),n("z","wait",{seconds:"1"})],edges:[e("t","next","b","in"),e("b","then","a","in"),e("b","else","z","in")]};
 const result=insertFlowStep(graph,"b:then:a:in",n("new","wait",{seconds:"2"}));
 assert.ok(result.edges.some(link=>link.id==="b:else:z:in"));
 assert.equal(result.nodes.find(node=>node.id==="z").x,0);
 assert.equal(insertFlowStep(graph,"b:then:a:in",n("bad","branch")),null);
 const dataGraph={nodes:[n("a","number_value"),n("b","add")],edges:[e("a","value","b","a")]};
 assert.equal(insertFlowStep(dataGraph,dataGraph.edges[0].id,n("w","wait")),null);
});

test("removing a simple step closes its route but removing a branch never guesses a path",()=>{
 const graph={nodes:[n("t","manual"),n("w","wait"),n("s","send")],edges:[e("t","next","w","in"),e("w","next","s","in")]};
 const result=removeFlowStep(graph,"w");
 assert.equal(result.reconnected,true);
 assert.equal(result.graph.edges[0].from.node,"t");
 assert.equal(result.graph.edges[0].to.node,"s");
 const branch={nodes:[n("t","manual"),n("b","branch"),n("s","send")],edges:[e("t","next","b","in"),e("b","then","s","in")]};
 assert.equal(removeFlowStep(branch,"b").reconnected,false);
});

test("only semantically compatible data can be linked",()=>{
 assert.equal(portsCompatible("member","text"),false);
 assert.equal(portsCompatible("user","member"),false);
 assert.equal(portsCompatible("member","user"),true);
 assert.equal(portsCompatible("number","text"),true);
});
test("an action cannot borrow another branch's output",()=>{
 const graph={nodes:[n("t","manual"),n("b","branch",{test:"true"}),n("s","send",{channel:"456",text:"a"}),n("r","reply",{text:"b"})],edges:[e("t","next","b","in"),e("b","then","s","in"),e("b","else","r","in")]};
 const invalid=e("s","message","r","message");
 assert.match(connectionProblem(graph,invalid),/every path/);
 assert.ok(workflowIssues({...graph,edges:[...graph.edges,invalid]}).some((i:any)=>i.message.includes("every path")));
});
test("save round trip retains fields and multiline messages",()=>{
 const graph={nodes:[n("t","manual"),n("s","send",{channel:"456",text:"Hello\n\n  staff"})],edges:[e("t","next","s","in")]};
 assert.equal(workflowIssues(graph).length,0);
 assert.equal(graphToAutomation(graph).steps[0].text,"Hello\n\n  staff");
 assert.deepEqual(automationToGraph({graph}),graph);
});
test("ERLC data and actions both need a linked server",()=>{
 for(const type of ["erlc_status","erlc.pm","player_is_mod","erlc.player.joined"]){
  const issues=workflowIssues({nodes:[n("t","manual"),n("a",type),n("s","stop")],edges:[e("t","next","s","in")]},{erlc:false});
  assert.ok(issues.some((i:any)=>i.message.includes("Connect ER:LC")));
 }
});
test("unknown or disconnected blocks cannot become active",()=>{
 const graph={nodes:[n("t","manual"),n("a","send",{channel:"456",text:"hi"}),n("bad","not-a-block")],edges:[]};
 const issues=workflowIssues(graph);
 assert.ok(issues.some((i:any)=>i.message.includes("run-order")));
 assert.ok(issues.some((i:any)=>i.message.includes("not supported")));
});
test("earlier saved simple workflows keep their selected channel and content",()=>{
 const graph=automationToGraph({trigger:"member.joined",steps:[{type:"send",channel_id:456,message:"hello\nthere"}]});
 assert.equal(graph.nodes[1].values.channel,"456");
 assert.equal(graph.nodes[1].values.text,"hello\nthere");
});

test("account age can feed a Number block and a numeric condition",()=>{
 const graph={nodes:[n("t","member.joined"),n("number","number_value"),n("condition","at_least",{b:"7"}),n("guard","guard"),n("s","send",{channel:"456",text:"Welcome"})],edges:[e("t","next","guard","in"),e("guard","next","s","in"),e("t","account_age","number","value"),e("number","value","condition","a"),e("condition","value","guard","test")]};
 assert.equal(connectionProblem(graph,e("t","account_age","number","value")),null);
 assert.deepEqual(workflowIssues(graph),[]);
});

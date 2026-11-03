(function () {
  "use strict";
  const $=id=>document.getElementById(id), clone=x=>JSON.parse(JSON.stringify(x));
  const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=x=>x===null?'?':(Math.abs(x)<.00005?0:x).toFixed(4).replace('-','−');
  const exp=x=>x===0?'0':x.toExponential(2).replace('e-','e−');
  const rho=(p,s=[])=>`ρ<sub>${p.join('')}${s.length?'·'+s.join(','):''}</sub>`;
  const vineSetLabel=(conditioned,conditioning=[])=>conditioned.join('')+(conditioning.length?';'+conditioning.join(''):'');
  const graphRho=(conditioned,conditioning=[])=>`ρ<tspan baseline-shift="sub" font-size="9">${conditioned.join('')}${conditioning.length?'·'+conditioning.join(','):''}</tspan>`;
  const graphNumber=value=>value===0?' = 0':` ≈ ${(Math.abs(value)<0.005?0:value).toFixed(2).replace('-','−')}`;
  const graphEdgeText=(edge,value)=>`${graphRho(edge.conditioned,edge.conditioning)}${Number.isFinite(value)?graphNumber(value):edge.observed_pair?' · later':' = ?'}`;
  function graphNodeLabels(tree,previousTree){
    const preceding=new Map((previousTree?.edges||[]).map(edge=>[[...edge.conditioned,...edge.conditioning].sort((a,b)=>a-b).join(','),edge]));
    return new Map(tree.nodes.map(node=>{
      if(!previousTree)return [node.id,{label:node.variables.join(''),description:'Variable '+node.variables[0]}];
      const edge=preceding.get(node.variables.join(','));
      if(!edge)throw new Error('A vine node has no matching preceding-tree edge.');
      return [node.id,{label:vineSetLabel(edge.conditioned,edge.conditioning),description:'Conditioned set {'+edge.conditioned.join(',')+'}; conditioning set {'+edge.conditioning.join(',')+'}. Edge of the preceding tree.'}];
    }));
  }
  const baseM=[[35,-25,null,10,-15],[-25,52,24,-31,null],[null,24,38,-2,null],[10,-31,-2,30,null],[-15,null,null,null,46]];
  const preset=baseM.map((row,i)=>row.map((v,j)=>v===null?null:v/Math.sqrt(baseM[i][i])/Math.sqrt(baseM[j][j])));
  preset.forEach((row,i)=>row[i]=1);
  const slides=[[1,-.586,null,.309,-.374],[-.586,1,.540,-.785,null],[null,.540,1,-.059,null],[.309,-.785,-.059,1,null],[-.374,null,null,null,1]];
  const state={matrix:clone(slides),base:clone(slides),reference:null,source:'slides',mode:'mask',pair:[0,1],step:0,free:{},freeLevels:{},judgements:{},response:null,revision:0,trace:0,completedTrees:false,referenceShown:false,confirmedThrough:-1,inputPending:'',pairPending:false,pendingPlan:null,planDirty:false,customDraft:null,customSelection:null,customMessage:'',customProblem:null,customBaseStrategy:'greedy'};
  const titles=['Prepare the incomplete matrix','Expand the graph into a vine','Choose the unspecified partials','Reconstruct the matrix','Inspect the result and compare'];
  function sourceLabel(){return {slides:'GIRO example · rounded inputs',preset:'Notebook example · full precision',generated:`Generated matrix · seed ${state.generationSeed}`,manual:'Manually supplied matrix',three:'3-variable example'}[state.source];}
  function renderControlNotes(){
    $('source-note').textContent={slides:'Rounded inputs from GIRO slide 3.',preset:'Full-precision notebook inputs; small rounding differences from GIRO.',generated:'Seeded positive definite matrix. Hide pairs to create an incomplete input.',manual:'Paste a 3–7 variable Pearson correlation matrix.',three:'Three variables: ρ₁₂ = ρ₂₃ = 0.5, with the 1–3 pair missing.'}[$('source').value];
    const manual=$('method').value==='vine';
    const methodNote=manual?'Enter the free values in the table. Initial zeros are modelling judgements.':'Preserves supplied correlations and selects the largest determinant. <a id="method-note-ref" class="note-ref" href="#note-maxdet" data-note="note-maxdet">Meaning and reference [5]</a>';
    if($('method-note').innerHTML!==methodNote)$('method-note').innerHTML=methodNote;
    $('method-guidance').textContent=manual?'Review the values in the table, then start the reconstruction.':'Start reconstruction to calculate the missing entries and derived partial values.';
    $('strategy-note').textContent={greedy:'Greedy heuristic: known values first, then largest |ρ|.','c-vine':'Ordered roots; uses the variable order below.','d-vine':'Ordered path; uses the variable order below.',custom:'Remove and reconnect edges. Finish each tree before continuing.'}[$('strategy').value];
  }
  const stepNames=['Input & graph','Expand vine','Assign partials','Reconstruct','Result & compare'];
  function stepBlock(index){
    if(index<=state.step)return '';
    if(index>0&&state.confirmedThrough<0)return 'Finish Input & graph, then choose “Next: Expand vine” to confirm the input.';
    if(index>1&&state.confirmedThrough<1)return 'Confirm the structure in Expand vine using “Next: Assign partials”.';
    if(index>2&&(!state.response?.result||state.confirmedThrough<2))return 'Finish Assign partials and choose “Start reconstruction” before opening this step.';
    return '';
  }
  function warnStep(message){$('step-warning').textContent=message;$('step-warning').hidden=!message;if(message)$('step-warning').focus();}
  function renderSidebar(){
    document.querySelectorAll('[data-sidebar-step]').forEach(e=>e.hidden=Number(e.dataset.sidebarStep)!==state.step);
    $('sidebar-step').textContent=`Step ${state.step+1} of 5`;$('sidebar-title').textContent=stepNames[state.step];
    $('sidebar-back').hidden=state.step===0;$('sidebar-next').hidden=state.step===2||state.step===4;
    $('sidebar-next').textContent=state.step===3?'Result & compare →':`Next: ${stepNames[state.step+1]||''} →`;
    $('order-group').hidden=!['c-vine','d-vine'].includes($('strategy').value);
    $('strategy').querySelector('option[value="custom"]').disabled=$('strategy').value!=='custom'&&!hasValidPlan();
    const summary=[['Input',`${$('source').selectedOptions[0].textContent} · ${state.matrix.length} variables`]];
    if(state.step>=2)summary.push(['Vine expansion strategy',$('strategy').selectedOptions[0].textContent+(['c-vine','d-vine'].includes($('strategy').value)?` · ${$('order').value}`:'')]);
    if(state.step>=3)summary.push(['Method',$('method').selectedOptions[0].textContent]);
    $('selection-summary').hidden=state.step===0;$('selection-summary').innerHTML=summary.map(([key,value])=>`<dt>${esc(key)}</dt><dd>${esc(value)}</dd>`).join('');
    $('sidebar-reconstruction-note').textContent='Same completed matrix in both views. All workings are shown on this page.';
    $('reveal-truth').hidden=!state.reference||!state.response?.result;
    document.querySelectorAll('.process-steps [data-step]').forEach(e=>{const index=Number(e.dataset.step),block=stepBlock(index);e.classList.toggle('active',index===state.step);e.classList.toggle('locked',!!block);e.setAttribute('aria-current',index===state.step?'step':'false');e.title=block||stepNames[index];});
  }
  function showStep(index){
    const block=stepBlock(index);if(block){warnStep(block);return false;}
    state.step=index;warnStep('');document.querySelectorAll('.stage').forEach((e,i)=>e.hidden=i!==index);
    $('stage-title').textContent=titles[index];if(index===1)renderTrees();if(index===2)renderAssignments();if(index===3)renderTrace();if(index===4)renderResult();renderSidebar();
    if(matchMedia('(max-width:760px)').matches)document.querySelector('.process-steps').scrollIntoView({block:'start',behavior:'instant'});
    return true;
  }
  function orderProblem(){const order=$('order').value.split(',').map(x=>Number(x.trim())),n=state.matrix.length;return order.length!==n||new Set(order).size!==n||order.some(x=>!Number.isInteger(x)||x<1||x>n)?`Variable order must use each label 1–${n} exactly once.`:'';}
  function hasValidPlan(){return !!state.response?.plan&&state.response.inputDiagnostics?.structurallyValid&&state.response.inputDiagnostics.allSpecifiedCliquesPD;}
  async function advance(){
    if(state.inputPending){warnStep(state.inputPending);return;}
    if(state.pairPending){warnStep('Apply the edited correlation using “Set known value”, or mark it missing, before continuing.');return;}
    if(state.step===1&&orderProblem()){warnStep(orderProblem());return;}
    if(state.step===1&&state.customDraft&&!state.customDraft.describe().complete){warnStep(`Finish T${state.customDraft.describe().firstIncomplete+1}: connect all its nodes without a cycle or proximity violation before continuing.`);return;}
    if(state.pendingPlan)await state.pendingPlan;
    if(state.planDirty||!state.response)await plan();
    if(state.planDirty){warnStep('Finish editing the vine choices, then choose Next again.');return;}
    if(state.step<2){
      if(state.step===1&&orderProblem()){warnStep(orderProblem());return;}
      if(!(state.step===0&&state.customDraft&&state.response?.inputDiagnostics?.structurallyValid&&state.response.inputDiagnostics.allSpecifiedCliquesPD)&&!hasValidPlan()){warnStep('Correct the input or vine choices before continuing. See the validation message beside the matrix.');return;}
      state.confirmedThrough=Math.max(state.confirmedThrough,state.step);showStep(state.step+1);
    }else if(state.step===3)showStep(4);
  }
  function error(message){$('lab-error').hidden=!message;$('lab-error').textContent=message||'';}
  function invalidate(from=0,keepPlan=false,redraw=true){
    state.revision++;state.confirmedThrough=Math.min(state.confirmedThrough,from-1);
    if(keepPlan&&state.response){state.response.result=null;state.response.trace=[];}else state.response=null;
    state.trace=0;state.completedTrees=false;state.referenceShown=false;
    $('lab-status').className='status';$('lab-status').textContent='Choices changed · no result';$('reveal-truth').textContent='Reveal hidden reference & compare';warnStep('');
    renderResult();renderTrace();if(redraw){renderEditor();renderObserved();renderTrees();renderAssignments();}renderSidebar();
  }
  function payload(action){const partials=$('method').value==='vine'&&action==='complete'?(state.response?.plan?.freeEdges||[]).map(e=>({conditioned:e.conditioned,conditioning:e.conditioning,value:state.free[e.key]??0})):[];return {matrix:clone(state.matrix),method:$('method').value,strategy:$('strategy').value,order:$('order').value.split(',').map(v=>Number(v.trim())),partials,action,...($('strategy').value==='custom'&&state.customDraft?{custom_trees:state.customDraft.payload()}:{})};}
  async function request(action){return window.matrixSolver.request(payload(action));}
  function plan(){
    renderControlNotes();const ticket=++state.revision;error('');$('lab-status').textContent='Inspecting input…';
    const work=(async()=>{try{const result=await request('plan');if(ticket!==state.revision)return;state.planDirty=false;state.response=result;renderPlan();}catch(e){if(ticket!==state.revision)return;state.response=null;error('The browser solver could not load. Keep this page open during its first download, then retry or reload. '+e.message);$('lab-status').textContent='Browser solver unavailable';$('lab-status').className='status invalid';renderSidebar();}})();
    state.pendingPlan=work;work.finally(()=>{if(state.pendingPlan===work)state.pendingPlan=null;});return work;
  }
  async function complete(){
    if(state.confirmedThrough<1){warnStep('Confirm Input & graph and Expand vine before assigning partial correlations.');return;}
    if(state.pendingPlan)await state.pendingPlan;
    if(!state.response?.plan)await plan();
    if(!hasValidPlan()){warnStep('Correct the input or vine choices before starting reconstruction.');return;}
    if($('method').value==='max_entropy'&&!state.response.inputDiagnostics.observedGraphChordal){warnStep('Maximum determinant supports chordal graphs only. Choose “Set partial correlations” or revise the missing entries in Input & graph.');return;}
    if($('method').value==='vine'&&state.response.plan.freeEdges.some(e=>!Number.isFinite(state.free[e.key]??0)||Math.abs(state.free[e.key]??0)>=1)){warnStep('Enter a finite value strictly between −1 and 1 for every free partial correlation.');return;}
    if($('method').value==='vine')state.response.plan.freeEdges.forEach(edge=>state.judgements[VineEditor.key(edge)]={tree:edge.tree,value:state.free[edge.key]??0});
    const ticket=++state.revision,originStep=state.step;warnStep('');error('');$('lab-status').textContent='Completing and validating…';$('complete').disabled=true;$('complete-from-partials').disabled=true;
    try{const result=await request('complete');if(ticket!==state.revision)return;state.response=result;state.trace=0;state.referenceShown=false;renderPlan();if(result.result){state.confirmedThrough=2;if(state.step===originStep)showStep(3);else renderSidebar();}else{state.confirmedThrough=Math.min(state.confirmedThrough,1);renderSidebar();warnStep('These choices produced no accepted completion. Correct the partial values or method in Assign partials; see the calculation error.');}}
    catch(e){if(ticket===state.revision){state.response=null;error('Browser calculation failed: '+e.message);renderResult();renderSidebar();}}
    finally{$('complete').disabled=false;$('complete-from-partials').disabled=false;}
  }
  function referenceUnchanged(){return !!state.reference&&state.matrix.every((row,i)=>row.every((v,j)=>v===null||Math.abs(v-state.reference[i][j])<1e-12));}
  function renderPlan(){renderControlNotes();const response=state.response,d=response?.inputDiagnostics;renderEditor();$('dataset-label').textContent=sourceLabel();if(!response){return;}$('input-feedback').className='input-feedback'+(!d?.observedGraphChordal||!response.ok?' warn':'');$('input-feedback').innerHTML=d?.structurallyValid?`<strong>${d.dimension} variables · ${d.observedPairs} supplied pair${d.observedPairs===1?'':'s'} · ${d.missingPairs} missing pair${d.missingPairs===1?'':'s'}.</strong> <a id="input-note-ref" class="note-ref" href="#note-feasibility" data-note="note-feasibility">Why this matters [1]</a>${!d.observedGraphChordal?' <span>Maximum determinant does not support this missing-data pattern.</span>':''}${referenceUnchanged()?' <a class="note-ref" id="input-reference-ref" href="#note-reference" data-note="note-reference">Generating reference held out [4]</a>':''}`:'The input has not passed structural validation.';
    $('current-feasibility-detail').textContent=d?.structurallyValid?`Current input: ${d.dimension} variables, ${d.observedPairs} supplied pair${d.observedPairs===1?'':'s'}, ${d.missingPairs} missing pair${d.missingPairs===1?'':'s'}. Observed graph: ${d.observedGraphChordal?'chordal':'nonchordal'}. ${d.globalFeasibility.explanation}`:'Apply a valid input to see its feasibility checks.';
    const unfinished=!!state.customDraft&&!state.customDraft.describe().complete;if(response.error&&!unfinished)error(response.error.type+': '+response.error.message);const result=response.result;
    $('lab-status').className=unfinished?'status draft':'status'+(!response.ok?' invalid':result&&!result.diagnostics.max_entropy_certified?' assumed':'');
    $('lab-status').textContent=unfinished?'Vine unfinished · no result':!response.ok?'No accepted completion':result?(result.diagnostics.max_entropy_certified?'Valid · max determinant certified':'Valid · applied judgements'):'Plan ready · not yet completed';
    $('export-general').disabled=!result;renderObserved();renderTrees();renderAssignments();renderResult();if(state.step===3)renderTrace();renderSidebar();}
  function matrixTable(matrix,{observed=null,editable=false,labels=null,highlight=null,caption='Ordinary Pearson correlation',valueClass=''}={}){const n=matrix.length,format=n>=6?(v=>v===null?'?':(Math.abs(v)<.0005?0:v).toFixed(3).replace('-','−')):fmt,lab=labels||Array.from({length:n},(_,i)=>i+1);return `<table class="matrix ${editable?'editable':''} ${n>=6?'compact':''}"><caption>${esc(caption)}</caption><thead><tr><th scope="col">Risk</th>${lab.map(x=>`<th scope="col">R${x}</th>`).join('')}</tr></thead><tbody>`+matrix.map((row,i)=>`<tr><th scope="row">R${lab[i]}</th>`+row.map((v,j)=>{const selected=editable&&state.pair&&((i===state.pair[0]&&j===state.pair[1])||(j===state.pair[0]&&i===state.pair[1]));const source=v===null?'missing':i===j?'diagonal':observed&&!observed[i][j]?'inferred':'supplied';const hi=highlight&&((lab[i]===highlight[0]&&lab[j]===highlight[1])||(lab[j]===highlight[0]&&lab[i]===highlight[1]));return `<td class="${source}${valueClass?' '+valueClass:''}${selected?' selected-pair':''}${hi?' highlight':''}">${editable&&i!==j?`<button data-pair="${Math.min(i,j)},${Math.max(i,j)}" title="Risk ${lab[i]}–${lab[j]}: ${source}, ${v===null?'unknown':v}" aria-label="Risk ${lab[i]} and ${lab[j]}, ${source}, ${v===null?'unknown':v}">${format(v)}</button>`:`<span title="${source}: ${v}">${format(v)}${source==='inferred'?'<sup>*</sup>':''}</span>`}</td>`;}).join('')+'</tr>').join('')+'</tbody></table>';}
  function renderEditor(){const n=state.matrix.length;let pairs=0;state.matrix.forEach((row,i)=>row.forEach((v,j)=>{if(i<j&&v===null)pairs++;}));$('pair-count').textContent=`${pairs} missing / ${n*(n-1)/2} pairs`;$('mask-count').max=n*(n-1)/2-pairs;$('editable-matrix').innerHTML=matrixTable(state.matrix,{editable:true});$('editable-matrix').querySelectorAll('[data-pair]').forEach(button=>button.addEventListener('click',()=>{const [i,j]=button.dataset.pair.split(',').map(Number);state.pair=[i,j];if(state.mode==='mask'){const old=state.matrix[i][j];if(old!==null){state.stash??={};state.stash[`${i},${j}`]=old;state.matrix[i][j]=state.matrix[j][i]=null;}else{const restored=state.stash?.[`${i},${j}`]??state.base[i][j];if(restored===null){state.mode='edit';renderMode();renderEditor();return;}state.matrix[i][j]=state.matrix[j][i]=restored;}invalidate();plan();}else renderEditor();}));$('pair-editor').hidden=state.mode!=='edit';const [i,j]=state.pair||[0,1];$('pair-label').innerHTML=`Edit ${rho([i+1,j+1])} (both symmetric entries)`;$('pair-value').value=state.matrix[i]?.[j]??'';}
  function renderMode(){$('mask-mode').classList.toggle('selected',state.mode==='mask');$('edit-mode').classList.toggle('selected',state.mode==='edit');$('mask-mode').setAttribute('aria-pressed',String(state.mode==='mask'));$('edit-mode').setAttribute('aria-pressed',String(state.mode==='edit'));}
  function graphSvg(nodes,edges){
    const n=nodes.length,points=nodes.map((_,i)=>{const angle=2*Math.PI*i/n-Math.PI/2;return [160+112*Math.cos(angle),145+112*Math.sin(angle)];});
    let svg='<svg viewBox="0 0 320 290" role="img" aria-label="Observed risk graph">';
    edges.forEach(edge=>{const [i,j]=edge.pair.map(x=>x-1),[x1,y1]=points[i],[x2,y2]=points[j];svg+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="input-edge" stroke-width="${1+Math.abs(edge.value)*2}"/><text x="${(x1+x2)/2}" y="${(y1+y2)/2-4}" text-anchor="middle" class="input-edge-label" font-size="12" paint-order="stroke" stroke="#fff" stroke-width="4">${graphRho(edge.pair)}${graphNumber(edge.value)}</text>`;});
    points.forEach(([x,y],i)=>svg+=`<circle cx="${x}" cy="${y}" r="18" class="network-node"/><text x="${x}" y="${y}" class="network-text">R${nodes[i]}</text>`);return svg+'</svg>';
  }
  function renderObserved(){const graph=state.response?.graph;if(!graph){$('observed-graph').textContent='Input validation is required before a graph is shown.';return;}$('observed-graph').innerHTML=graphSvg(graph.nodes,graph.edges);}
  async function startCustomVine(){
    const revision=state.revision;if(state.pendingPlan)await state.pendingPlan;if(revision!==state.revision)return;
    const plan=state.response?.plan;
    if(!plan){$('strategy').value=state.customBaseStrategy;warnStep('Finish validating the automatic vine before editing its connections.');return;}
    if(!state.customDraft){state.customBaseStrategy=plan.strategy==='custom'?'greedy':plan.strategy;state.customDraft=new VineEditor.DraftVine(plan);}
    $('strategy').value='custom';state.customSelection=null;customChanged('Click an edge to remove it, then select two nodes to reconnect.',null);renderControlNotes();
  }
  function customChanged(message,changedLevel=0){
    if(changedLevel!==null){Object.keys(state.free).forEach(key=>{const level=state.freeLevels[key];if(!level||level>=changedLevel+1)delete state.free[key];});Object.keys(state.judgements).forEach(key=>{if(state.judgements[key].tree>=changedLevel+1)delete state.judgements[key];});}
    state.customSelection=null;state.customProblem=null;state.customMessage=message;state.planDirty=true;
    invalidate(1,true,false);error('');$('lab-status').textContent=state.customDraft.describe().complete?'Vine ready for validation':'Vine unfinished · no result';
    $('lab-status').className='status draft';renderTrees();renderSidebar();focusCustomNode(state.customDraft.describe().firstIncomplete);
  }
  function focusCustomNode(level,id){
    const nodes=[...$('vine-trees').querySelectorAll('[data-vine-action="node"]')];
    const target=nodes.find(node=>Number(node.dataset.level)===Math.max(0,level)&&(!id||node.dataset.node===id));
    target?.focus({preventScroll:true});
  }
  function suppliedPartial(edge,cache){
    const labels=[...edge.conditioned,...edge.conditioning];
    if(!labels.every(a=>labels.every(b=>Number.isFinite(state.matrix[a-1][b-1]))))return null;
    // Display only: the standard residual-correlation recursion on a supplied block.
    function partial(a,b,conditioning){
      const key=VineEditor.key({conditioned:[a,b],conditioning});
      if(cache.has(key))return cache.get(key);
      let value=state.matrix[a-1][b-1];
      if(conditioning.length){
        const last=conditioning[conditioning.length-1],rest=conditioning.slice(0,-1);
        const ab=partial(a,b,rest),ac=partial(a,last,rest),bc=partial(b,last,rest);
        value=(ab-ac*bc)/Math.sqrt((1-ac*ac)*(1-bc*bc));
      }
      cache.set(key,value);return value;
    }
    const value=partial(...edge.conditioned,edge.conditioning);
    return Number.isFinite(value)?value:null;
  }
  function customEdgePresentation(edge,actual,cache){
    const known=suppliedPartial(edge,cache),key=VineEditor.key(edge),judgement=state.judgements[key];
    if(known!==null)return {value:known,valueClass:'value-known',description:'Known from supplied correlations.'};
    if(actual.has(key))return {value:actual.get(key),valueClass:'value-judgement',description:judgement?'Applied partial-correlation judgement.':'Estimated under the selected completion method.'};
    if(judgement)return {value:judgement.value,valueClass:'value-judgement',description:'Applied partial-correlation judgement.'};
    return {value:null,valueClass:'value-unknown',description:'Unknown correlation value.'};
  }
  function renderCustomEditor(){
    const draft=state.customDraft,description=draft.describe(),cache=new Map();
    const actual=new Map((state.response?.result?.edges||[]).map(edge=>[VineEditor.key(edge),edge.partial_correlation]));
    $('vine-policy').textContent='Edit the connections in each tree. Changing an earlier tree clears the following trees and affected partial judgements. Supplied matrix entries stay fixed.';
    let html=`<div class="custom-editor-tools"><div><button data-vine-action="undo" class="plain-button" ${draft.history.length?'':'disabled'}>Undo</button><button data-vine-action="reset" class="plain-button">Reset connections</button></div><p>Click an edge to remove it. Select a node to see allowed targets, then select a second node to connect them. Edge values use ρ notation; colours show value status. Free partials are assigned in Step 3.</p><p id="custom-editor-notice" role="status" aria-live="polite">${esc(state.customMessage||'Build each tree in order. Every tree must be complete before Next.')}</p></div>`;
    description.levels.forEach((tree,index)=>{
      html+=`<div class="tree-card custom-tree"><h4>Tree T${tree.level}</h4><p class="custom-tree-status">${esc(tree.message)}</p>`;
      if(tree.blocked){html+='</div>';return;}
      const selected=state.customSelection?.level===index?state.customSelection.id:null;
      const allowed=selected?draft.allowedTargets(index,selected):[];
      const positions=new Map(tree.nodes.map((node,i)=>{const angle=2*Math.PI*i/tree.nodes.length-Math.PI/2;return [node.id,[190+130*Math.cos(angle),110+76*Math.sin(angle)]];}));
      let svg=`<svg viewBox="0 0 380 220" aria-label="Editable vine tree ${tree.level}">`;
      if(selected)allowed.forEach(node=>{const [x1,y1]=positions.get(selected),[x2,y2]=positions.get(node.id);svg+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="draft-candidate"/>`;});
      tree.edges.forEach(edge=>{const [x1,y1]=positions.get(edge.u),[x2,y2]=positions.get(edge.v),presentation=customEdgePresentation(edge,actual,cache),vertical=Math.abs(x1-x2)<1;const observed_pair=Number.isFinite(state.matrix[edge.conditioned[0]-1][edge.conditioned[1]-1]);svg+=`<g role="button" tabindex="0" aria-label="Remove ${esc(VineEditor.label(edge))} in T${tree.level}" data-vine-action="remove" data-level="${index}" data-edge="${esc(edge.key)}"><title>${esc(presentation.description)}</title><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="draft-edge-hit"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="draft-edge ${presentation.valueClass}"/><text x="${(x1+x2)/2+(vertical?28:0)}" y="${(y1+y2)/2+(vertical?9:-9)}" class="tree-label draft-edge-label ${presentation.valueClass}" style="text-anchor:${vertical?'start':'middle'}" paint-order="stroke" stroke="#fbfcf7" stroke-width="4">${graphEdgeText({...edge,observed_pair},presentation.value)}</text></g>`;});
      tree.nodes.forEach(node=>{const [x,y]=positions.get(node.id),isSelected=selected===node.id,isAllowed=allowed.some(target=>target.id===node.id);svg+=`<g role="button" tabindex="0" aria-label="Node ${node.label} in T${tree.level}" aria-pressed="${isSelected}" data-vine-action="node" data-level="${index}" data-node="${esc(node.id)}" class="draft-node${isSelected?' selected':''}${isAllowed?' allowed':''}"><circle cx="${x}" cy="${y}" r="23"/><text x="${x}" y="${y+3}" class="tree-label" style="font-size:${node.label.length>5?9:11}px">${node.label}</text></g>`;});
      html+=svg+`</svg><p>${tree.level===1?'Edge values are ordinary correlations.':'Edge values are partial correlations.'}</p>`;
      if(selected){const selectedNode=tree.nodes.find(node=>node.id===selected);html+=`<div class="allowed-connections">${state.customProblem?.level===index?`<p class="custom-connection-warning" role="alert">${esc(state.customProblem.message)}</p>`:''}<p>Allowed from ${selectedNode.label}:</p>${allowed.length?allowed.map(node=>`<button data-vine-action="connect" data-level="${index}" data-node="${esc(node.id)}">Connect to ${node.label}</button>`).join(''):`<p>${tree.complete?'Remove a connection first.':'Choose another node to find a valid target.'}</p>`}</div>`;}
      html+='</div>';
    });
    $('vine-trees').innerHTML=html;
  }
  function customEditorAction(target){
    if(!state.customDraft)return;
    const action=target.dataset.vineAction,level=Number(target.dataset.level),draft=state.customDraft;
    const firstChanged=before=>{const after=draft.payload();const index=before.findIndex((edges,i)=>edges.map(VineEditor.key).sort().join(' / ')!==after[i].map(VineEditor.key).sort().join(' / '));return index<0?null:index;};
    if(action==='undo'){const before=draft.payload();if(draft.undo())customChanged('Previous connections restored. Review affected partial judgements again in Step 3.',firstChanged(before));return;}
    if(action==='reset'){const before=draft.payload();draft.reset();customChanged('Starting connections restored.',firstChanged(before));return;}
    if(action==='remove'){if(draft.remove(level,target.dataset.edge))customChanged(`Connection removed from T${level+1}. Reconnect this tree, then rebuild the following trees.`,level);return;}
    const id=target.dataset.node,selection=state.customSelection;
    if(action==='node'&&(!selection||selection.level!==level)){state.customSelection={level,id};state.customProblem=null;state.customMessage='Allowed targets have dashed outlines and are listed below the tree.';renderTrees();focusCustomNode(level,id);return;}
    if(action==='node'&&selection?.id===id){state.customSelection=null;state.customProblem=null;state.customMessage='';renderTrees();focusCustomNode(level,id);return;}
    if(!selection||selection.level!==level)return;
    const answer=draft.connect(level,selection.id,id);
    if(answer.allowed)customChanged(`Connection added to T${level+1}. Complete the following trees before continuing.`,level);
    else{state.customProblem={level,message:answer.reason};state.customMessage='Choose one of the allowed targets below the selected tree.';renderTrees();focusCustomNode(level,selection.id);}
  }
  function treePositions(tree){
    const neighbours=new Map(tree.nodes.map(n=>[n.id,[]]));
    tree.edges.forEach(e=>{neighbours.get(e.u).push(e.v);neighbours.get(e.v).push(e.u);});
    const root=tree.nodes.slice().sort((a,b)=>neighbours.get(b.id).length-neighbours.get(a.id).length)[0].id;
    const depths=new Map(),children=new Map(),leafOrder=[];
    function walk(id,parent,depth){depths.set(id,depth);const list=neighbours.get(id).filter(x=>x!==parent);children.set(id,list);if(!list.length)leafOrder.push(id);list.forEach(x=>walk(x,id,depth+1));}
    walk(root,null,0);const maximum=Math.max(...depths.values(),1),positions=new Map();
    function place(id){const list=children.get(id);const x=list.length?list.map(place).reduce((a,b)=>a+b,0)/list.length:leafOrder.length===1?190:40+leafOrder.indexOf(id)*300/(leafOrder.length-1);positions.set(id,[x,25+depths.get(id)*120/maximum]);return x;}
    place(root);return positions;
  }
  function renderTrees(){
    const custom=$('strategy').value==='custom'&&state.customDraft;$('vine-colour-key').hidden=false;$('vine-later-note').hidden=!!custom;
    if(custom){renderCustomEditor();return;}
    const plan=state.response?.plan;
    if(!plan){$('vine-trees').innerHTML='<p class="stage-intro">A valid plan is needed before the vine can be expanded.</p>';return;}
    $('vine-policy').textContent=$('method').value==='max_entropy'?'The vine is a representation of dependence. The chordal maximum-determinant calculation is independent of this representation; changing the vine alone does not change that optimum.':'The selected vine determines where free partial-correlation judgements are placed. Changing the structure or order can change the completion or make the chosen judgements incompatible.';
    const actual=new Map((state.response.result?.edges||[]).map(e=>[e.key,e.partial_correlation]));
    let html=`<div class="tree-tools" style="grid-column:1/-1"><div class="segmented"><button id="trees-before" class="${state.completedTrees?'':'selected'}">Before assignment</button><button id="trees-after" class="${state.completedTrees?'selected':''}" ${!state.response.result?'disabled':''}>Completed vine</button></div><button id="edit-vine" class="plain-button">Edit connections</button></div>`;
    plan.trees.forEach((tree,treeIndex)=>{
      const coords=treePositions(tree),nodeLabels=graphNodeLabels(tree,plan.trees[treeIndex-1]);
      let svg='<svg viewBox="0 0 380 170" role="img" aria-label="Vine tree '+tree.level+'">';
      tree.edges.forEach(edge=>{
        const [x1,y1]=coords.get(edge.u),[x2,y2]=coords.get(edge.v);
        const value=state.completedTrees?actual.get(edge.key):edge.partial_from_observations;
        const unknown=value===null||value===undefined;
        const valueClass=unknown?'value-unknown':edge.partial_from_observations!==null&&edge.partial_from_observations!==undefined?'value-known':'value-judgement';
        const provenance=unknown?(!edge.observed_pair?'Unknown: choose a judgement or completion method.':'Unknown partial: calculated later during reconstruction.'):valueClass==='value-known'?'Known from supplied correlations.':$('method').value==='vine'&&!edge.observed_pair?'Applied partial-correlation judgement.':'Calculated under the selected completion method; not a known input.';
        const text=graphEdgeText(edge,value);
        const vertical=Math.abs(x1-x2)<1;
        svg+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="tree-edge ${valueClass}"><title>${esc(provenance)}</title></line><text x="${(x1+x2)/2+(vertical?28:0)}" y="${(y1+y2)/2+(vertical?9:-9)}" text-anchor="${vertical?'start':'middle'}" class="tree-label tree-edge-label ${valueClass}" paint-order="stroke" stroke="#fbfcf7" stroke-width="5" style="text-anchor:${vertical?'start':'middle'}"><title>${esc(provenance)}</title>${text}</text>`;
      });
      tree.nodes.forEach(node=>{const [x,y]=coords.get(node.id),label=nodeLabels.get(node.id);svg+=`<circle cx="${x}" cy="${y}" r="21" class="tree-node"><title>${esc(label.description)}</title></circle><text x="${x}" y="${y+3}" class="tree-label tree-node-label" style="font-size:${label.label.length>5?8:10}px">${label.label}</text>`;});
      html+=`<div class="tree-card"><h4>Tree T${tree.level}</h4>${svg}</svg><p>${tree.level===1?'Edge values are ordinary correlations.':'Edge values are partial correlations.'}</p></div>`;
    });
    $('vine-trees').innerHTML=html;
    $('trees-before').onclick=()=>{state.completedTrees=false;renderTrees();};$('trees-after').onclick=()=>{state.completedTrees=true;renderTrees();};$('edit-vine').onclick=()=>startCustomVine();
  }
  function renderAssignments(){const plan=state.response?.plan;if(!plan){$('assignments').innerHTML='<p>A valid vine plan is needed.</p>';return;}const vine=$('method').value==='vine';$('assignment-explanation').innerHTML=vine?'<p><span class="value-judgement">Judgement 2: assign free partial correlations.</span> Enter each value in (−1,1). Initial zeros are modelling choices; they need not be valid or optimal. The completed matrix is checked against the supplied correlations before acceptance.</p>':'<p><span class="value-judgement">Judgement 2: maximise determinant.</span> Keep every supplied correlation fixed and derive the free partial values from the optimum.</p><p>This gives a defined, repeatable baseline when further partial values are not imposed. It does not promise the closest result to an unknown true matrix.</p><p>With a Gaussian model and fixed variances, this also maximises differential entropy. <a id="maxdet-explanation-ref" class="note-ref" href="#note-maxdet" data-note="note-maxdet">Explanation and references [5]</a></p>';const actual=new Map((state.response.result?.edges||[]).map(e=>[e.key,e.partial_correlation]));$('assignments').innerHTML='<table class="assignment-table"><thead><tr><th>Tree</th><th>Free edge</th><th>Value</th><th>Meaning</th></tr></thead><tbody>'+plan.freeEdges.map(edge=>{state.freeLevels[edge.key]=edge.tree;state.free[edge.key]??=0;return `<tr><td>T${edge.tree}</td><td>${rho(edge.conditioned,edge.conditioning)}</td><td class="${vine||actual.has(edge.key)?'value-judgement':'value-unknown'}">${vine?`<input data-partial="${esc(edge.key)}" aria-label="Partial ${esc(edge.key)}" type="number" min="-0.999999" max="0.999999" step="0.05" value="${state.free[edge.key]}">`:(actual.has(edge.key)?actual.get(edge.key).toFixed(6):'Computed on completion')}</td><td>${vine?'<span class="free-tag">Applied judgement</span>':'Derived, not preassigned'}${edge.conditioning.length?'':'<small>Ordinary correlation</small>'}</td></tr>`;}).join('')+'</tbody></table>';$('assignment-summary').textContent=`${plan.freeEdges.length} free edge${plan.freeEdges.length===1?'':'s'} on this vine.`;$('assignments').querySelectorAll('[data-partial]').forEach(input=>input.addEventListener('input',()=>{const value=input.valueAsNumber;state.free[input.dataset.partial]=value;const edge=plan.freeEdges.find(item=>item.key===input.dataset.partial),key=VineEditor.key(edge);if(Number.isFinite(value)&&Math.abs(value)<1)state.judgements[key]={tree:edge.tree,value};else delete state.judgements[key];invalidate(2,true,false);if(!Number.isFinite(value)||Math.abs(value)>=1){$('lab-status').textContent='Invalid partial · no result';$('lab-status').className='status invalid';renderResult();error('Free partial correlations must be finite and strictly between −1 and 1.');return;}$('lab-status').textContent='Assumptions changed · no result';$('export-general').disabled=true;error('');renderResult();}));}
  const equationNumber=value=>(Math.abs(value)<0.0000005?0:value).toFixed(6).replace('-','−');
  const equationValue=(value,known=true)=>`<span class="${known?'value-known':'value-judgement'}">${equationNumber(value)}</span>`;
  const ordinary=(a,b)=>rho([Math.min(a,b),Math.max(a,b)]);
  function systemLine(row,right,rightKnown,names){
    const terms=[];
    row.forEach((value,index)=>{
      if(value===0)return;
      const sign=value<0?'−':'+',magnitude=Math.abs(value);
      terms.push(`${terms.length?' '+sign+' ':value<0?'− ':''}${magnitude===1?'':equationValue(magnitude)+' '}${names[index]}`);
    });
    return terms.join('')+' = '+equationValue(right,rightKnown);
  }
  function chordalEquationCard(step,index){
    const [x,y]=step.pair,s=step.separator,names=['a','b','c','d','e'].slice(0,s.length);
    let html=`<article class="trace-card"><p class="calculation-label">Calculation ${index+1}</p><h4>Calculate ${rho(step.pair)}</h4>`;
    if(!s.length)return html+`<p>No supplied path joins these variables. Maximum determinant selects zero correlation between the disconnected groups.</p><div class="equation-lines">${rho(step.pair)} = ${equationValue(0,false)}</div></article>`;
    if(s.length===1){
      html+=`<p>Connect ${x} and ${y} through their shared variable ${s[0]}.</p><div class="equation-lines"><div>${rho(step.pair)} = ${ordinary(x,s[0])} × ${ordinary(s[0],y)}</div><div>= (${equationValue(step.weights[0],step.rightKnown[0])}) × (${equationValue(step.terms[0],step.termsKnown[0])}) ≈ ${equationValue(step.value,false)}</div></div>`;
    }else{
      html+=`<p>Find the linear prediction weights for variable ${x}: ${s.map((v,i)=>`${names[i]} for variable ${v}`).join('; ')}. Match its available correlations:</p><div class="equation-lines">${step.system.map((row,i)=>'<div>'+systemLine(row,step.right[i],step.rightKnown[i],names)+'</div>').join('')}</div>`;
      const weightsKnown=step.rightKnown.every(Boolean);
      html+=`<p class="equation-weights">${step.weights.map((value,i)=>`${names[i]} ≈ ${equationValue(value,weightsKnown)}`).join('; ')}</p><p>Insert these coefficients into the missing-pair equation:</p><div class="equation-lines"><div>${rho(step.pair)} = ${s.map((v,i)=>`${names[i]} × ${ordinary(v,y)}`).join(' + ')}</div><div>= ${step.weights.map((value,i)=>`(${equationValue(value,weightsKnown)}) × (${equationValue(step.terms[i],step.termsKnown[i])})`).join(' + ')} ≈ ${equationValue(step.value,false)}</div></div>`;
    }
    return html+'</article>';
  }
  function vineEquationCard(step,index){
    const s=step.conditioning,[x,y]=step.pair;
    const baseKnown=s.every(a=>state.matrix[a-1][x-1]!==null&&state.matrix[a-1][y-1]!==null&&s.every(b=>state.matrix[a-1][b-1]!==null));
    let html=`<article class="trace-card"><p class="calculation-label">Calculation ${index+1}</p><h4>Calculate ${rho(step.pair)}</h4>`;
    if(!s.length)return html+`<p>There are no conditioning variables on this edge. The chosen judgement directly supplies the ordinary correlation.</p><div class="equation-lines">${rho(step.pair)} = ${equationValue(step.partialValue,false)}</div></article>`;
    html+=`<p>Apply the chosen partial correlation ${rho(step.pair,s)} after accounting for ${s.length===1?'variable':'variables'} ${s.join(', ')}.</p>`;
    if(s.length===1)html+=`<div class="equation-lines">${rho(step.pair)} = ${ordinary(x,s[0])} × ${ordinary(y,s[0])} + <span class="value-judgement">${rho(step.pair,s)}</span> × √[(1 − ${ordinary(x,s[0])}<sup>2</sup>)(1 − ${ordinary(y,s[0])}<sup>2</sup>)]</div>`;
    else html+='<p>Earlier correlations give the base and remaining scale. Add the partial judgement multiplied by that scale.</p>';
    html+=`<div class="equation-lines">${rho(step.pair)} = ${equationValue(step.base,baseKnown)} + (${equationValue(step.partialValue,false)}) × ${equationValue(step.multiplier,baseKnown)} ≈ ${equationValue(step.value,false)}</div>`;
    return html+'</article>';
  }
  function renderSimpleTrace(){
    $('trace-prev').disabled=$('trace-next').disabled=true;
    const response=state.response;
    if(!response?.result){$('trace-position').textContent='No accepted reconstruction yet';$('trace-content').innerHTML='<p class="stage-intro">Finish Assign partials to display the equations here.</p>';return;}
    const vine=$('method').value==='vine';
    $('reconstruction-note').textContent=vine?'Keep the supplied correlations fixed. Apply each chosen partial judgement to calculate a missing ordinary correlation.':'Variables here are standardised to variance one. Maximum determinant links complete blocks through their shared variables, with zero remaining partial correlation across each block separator. Apply this rule to calculate the missing pairs; supplied values stay fixed.';
    try{
      const answer=vine?VineCalculations.verifiedVineSteps(state.matrix,response.trace,response.result.correlation):VineCalculations.deriveChordalSteps(state.matrix,response.trace,response.result.correlation);
      const count=answer.steps.length;
      $('trace-position').textContent=`${count} missing correlation${count===1?'':'s'} calculated`;
      $('trace-content').innerHTML='<div class="simple-trace">'+(count?answer.steps.map(vine?vineEquationCard:chordalEquationCard).join(''):'<p class="stage-intro">There are no missing pairs. The supplied matrix is already complete.</p>')+'<p class="equation-check">All values agree with the accepted completion. Displayed numbers are rounded.</p></div>';
    }catch(e){
      $('trace-position').textContent='Simple equations could not be verified';
      $('trace-content').innerHTML=`<p class="lab-error">${esc(e.message)} Choose Matrix derivation to inspect the accepted calculation. The accepted result is unchanged.</p>`;
    }
  }
  function renderTrace(){if($('reconstruction-view').value==='simple')renderSimpleTrace();else renderMatrixTrace();}
  function renderMatrixTrace(){
    const entries=(state.response?.trace||[]).filter(e=>['vine_edge','clique_forest','clique_contribution','separator_contribution','precision_inverse'].includes(e.stage));
    $('trace-prev').disabled=$('trace-next').disabled=true;
    if(!entries.length){$('trace-position').textContent='No accepted reconstruction yet';$('trace-content').innerHTML='<p class="stage-intro">Finish Assign partials to calculate and display all reconstruction steps here.</p>';return;}
    $('trace-position').textContent=`${entries.length} calculations shown together`;
    $('reconstruction-note').textContent=$('method').value==='vine'?'Reconstruct in tree order. Supplied ordinary correlations stay fixed. Each missing correlation uses its chosen partial judgement and previously available entries.':'All clique and separator contributions, followed by the inversion, are shown below. This is the actual chordal maximum-determinant calculation.';
    $('trace-content').innerHTML=entries.map((e,index)=>{
let html=`<article class="trace-card" id="calculation-${index+1}"><p class="calculation-label">Calculation ${index+1}</p>`;if(e.stage==='vine_edge'){html+=`<h4>T${e.level}: ${rho(e.pair,e.conditioning)}</h4><p>${e.source==='observed'?'The ordinary correlation is observed and remains fixed. Its partial correlation is calculated.':'A missing ordinary correlation is reconstructed using the applied partial judgement.'}</p>${e.failed?`<div class="lab-error">${esc(e.message)}</div>`:`<div class="trace-formula">R<sub>${e.pair.join('')}</sub> = ${e.base.toFixed(6)} + <span class="${Number.isFinite(state.response.plan.edges.find(edge=>edge.key===e.key)?.partial_from_observations)?'value-known':'value-judgement'}">${e.partialValue.toFixed(6)}</span> × ${e.multiplier.toFixed(6)} = <span class="${e.source==='observed'?'value-known':'value-judgement'}">${e.ordinaryCorrelation.toFixed(6)}</span></div>`}<details class="calculation-matrices" open><summary>Matrix details</summary><div class="trace-matrices"><div><h5>Before this edge</h5>${matrixTable(e.before,{observed:state.matrix.map(row=>row.map(v=>v!==null))})}</div><div><h5>After this edge</h5>${matrixTable(e.after,{observed:state.matrix.map(row=>row.map(v=>v!==null)),highlight:e.pair})}</div></div></details>`;}else if(e.stage==='clique_forest'){html+=`<h4>Identify cliques and their separators</h4><p>${esc(e.message)}</p><div class="trace-formula">K = Σ embed(R<sub>CC</sub><sup>−1</sup>) − Σ embed(R<sub>SS</sub><sup>−1</sup>)</div><p>Cliques: ${e.cliques.map(x=>'{'+x.join(',')+'}').join(' · ')}<br>Separators: ${e.separators.map(x=>'{'+x.join(',')+'}').join(' · ')||'none'}</p>`;}else if(e.stage==='precision_inverse'){html+=`<h4>Invert K to recover R</h4><p>${esc(e.message)}</p><details class="calculation-matrices" open><summary>Matrix details</summary><div class="trace-matrices"><div><h5>Assembled precision K</h5>${matrixTable(e.precision,{caption:'Precision matrix (inverse correlation)'})}</div><div><h5>Completed ordinary correlation R</h5>${matrixTable(e.after,{observed:state.matrix.map(row=>row.map(v=>v!==null))})}</div></div></details>`;}else{html+=`<h4>${e.sign===1?'Add clique':'Subtract separator'} {${e.labels.join(',')}}</h4><p>Invert this fully specified block and embed its contribution into K. An intermediate precision sum is not yet a completed correlation matrix.</p><details class="calculation-matrices" open><summary>Matrix details</summary><div class="trace-matrices"><div><h5>Specified correlation block</h5>${matrixTable(e.block,{labels:e.labels})}</div><div><h5>Precision sum after this contribution</h5>${matrixTable(e.precisionAfter,{caption:'Intermediate precision sum'})}</div></div></details>`;}return html+'</article>';
    }).join('');
  }
  function renderResult(){const result=state.response?.result;const div=$('general-result');$('ground-truth').hidden=!state.reference||!result;$('reveal-truth').hidden=!state.reference||!result;$('truth-content').hidden=!state.referenceShown;$('export-general').disabled=!result;if(!result){div.innerHTML='<p class="stage-intro">There is no accepted result for the current input and assumptions. Run completion to see a fresh matrix and validation. A previous certificate is never reused.</p>';return;}const d=result.diagnostics,observed=state.matrix.map(row=>row.map(v=>v!==null));div.innerHTML=matrixTable(result.correlation,{observed})+`<div class="data-key" id="result-colour-key"><span class="key-known">Known inputs</span><span class="key-judgement">Estimated *</span></div><div class="diagnostics"><div class="metric"><span>Minimum eigenvalue of R</span><strong>${d.minimum_eigenvalue_correlation.toFixed(6)}</strong><small>Must exceed 1e−10</small></div><div class="metric"><span>Supplied-entry error</span><strong>${exp(d.maximum_observed_error_correlation)}</strong><small>Supplied values preserved</small></div><div class="metric"><span>log det(R)</span><strong>${d.log_determinant_correlation.toFixed(6)}</strong><small>Compare under identical constraints</small></div><div class="metric"><span>Free precision residual</span><strong>${exp(d.free_precision_max_abs)}</strong><small>${d.max_entropy_certified?'≤1e−8 · max determinant certified':'No maxdet certificate for original constraints'}</small></div></div><p class="general-result-note">${d.missing_pairs_completed} missing pairs reconstructed. Positive definite (hence positive semidefinite); supplied values preserved. ${d.max_entropy_certified?'Maximum determinant is certified for the supplied-entry constraints.':'Your partial-correlation judgements define this completion.'} Validity does not justify the modelling assumptions. <a id="result-scope-ref" class="note-ref" href="#note-scope" data-note="note-scope">Interpretation [3]</a></p><p class="general-result-note">Vines expose modelling choices. <a id="result-story-ref" class="note-ref" href="#note-story" data-note="note-story">The full story [6]</a></p>`;if(state.referenceShown)renderTruth();}
  function renderTruth(){const result=state.response?.result;if(!result||!state.reference)return;const pairs=[];for(let i=0;i<state.matrix.length;i++)for(let j=i+1;j<state.matrix.length;j++)if(state.matrix[i][j]===null)pairs.push([i,j]);const errors=pairs.map(([i,j])=>result.correlation[i][j]-state.reference[i][j]);const rmse=errors.length?Math.sqrt(errors.reduce((sum,x)=>sum+x*x,0)/errors.length):0,max=errors.length?Math.max(...errors.map(Math.abs)):0;$('truth-content').hidden=false;$('truth-content').innerHTML=`<div class="comparison-metrics">Held-out pairs: ${pairs.length} · RMSE: <strong>${rmse.toFixed(6)}</strong> · Maximum absolute difference: <strong>${max.toFixed(6)}</strong></div><p class="recovery-note">${referenceUnchanged()?'The generating matrix is a valid reference completion, but the selected objective need not recover it.':'Known entries have been edited. This is the original generating reference before those edits, so it is no longer necessarily compatible with the current constraints.'} Hidden values were never included in a solver request. <a id="reference-note-ref" class="note-ref" href="#note-reference" data-note="note-reference">Comparison note [4]</a></p><div class="truth-grid"><div><h5>Held-out generating reference</h5>${matrixTable(state.reference)}</div><div><h5>Current completion minus reference</h5>${matrixTable(result.correlation.map((row,i)=>row.map((v,j)=>v-state.reference[i][j])),{caption:'Differences in ordinary correlation',valueClass:'value-judgement'})}</div></div>`;}
  function load(matrix,source,reference=null){if(!Array.isArray(matrix)||matrix.length<3||matrix.length>7||matrix.some(row=>!Array.isArray(row)||row.length!==matrix.length))throw new Error('Use a square 3–7 variable matrix.');matrix.forEach((row,i)=>row.forEach((v,j)=>{if(v!==null&&(typeof v!=='number'||!Number.isFinite(v)))throw new Error('Entries must be finite numbers or null.');if(i===j&&Math.abs(v-1)>1e-10)throw new Error('Every diagonal entry must be 1.');if((v===null)!==(matrix[j][i]===null)||(v!==null&&Math.abs(v-matrix[j][i])>1e-10))throw new Error('The matrix and its missing entries must be symmetric.');}));if($('strategy').value==='custom')$('strategy').value=state.customBaseStrategy;state.customDraft=null;state.customSelection=null;state.customMessage='';state.matrix=clone(matrix);state.base=clone(matrix);state.reference=reference?clone(reference):null;state.source=source;state.inputPending='';state.pairPending=false;state.generationSeed=source==='generated'?$('seed').valueAsNumber:null;state.free={};state.judgements={};state.freeLevels={};state.stash={};state.pair=[0,1];$('order').value=matrix.map((_,i)=>i+1).join(',');$('source').value=source;$('generation').hidden=source!=='generated';$('manual').hidden=source!=='manual';$('dataset-label').textContent=sourceLabel();invalidate();showStep(0);plan();}
  function generate(){try{const matrix=MatrixInputs.generate(Number($('dimension').value),$('seed').valueAsNumber);load(matrix,'generated',matrix);}catch(e){error(e.message);}}
  function markInputPending(message){state.inputPending=message;invalidate(0,true,false);$('input-feedback').className='input-feedback warn';$('input-feedback').textContent=message;}
  $('source').onchange=()=>{const source=$('source').value;renderControlNotes();$('generation').hidden=source!=='generated';$('manual').hidden=source!=='manual';if(source==='slides'){$('method').value='vine';$('strategy').value='greedy';load(slides,'slides');}else if(source==='generated'){state.source='generated';markInputPending('Choose “Generate matrix” to apply the matrix settings before continuing.');generate();}else if(source==='preset')load(preset,'preset');else if(source==='three')load([[1,.5,null],[.5,1,.5],[null,.5,1]],'three');else{state.source='manual';$('matrix-json').value=JSON.stringify(state.matrix);markInputPending('Choose “Use matrix” to apply the pasted matrix before continuing.');$('dataset-label').textContent='Manual matrix editor · apply or edit below';}};
  $('matrix-json').addEventListener('input',()=>markInputPending('Choose “Use matrix” to apply the pasted matrix before continuing.'));
  ['dimension','seed'].forEach(id=>$(id).addEventListener('input',()=>{if($('source').value==='generated')markInputPending('Choose “Generate matrix” to apply the matrix settings before continuing.');}));
  $('pair-value').addEventListener('input',()=>{state.pairPending=true;invalidate(0,true,false);});
  $('generate').onclick=generate;$('apply-matrix').onclick=()=>{try{const matrix=JSON.parse($('matrix-json').value.replace(/\?/g,'null'));if(!Array.isArray(matrix)||matrix.length<3||matrix.length>7||matrix.some(row=>!Array.isArray(row)||row.length!==matrix.length))throw new Error('Use a square JSON matrix with 3–7 variables.');load(matrix,'manual');}catch(e){invalidate();$('lab-status').textContent='Manual input rejected · no result';$('input-feedback').className='input-feedback warn';$('input-feedback').textContent='Rejected input was not applied. The previous matrix remains available for correction; it has no accepted result in this state.';error('Manual input not applied: '+e.message);}};
  $('random-mask').onclick=()=>{try{const pairs=MatrixInputs.choosePairs(state.matrix,$('mask-count').valueAsNumber,$('mask-seed').valueAsNumber);state.stash??={};pairs.forEach(([i,j])=>{state.stash[`${i},${j}`]=state.matrix[i][j];state.matrix[i][j]=state.matrix[j][i]=null;});invalidate();showStep(0);plan();}catch(e){error(e.message);}};
  $('restore-input').onclick=()=>{state.pairPending=false;state.matrix=clone(state.base);state.stash={};state.free={};state.judgements={};invalidate();plan();};$('reset-lab').onclick=()=>{$('method').value='vine';$('strategy').value='greedy';load(slides,'slides');};
  $('mask-mode').onclick=()=>{state.pairPending=false;state.mode='mask';renderMode();renderEditor();};$('edit-mode').onclick=()=>{state.pairPending=false;state.mode='edit';renderMode();renderEditor();};
  $('set-pair').onclick=()=>{const value=$('pair-value').valueAsNumber;if(!Number.isFinite(value)||Math.abs(value)>=1){error('An off-diagonal correlation must be finite and strictly between −1 and 1.');return;}const [i,j]=state.pair;state.pairPending=false;state.matrix[i][j]=state.matrix[j][i]=value;invalidate();plan();};$('hide-pair').onclick=()=>{state.pairPending=false;const [i,j]=state.pair;state.stash??={};if(state.matrix[i][j]!==null)state.stash[`${i},${j}`]=state.matrix[i][j];state.matrix[i][j]=state.matrix[j][i]=null;invalidate();plan();};
  $('method').onchange=()=>{state.free={};state.judgements={};invalidate(2);plan();};
  $('strategy').onchange=()=>{if($('strategy').value==='custom'){startCustomVine();return;}state.customDraft=null;state.customSelection=null;state.customMessage='';if($('strategy').value==='greedy'&&orderProblem())$('order').value=state.matrix.map((_,i)=>i+1).join(',');state.free={};state.judgements={};invalidate(1);plan();};
  $('order').addEventListener('input',()=>{state.planDirty=true;state.free={};state.judgements={};invalidate(1,true,false);});
  $('order').onchange=()=>{state.free={};state.judgements={};invalidate(1);plan();};
  $('sidebar-back').onclick=()=>showStep(Math.max(0,state.step-1));$('sidebar-next').onclick=advance;
  $('reconstruction-view').onchange=()=>{renderTrace();renderSidebar();};
  $('vine-trees').addEventListener('click',event=>{const target=event.target.closest('[data-vine-action]');if(target)customEditorAction(target);});
  $('vine-trees').addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('[data-vine-action]')){event.preventDefault();customEditorAction(event.target);}});
  document.querySelectorAll('[data-step]').forEach(e=>e.onclick=()=>showStep(Number(e.dataset.step)));document.querySelectorAll('[data-next]').forEach(e=>e.onclick=advance);$('complete').onclick=complete;$('complete-from-partials').onclick=complete;$('trace-prev').onclick=()=>{state.trace=Math.max(0,state.trace-1);renderTrace();};$('trace-next').onclick=()=>{state.trace++;renderTrace();};$('reveal-truth').onclick=()=>{state.referenceShown=!state.referenceShown;$('reveal-truth').textContent=state.referenceShown?'Hide reference':'Reveal hidden reference & compare';$('truth-content').hidden=!state.referenceShown;if(state.referenceShown)renderTruth();};
  $('export-general').onclick=()=>{if(!state.response?.result)return;const data={problem:payload('complete'),result:state.response.result,trace:state.response.trace,scale:'Ordinary Pearson correlation',note:'Illustrative local calculation. Hidden generating reference excluded.'};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='vine-matrix-experiment.json';a.click();URL.revokeObjectURL(url);};
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[data-note],a[data-note-back]');if(!link)return;
    if(link.dataset.note){const note=$(link.dataset.note);if(!note)return;event.preventDefault();$('explorer-notes').open=true;note.dataset.returnTo=link.id||'';note.querySelector('[data-note-back]').setAttribute('href',link.id?'#'+link.id:'#explore');note.scrollIntoView({block:'start',behavior:'instant'});note.focus({preventScroll:true});}
    else{const note=$(link.dataset.noteBack),origin=$(note?.dataset.returnTo||'');event.preventDefault();const target=origin&&origin.getBoundingClientRect().height?origin:document.querySelector('.process-steps .active');target.scrollIntoView({block:'center',behavior:'instant'});target.focus({preventScroll:true});}
  });
  $('dataset-label').textContent=sourceLabel();renderEditor();renderSidebar();plan();
})();

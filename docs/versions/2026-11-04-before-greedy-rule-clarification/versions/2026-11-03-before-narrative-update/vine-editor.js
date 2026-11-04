(function (root) {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const key = edge => [...edge.conditioned].sort((a,b)=>a-b).join(',')+'|'+[...(edge.conditioning||[])].sort((a,b)=>a-b).join(',');
  const label = edge => edge.conditioned.join('')+(edge.conditioning.length?';'+edge.conditioning.join(''):'');

  class DraftVine {
    constructor(plan) {
      this.dimension = plan.trees[0].nodes.length;
      this.initial = plan.trees.map(tree => tree.edges.map(edge => ({conditioned:[...edge.conditioned],conditioning:[...edge.conditioning]})));
      this.trees = copy(this.initial);
      this.history = [];
    }
    describe() {
      const levels = [], used = new Set();
      for (let level=0; level<this.dimension-1; level++) {
        if (level && !levels[level-1].complete) {
          levels.push({level:level+1,blocked:true,nodes:[],edges:[],candidates:[],complete:false,message:`Finish T${level} to build T${level+1}.`});
          continue;
        }
        const nodes = level ? levels[level-1].edges.map(edge => ({id:edge.key,
          variables:[...new Set([...edge.conditioned,...edge.conditioning])].sort((a,b)=>a-b),
          label:label(edge),previousEdge:[edge.u,edge.v]})) : Array.from({length:this.dimension},(_,i)=>({id:String(i+1),variables:[i+1],label:String(i+1)}));
        const candidates=[];
        for(let a=0;a<nodes.length;a++)for(let b=a+1;b<nodes.length;b++){
          if(level&&!nodes[a].previousEdge.some(v=>nodes[b].previousEdge.includes(v)))continue;
          const left=nodes[a].variables,right=nodes[b].variables;
          const conditioned=[...left.filter(v=>!right.includes(v)),...right.filter(v=>!left.includes(v))].sort((x,y)=>x-y);
          const conditioning=left.filter(v=>right.includes(v)).sort((x,y)=>x-y);
          if(conditioned.length!==2||conditioning.length!==level)continue;
          const edge={u:nodes[a].id,v:nodes[b].id,conditioned,conditioning};
          edge.key=key(edge);candidates.push(edge);
        }
        const lookup=new Map(candidates.map(edge=>[edge.key,edge]));
        const specs=this.trees[level]||[],edges=specs.map(spec=>lookup.get(key(spec))).filter(Boolean);
        const parent=new Map(nodes.map(node=>[node.id,node.id]));
        const find=id=>{while(parent.get(id)!==id)id=parent.get(id);return id;};
        let cycle=false,repeat=false;const pairs=new Set(used);
        edges.forEach(edge=>{const a=find(edge.u),b=find(edge.v);if(a===b)cycle=true;else parent.set(a,b);const pair=edge.conditioned.join(',');if(pairs.has(pair))repeat=true;pairs.add(pair);});
        const components=new Set(nodes.map(node=>find(node.id))).size;
        const invalid=edges.length!==specs.length||new Set(edges.map(edge=>edge.key)).size!==edges.length||cycle||repeat;
        const complete=!invalid&&edges.length===nodes.length-1&&components===1;
        const message=invalid?'A connection breaks the tree or proximity rules.':complete?'Complete':`${edges.length} of ${nodes.length-1} connections · ${components} groups to join`;
        levels.push({level:level+1,nodes,edges,candidates,complete,blocked:false,components,message});
        edges.forEach(edge=>used.add(edge.conditioned.join(',')));
      }
      return {levels,complete:levels.every(tree=>tree.complete),firstIncomplete:levels.findIndex(tree=>!tree.complete)};
    }
    connection(level,u,v) {
      const tree=this.describe().levels[level];
      if(tree.blocked)return {allowed:false,reason:tree.message};
      if(u===v)return {allowed:false,reason:'Choose two different nodes.'};
      const edge=tree.candidates.find(edge=>(edge.u===u&&edge.v===v)||(edge.u===v&&edge.v===u));
      if(!edge)return {allowed:false,reason:`Proximity rule: these nodes do not represent edges sharing a node in T${level}.`};
      if(tree.edges.some(item=>item.key===edge.key))return {allowed:false,reason:'These nodes are already connected. Click the edge to remove it.'};
      const reached=new Set([u]);let changed=true;
      while(changed){changed=false;tree.edges.forEach(item=>{if(reached.has(item.u)&&!reached.has(item.v)){reached.add(item.v);changed=true;}if(reached.has(item.v)&&!reached.has(item.u)){reached.add(item.u);changed=true;}});}
      if(reached.has(v))return {allowed:false,reason:'This would create a cycle. Remove an edge first.'};
      const earlier=this.describe().levels.slice(0,level+1).flatMap(item=>item.edges);
      if(earlier.some(item=>item.conditioned.join(',')===edge.conditioned.join(',')))return {allowed:false,reason:'This conditioned pair already occurs in the vine.'};
      return {allowed:true,edge};
    }
    allowedTargets(level,id) {
      const tree=this.describe().levels[level];
      return tree.nodes.filter(node=>this.connection(level,id,node.id).allowed);
    }
    snapshot(){this.history.push(copy(this.trees));if(this.history.length>50)this.history.shift();}
    clearAfter(level){for(let i=level+1;i<this.trees.length;i++)this.trees[i]=[];}
    remove(level,edgeKey){
      const index=this.trees[level].findIndex(edge=>key(edge)===edgeKey);
      if(index<0)return false;
      this.snapshot();this.trees[level].splice(index,1);this.clearAfter(level);return true;
    }
    connect(level,u,v){
      const answer=this.connection(level,u,v);
      if(!answer.allowed)return answer;
      this.snapshot();this.trees[level].push({conditioned:[...answer.edge.conditioned],conditioning:[...answer.edge.conditioning]});
      this.clearAfter(level);return answer;
    }
    undo(){if(!this.history.length)return false;this.trees=this.history.pop();return true;}
    reset(){this.snapshot();this.trees=copy(this.initial);}
    payload(){return copy(this.trees);}
  }
  const api=Object.freeze({DraftVine,key,label});
  if(typeof module==='object'&&module.exports)module.exports=api;else root.VineEditor=api;
})(typeof window==='object'?window:globalThis);

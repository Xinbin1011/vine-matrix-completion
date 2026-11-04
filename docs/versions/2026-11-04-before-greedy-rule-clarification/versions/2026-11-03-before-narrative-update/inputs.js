/* Reproducible illustrative inputs only. Hidden reference values stay in the client. */
(function (root) {
  "use strict";
  function random(seed) {
    let value = Number(seed) >>> 0;
    return function () {
      value += 0x6D2B79F5;
      let t = value;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function generate(dimension, seed) {
    if (!Number.isInteger(dimension) || dimension < 3 || dimension > 7) throw new Error("Choose 3 to 7 variables.");
    if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw new Error("Use an integer seed between 0 and 4294967295.");
    const rng = random(seed);
    const normal = () => Math.sqrt(-2 * Math.log(Math.max(rng(),1e-15))) * Math.cos(2*Math.PI*rng());
    const a = Array.from({length:dimension},()=>Array.from({length:dimension+2},normal));
    const covariance = a.map((row,i)=>a.map((other,j)=>row.reduce((sum,x,k)=>sum+x*other[k],0)+(i===j?.5:0)));
    return covariance.map((row,i)=>row.map((v,j)=>i===j?1:v/Math.sqrt(covariance[i][i])/Math.sqrt(covariance[j][j])));
  }
  function pairs(matrix) {
    const values=[];
    for(let i=0;i<matrix.length;i++) for(let j=i+1;j<matrix.length;j++) if(matrix[i][j]!==null) values.push([i,j]);
    return values;
  }
  function choosePairs(matrix, count, seed) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw new Error("Use an integer mask seed between 0 and 4294967295.");
    const values = pairs(matrix), rng=random(seed);
    if(!Number.isInteger(count)||count<0||count>values.length) throw new Error(`Choose 0 to ${values.length} currently supplied pairs.`);
    for(let i=values.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[values[i],values[j]]=[values[j],values[i]];}
    return values.slice(0,count);
  }
  root.MatrixInputs=Object.freeze({generate,choosePairs});
})(globalThis);

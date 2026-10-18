# shared by the Lift e2e tests: every visible text vs. the real background behind it
CONTRAST_JS = r"""(min)=>{
 const P=c=>{const m=c&&c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(/[ ,\/]+/).filter(Boolean).map(parseFloat);return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1};};
 const L=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b);};
 const B=(t,u)=>({r:t.r*t.a+u.r*(1-t.a),g:t.g*t.a+u.g*(1-t.a),b:t.b*t.a+u.b*(1-t.a),a:1});
 const bg=el=>{const ch=[];for(let e=el;e;e=e.parentElement)ch.push(e);let c={r:255,g:255,b:255,a:1};
   for(let i=ch.length-1;i>=0;i--){const b=P(getComputedStyle(ch[i]).backgroundColor);if(b&&b.a>0)c=B(b,c);}return c;};
 const out=[],w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
 while(n=w.nextNode()){const t=n.nodeValue.trim();if(!t)continue;const el=n.parentElement;if(!el||el.closest("svg,.hidden,script,style"))continue;
   const r=el.getBoundingClientRect();if(!r.width||!r.height||r.bottom<0||r.top>innerHeight*3)continue;
   let op=1,skip=false;for(let e=el;e;e=e.parentElement){const cs=getComputedStyle(e);op*=+cs.opacity;if(cs.visibility==="hidden"||cs.display==="none"||e.disabled)skip=true;}
   if(skip||op<0.6)continue;
   const b=bg(el);let f=P(getComputedStyle(el).color);if(!f)continue;if(f.a<1)f=B(f,b);
   const a=L(f),c=L(b),cr=(Math.max(a,c)+0.05)/(Math.min(a,c)+0.05);
   if(cr<min)out.push(t.slice(0,32)+" ["+cr.toFixed(2)+" "+(el.className||el.tagName)+"]");}
 return out;}"""

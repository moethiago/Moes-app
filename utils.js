function timeAgo(val){

  if(typeof val === "string") return val;

  const diff = (Date.now()-val)/1000;

  if(diff<60) return "just now";

  if(diff<3600) return Math.floor(diff/60)+"m ago";

  if(diff<86400) return Math.floor(diff/3600)+"h ago";

  return Math.floor(diff/86400)+"d ago";

}

function openLink(url){

  if(url && url !== "#") window.open(url,"_blank");

}
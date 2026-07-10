import { supabase, escapeHtml, avatarHtml, safeJson, modeLabel } from './supabaseClient.js';

let game=null, players=[], channel=null, pollInterval=null, loading=false;
const $=id=>document.getElementById(id);
const joinCard=$('viewerJoinCard'), viewerCard=$('viewerCard'), stateBox=$('viewerState');

const urlCode=new URLSearchParams(location.search).get('code');
if(urlCode)$('viewerCode').value=urlCode;
$('viewerJoinBtn').onclick=joinViewer;
if(urlCode)joinViewer();

async function joinViewer(){
  const code=$('viewerCode').value.trim();
  if(!code){$('viewerMsg').textContent='Введи код гри';return}
  const {data,error}=await supabase.from('absurd_games').select('*').eq('invite_code',code).single();
  if(error||!data){$('viewerMsg').textContent='Гру не знайдено';return}
  game=data;
  joinCard.classList.add('hidden');
  viewerCard.classList.remove('hidden');
  await refreshState();
  subscribe();
}

async function refreshState(){
  if(!game||loading)return;
  loading=true;
  try{
    const [gRes,pRes]=await Promise.all([
      supabase.from('absurd_games').select('*').eq('id',game.id).single(),
      supabase.from('absurd_players').select('*').eq('game_id',game.id).order('score',{ascending:false})
    ]);
    if(!gRes.error&&gRes.data)game=gRes.data;
    players=pRes.data||[];
    render();
  }finally{loading=false}
}

function subscribe(){
  if(channel)supabase.removeChannel(channel);
  if(pollInterval)clearInterval(pollInterval);
  channel=supabase.channel('absurd-viewer-'+game.id)
    .on('postgres_changes',{event:'*',schema:'public',table:'absurd_games',filter:'id=eq.'+game.id},p=>{game=p.new;refreshState()})
    .on('postgres_changes',{event:'*',schema:'public',table:'absurd_players',filter:'game_id=eq.'+game.id},refreshState)
    .subscribe();
  pollInterval=setInterval(refreshState,1600);
}

function render(){
  const c=safeJson(game.current_case_json,{});
  if(game.phase==='finished'){stateBox.innerHTML=finalHtml();return}
  if(game.phase==='lobby'){
    stateBox.innerHTML=`<span class="pill">${modeLabel(game.mode)}</span><h2>Лобі</h2><p class="muted">Очікуємо гравців...</p><div class="modeGrid">${players.map(p=>`<div class="playerRow"><div class="avatarLine">${avatarHtml(p,'big')}<b>${escapeHtml(p.name)}</b></div></div>`).join('')}</div>`;
    return;
  }
  if(game.phase==='briefing'){
    stateBox.innerHTML=`<span class="pill">${escapeHtml(c.title||'Справа')}</span><div class="caseBrief">${escapeHtml(c.publicBrief||'')}</div><div class="timerStage"><div><h2>Гравці читають секретні ролі</h2><div class="timerDots"><span></span><span></span><span></span></div></div></div>`;
    return;
  }
  if(game.phase==='performance'){
    stateBox.innerHTML=`<span class="pill">${escapeHtml(c.title||'Справа')}</span><div class="caseBrief">${escapeHtml(c.publicBrief||'')}</div><h2>Час виступів</h2><p class="muted">${escapeHtml(c.task||'')}</p>`;
    return;
  }
  if(game.phase==='voting'){
    stateBox.innerHTML=`<span class="pill">${escapeHtml(c.title||'Справа')}</span><div class="caseBrief">${escapeHtml(c.publicBrief||'')}</div><div class="timerStage"><div><h2>Голосування</h2><p class="muted">${players.filter(p=>p.vote_target).length}/${players.length} голосів</p><div class="timerDots"><span></span><span></span><span></span></div></div></div>`;
    return;
  }
  if(game.phase==='results') stateBox.innerHTML=resultsHtml(c);
}

function resultsHtml(c){
  if(c.voteType==='verdict'){
    const guilty=players.filter(p=>p.vote_target==='guilty').length;
    const innocent=players.filter(p=>p.vote_target==='innocent').length;
    return `<div class="resultHero"><div class="winnerBadge">⚖</div><h2>${guilty>=innocent?'Винен':'Невинен'}</h2><p class="muted">Винен: ${guilty} · Невинен: ${innocent}</p></div>${scoreHtml()}`;
  }
  const saboteur=players.find(p=>Number(p.id)===Number(c.saboteur_id));
  return `<div class="resultHero"><div class="winnerBadge">🎭</div><h2>Саботажник: ${escapeHtml(saboteur?.name||'невідомо')}</h2></div>${scoreHtml()}`;
}

function scoreHtml(){return `<h2>Рейтинг</h2>${players.map((p,i)=>`<div class="scoreCard"><div class="avatarLine">${avatarHtml(p,'big')}<b>${i===0?'🏆 ':''}${escapeHtml(p.name)}</b></div><b>${p.score||0}</b></div>`).join('')}`}
function finalHtml(){
  const winner=players[0];
  return `<div class="resultHero"><div class="winnerBadge">🏆</div><h2>${escapeHtml(winner?.name||'Гра завершена')}</h2><p class="finalTitle">Король/королева абсурдних справ</p></div>${scoreHtml()}`;
}

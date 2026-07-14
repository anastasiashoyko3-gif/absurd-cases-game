import { supabase, escapeHtml, avatarHtml, safeJson } from './supabaseClient.js';

let game=null, player=null, players=[], channel=null, pollInterval=null, loading=false;
const $=id=>document.getElementById(id);
const joinCard=$('joinCard'), playCard=$('playCard'), stateBox=$('playState');

const urlCode=new URLSearchParams(location.search).get('code');
if(urlCode)$('inviteCode').value=urlCode;
$('joinBtn').onclick=joinGame;
$('leaveBtn').onclick=()=>{localStorage.removeItem('absurd_game_id');localStorage.removeItem('absurd_player_id');location.reload()};
restoreSession();

async function restoreSession(){
  const gameId=localStorage.getItem('absurd_game_id'), playerId=localStorage.getItem('absurd_player_id');
  if(!gameId||!playerId)return;
  const [gRes,pRes]=await Promise.all([
    supabase.from('absurd_games').select('*').eq('id',gameId).single(),
    supabase.from('absurd_players').select('*').eq('id',playerId).single()
  ]);
  if(gRes.error||pRes.error||!gRes.data||!pRes.data)return;
  game=gRes.data;player=pRes.data;openPlay();await refreshState();subscribe();
}

async function joinGame(){
  const code=$('inviteCode').value.trim(), name=$('playerName').value.trim(), pin=$('playerPin').value.trim(), avatar=$('playerAvatar').value.trim();
  if(!code||!name||!pin){$('joinMsg').textContent='Заповни код, імʼя і PIN';return}
  const {data:foundGame,error:gameErr}=await supabase.from('absurd_games').select('*').eq('invite_code',code).single();
  if(gameErr||!foundGame){$('joinMsg').textContent='Гру не знайдено';return}
  game=foundGame;
  const {data:existing}=await supabase.from('absurd_players').select('*').eq('game_id',game.id).ilike('name',name).eq('pin',pin).maybeSingle();
  if(existing){
    player=existing;
    if(avatar&&avatar!==existing.avatar){
      const {data}=await supabase.from('absurd_players').update({avatar}).eq('id',existing.id).select().single();
      if(data)player=data;
    }
  }else{
    const {data:newPlayer,error}=await supabase.from('absurd_players').insert({game_id:game.id,name,pin,avatar:avatar||'⚖',score:0,created_at:new Date().toISOString()}).select().single();
    if(error){$('joinMsg').textContent=error.message;return}
    player=newPlayer;
  }
  localStorage.setItem('absurd_game_id',game.id);
  localStorage.setItem('absurd_player_id',player.id);
  openPlay();await refreshState();subscribe();
}

function openPlay(){
  joinCard.classList.add('hidden');
  playCard.classList.remove('hidden');
  $('meName').textContent=player.name;
}

async function refreshState(){
  if(!game||loading)return;
  loading=true;
  try{
    const [gRes,pRes,allRes]=await Promise.all([
      supabase.from('absurd_games').select('*').eq('id',game.id).single(),
      supabase.from('absurd_players').select('*').eq('id',player.id).single(),
      supabase.from('absurd_players').select('*').eq('game_id',game.id).order('score',{ascending:false})
    ]);
    if(!gRes.error&&gRes.data)game=gRes.data;
    if(!pRes.error&&pRes.data)player=pRes.data;
    players=allRes.data||[];
    render();
  }finally{loading=false}
}

function subscribe(){
  if(channel)supabase.removeChannel(channel);
  if(pollInterval)clearInterval(pollInterval);
  channel=supabase.channel('absurd-player-'+game.id)
    .on('postgres_changes',{event:'*',schema:'public',table:'absurd_games',filter:'id=eq.'+game.id},p=>{game=p.new;refreshState()})
    .on('postgres_changes',{event:'*',schema:'public',table:'absurd_players',filter:'game_id=eq.'+game.id},refreshState)
    .subscribe();
  pollInterval=setInterval(refreshState,1600);
}

function render(){
  applyTheme(game.theme);
  const c=safeJson(game.current_case_json,{});
  if(game.phase==='finished'){stateBox.innerHTML=finalHtml();return}
  if(game.phase==='lobby'){
    stateBox.innerHTML=`<h2>Лобі</h2><p class="muted">Чекаємо старт справи...</p>${players.map(p=>`<div class="playerRow"><div class="avatarLine">${avatarHtml(p)}<b>${escapeHtml(p.name)}</b></div><b>${p.score||0}</b></div>`).join('')}`;
    return;
  }
  if(game.phase==='briefing'||game.phase==='performance'){
    stateBox.innerHTML=`
      <span class="pill">${escapeHtml(c.title||'Справа')}</span>
      ${c.packLabel?`<span class="pill">${escapeHtml(c.packLabel)}</span>`:''}
      <div class="caseBrief">${escapeHtml(c.publicBrief||'')}</div>
      ${eventsHtml(c)}
      <div class="secretCard">
        <p class="muted">Твоя секретна роль</p>
        <div class="roleName">${escapeHtml(player.role||'Учасник')}</div>
        <p>${escapeHtml(player.secret_instruction||'Імпровізуй і підтримуй абсурд.')}</p>
      </div>
      ${player.secret_mission?`
        <div class="secretCard missionCard">
          <p class="muted">Твоя таємна місія</p>
          <p>${escapeHtml(player.secret_mission)}</p>
        </div>
      `:''}
      <p class="muted">${game.phase==='briefing'?'Прочитай роль і нікому не показуй телефон.':'Час виступати, переконувати і підозрювати.'}</p>
    `;
    return;
  }
  if(game.phase==='voting'){
    stateBox.innerHTML=voteHtml(c);
    return;
  }
  if(game.phase==='results'){
    stateBox.innerHTML=resultsHtml(c);
  }
}

function voteHtml(c){
  if(c.voteType==='judge_verdict'){
    return `<h2>Суддя радиться</h2><p class="muted">Гравці більше не голосують за вирок. Переконуйте суддю, тисніть аргументами й готуйтеся до рішення.</p>${eventsHtml(c)}`;
  }
  if(c.voteType==='verdict'){
    return `<h2>Вердикт</h2><p class="muted">Обери рішення присяжних.</p>${c.voteOptions.map(o=>`<button class="option" onclick="window.vote('${o.id}')">${escapeHtml(o.text)}${player.vote_target===o.id?' ✓':''}</button>`).join('')}`;
  }
  return `<h2>Хто саботажник?</h2><p class="muted">Голосуй за найпідозрілішого.</p>${players.map(p=>`<button class="option" onclick="window.vote('${p.id}')">${avatarHtml(p)} ${escapeHtml(p.name)}${String(player.vote_target)===String(p.id)?' ✓':''}</button>`).join('')}`;
}

window.vote=async(target)=>{
  const {error}=await supabase.from('absurd_players').update({vote_target:String(target)}).eq('id',player.id);
  if(error)alert(error.message);
  await refreshState();
};

function resultsHtml(c){
  if(c.voteType==='judge_verdict'){
    return `<div class="resultHero"><div class="winnerBadge">⚖</div><h2>${c.verdict==='innocent'?'Невинен':'Винен'}</h2><p class="muted">Вирок оголосив суддя.</p></div>${eventsHtml(c)}${scoreHtml()}`;
  }
  if(c.voteType==='verdict'){
    const guilty=players.filter(p=>p.vote_target==='guilty').length;
    const innocent=players.filter(p=>p.vote_target==='innocent').length;
    return `<div class="resultHero"><div class="winnerBadge">⚖</div><h2>${guilty>=innocent?'Винен':'Невинен'}</h2><p class="muted">Винен: ${guilty} · Невинен: ${innocent}</p></div>${scoreHtml()}`;
  }
  const saboteur=players.find(p=>Number(p.id)===Number(c.saboteur_id));
  return `<div class="resultHero"><div class="winnerBadge">🕵</div><h2>Саботажник: ${escapeHtml(saboteur?.name||'невідомо')}</h2><p class="muted">Тепер можна сперечатись, хто був занадто переконливим.</p></div>${scoreHtml()}`;
}

function scoreHtml(){return `<h2>Рейтинг</h2>${players.map(p=>`<div class="scoreCard"><div class="avatarLine">${avatarHtml(p)}<b>${escapeHtml(p.name)}</b></div><b>${p.score||0}</b></div>`).join('')}`}
function finalHtml(){return `<div class="resultHero"><div class="winnerBadge">🏆</div><h2>Гра завершена</h2></div>${scoreHtml()}`}

function eventsHtml(c){
  const events=c.events||[];
  if(!events.length)return '';
  return `<div class="eventStack">${events.map(e=>`<div class="eventCard"><b>${escapeHtml(e.type)}</b><p>${escapeHtml(e.text)}</p></div>`).join('')}</div>`;
}

function applyTheme(theme='classic'){
  document.body.classList.remove('theme-noir','theme-neon','theme-courtroom','theme-detective');
  if(theme && theme!=='classic') document.body.classList.add('theme-'+theme);
}

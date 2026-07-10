import { supabase, makeCode, safeJson, escapeHtml, avatarHtml, modeLabel, buildCase } from './supabaseClient.js';

let game=null, players=[], channel=null, pollInterval=null, loading=false;
const $=id=>document.getElementById(id);
const createCard=$('createCard'), hostCard=$('hostCard');

$('createBtn').onclick=createGame;
$('newGameBtn').onclick=()=>location.reload();
$('refreshBtn').onclick=loadData;
$('finishBtn').onclick=finishGame;
$('nextBtn').onclick=nextStage;

async function createGame(){
  const title=$('gameTitle').value.trim()||'Вечір Абсурдних Справ';
  const mode=document.querySelector('[name="mode"]:checked')?.value||'court';
  const {data,error}=await supabase.from('absurd_games').insert({
    invite_code:makeCode(),
    title,
    mode,
    phase:'lobby',
    round_no:0,
    current_case_json:'{}',
    status:'active',
    created_at:new Date().toISOString()
  }).select().single();
  if(error){$('createMsg').textContent=error.message;return}
  openGame(data);
}

async function openGame(found){
  game=found;
  createCard.classList.add('hidden');
  hostCard.classList.remove('hidden');
  $('hostTitle').textContent=game.title;
  $('playerInvite').textContent=`${location.origin}/player.html?code=${game.invite_code}`;
  $('viewerInvite').textContent=`${location.origin}/viewer.html?code=${game.invite_code}`;
  subscribe();
  await loadData();
}

async function loadData(){
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
  channel=supabase.channel('absurd-admin-'+game.id)
    .on('postgres_changes',{event:'*',schema:'public',table:'absurd_games',filter:'id=eq.'+game.id},p=>{game=p.new;loadData()})
    .on('postgres_changes',{event:'*',schema:'public',table:'absurd_players',filter:'game_id=eq.'+game.id},loadData)
    .subscribe();
  pollInterval=setInterval(loadData,1600);
}

function render(){
  renderPlayers();
  renderScore();
  renderCaseState();
  renderResultPanel();
  renderNextButton();
}

function renderPlayers(){
  $('playersList').innerHTML=players.length?players.map(p=>`
    <div class="playerRow">
      <div class="avatarLine">${avatarHtml(p)}<b>${escapeHtml(p.name)}</b></div>
      <div><span class="pill">${p.score||0} балів</span></div>
    </div>
  `).join(''):'<p class="muted">Гравців ще немає.</p>';
}

function renderScore(){
  const arr=[...players].sort((a,b)=>Number(b.score||0)-Number(a.score||0));
  $('scoreBoard').innerHTML=arr.length?arr.map((p,i)=>`
    <div class="scoreCard">
      <div class="avatarLine">${avatarHtml(p,'big')}<div><b>${i===0?'🏆 ':''}${escapeHtml(p.name)}</b><p class="muted">${titleFor(p)}</p></div></div>
      <b>${p.score||0}</b>
    </div>
  `).join(''):'<p class="muted">Балів ще немає.</p>';
}

function renderCaseState(){
  const c=safeJson(game.current_case_json,{});
  if(game.phase==='lobby'){
    $('caseState').innerHTML=`<span class="pill">${modeLabel(game.mode)}</span><p class="muted">Чекаємо гравців. Мінімум весело від 4, але можна тестити і з 2-3.</p>`;
    return;
  }
  if(game.phase==='finished'){
    $('caseState').innerHTML=finalHtml();
    return;
  }
  $('caseState').innerHTML=`
    <span class="pill">${escapeHtml(c.title||modeLabel(game.mode))}</span>
    <span class="pill">Раунд ${game.round_no||1}</span>
    <div class="caseBrief">${escapeHtml(c.publicBrief||'Справу ще не відкрито.')}</div>
    <p class="muted">${escapeHtml(c.task||'')}</p>
  `;
}

function renderResultPanel(){
  if(game.phase!=='results'){$('resultPanel').innerHTML='';return}
  const c=safeJson(game.current_case_json,{});
  if(c.voteType==='verdict'){
    const guilty=players.filter(p=>p.vote_target==='guilty').length;
    const innocent=players.filter(p=>p.vote_target==='innocent').length;
    const verdict=guilty>=innocent?'Винен':'Невинен';
    $('resultPanel').innerHTML=`<div class="resultHero"><div class="winnerBadge">⚖</div><h2>${verdict}</h2><p class="muted">Винен: ${guilty} · Невинен: ${innocent}</p></div>`;
    return;
  }
  const votes=countVotes();
  const top=votes[0];
  const suspected=players.find(p=>String(p.id)===String(top?.id));
  const saboteur=players.find(p=>Number(p.id)===Number(c.saboteur_id));
  const found=suspected&&saboteur&&Number(suspected.id)===Number(saboteur.id);
  $('resultPanel').innerHTML=`<div class="resultHero"><div class="winnerBadge">${found?'🕵':'🎭'}</div><h2>${found?'Саботажника викрито':'Саботажник уникнув підозри'}</h2><p class="muted">Саботажник: <b>${escapeHtml(saboteur?.name||'невідомо')}</b>. Найбільше підозрювали: <b>${escapeHtml(suspected?.name||'нікого')}</b>.</p></div>`;
}

function renderNextButton(){
  const map={
    lobby:'Запустити справу',
    briefing:'Почати виступи',
    performance:'Перейти до голосування',
    voting:'Відкрити результати',
    results:'Наступна справа',
    finished:'Гра завершена'
  };
  $('nextBtn').textContent=map[game.phase]||'Далі';
  $('nextBtn').disabled=game.phase==='finished';
  $('nextHint').textContent=hintFor(game.phase);
}

async function nextStage(){
  if(!game)return;
  if(game.phase==='lobby'||game.phase==='results') return startCase();
  if(game.phase==='briefing') return updateGame({phase:'performance'});
  if(game.phase==='performance') return updateGame({phase:'voting'});
  if(game.phase==='voting') return finishVoting();
}

async function startCase(){
  if(players.length<2){alert('Потрібно хоча б 2 гравці для тесту. Для повної гри краще 4+.');return}
  const selected=document.querySelector('[name="nextMode"]:checked')?.value||'auto';
  const mode=selected==='auto'?game.mode:selected;
  const nextCase=buildCase(mode,players);
  await supabase.from('absurd_players').update({role:null,secret_instruction:null,vote_target:null}).eq('game_id',game.id);
  for(const p of players){
    const role=nextCase.roles?.[p.id]||{role:'Учасник',instruction:'Імпровізуй і підтримуй хаос.'};
    await supabase.from('absurd_players').update({role:role.role,secret_instruction:role.instruction,vote_target:null}).eq('id',p.id);
  }
  await updateGame({phase:'briefing',round_no:Number(game.round_no||0)+1,current_case_json:JSON.stringify(nextCase)});
}

async function finishVoting(){
  const c=safeJson(game.current_case_json,{});
  if(c.voteType==='verdict'){
    const accused=players.find(p=>p.role==='Підсудний');
    if(accused) await addScore(accused.id, players.filter(p=>p.vote_target==='innocent').length>=players.filter(p=>p.vote_target==='guilty').length?2:0);
  }else{
    const votes=countVotes();
    const suspected=players.find(p=>String(p.id)===String(votes[0]?.id));
    if(Number(suspected?.id)===Number(c.saboteur_id)){
      for(const p of players.filter(x=>Number(x.id)!==Number(c.saboteur_id))) await addScore(p.id,1);
    }else if(c.saboteur_id){
      await addScore(c.saboteur_id,2);
    }
  }
  await updateGame({phase:'results'});
}

async function addScore(playerId,delta){
  if(!delta)return;
  const p=players.find(x=>Number(x.id)===Number(playerId));
  if(!p)return;
  await supabase.from('absurd_players').update({score:Number(p.score||0)+delta}).eq('id',playerId);
}

async function updateGame(update){
  const {data,error}=await supabase.from('absurd_games').update(update).eq('id',game.id).select().single();
  if(error){alert(error.message);return}
  game=data;
  await loadData();
}

async function finishGame(){
  if(!confirm('Завершити вечір справ?'))return;
  await updateGame({phase:'finished',status:'finished'});
}

function countVotes(){
  const map=new Map();
  players.forEach(p=>{if(p.vote_target)map.set(String(p.vote_target),(map.get(String(p.vote_target))||0)+1)});
  return [...map.entries()].map(([id,count])=>({id,count})).sort((a,b)=>b.count-a.count);
}

function finalHtml(){
  const arr=[...players].sort((a,b)=>Number(b.score||0)-Number(a.score||0));
  const winner=arr[0];
  if(!winner)return '<p class="muted">Гра завершена.</p>';
  return `<div class="resultHero"><div class="winnerBadge">🏆</div><h2>${escapeHtml(winner.name)}</h2><p class="finalTitle">${titleFor(winner)}</p><p class="muted">${winner.score||0} балів</p></div>`;
}

function titleFor(p){
  const titles=['Адвокат хаосу','Майстер підозри','Свідок із душею','Головний драматург','Саботажний геній'];
  return titles[Number(p.id||0)%titles.length];
}

function hintFor(phase){
  if(phase==='lobby')return 'Гравці заходять за посиланням, потім запускай першу справу.';
  if(phase==='briefing')return 'Гравці читають секретні ролі. TV бачить тільки публічну справу.';
  if(phase==='performance')return 'Час для виступів, допитів і театру.';
  if(phase==='voting')return 'Гравці голосують на своїх телефонах.';
  if(phase==='results')return 'Результати відкриті. Можна запускати наступну справу.';
  return '';
}

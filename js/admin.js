import { supabase, makeCode, safeJson, escapeHtml, avatarHtml, modeLabel, buildCase, shuffle } from './supabaseClient.js';

let game=null, players=[], customPacks=[], customMissions=[], channel=null, pollInterval=null, loading=false, editingPackId=null, selectedMissionId=null;
const $=id=>document.getElementById(id);
const createCard=$('createCard'), hostCard=$('hostCard');

$('createBtn').onclick=createGame;
$('newGameBtn').onclick=()=>location.reload();
$('refreshBtn').onclick=loadData;
$('finishBtn').onclick=finishGame;
$('nextBtn').onclick=nextStage;
$('rerollBtn').onclick=rerollCase;
$('judgePhraseBtn').onclick=showJudgePhrase;
$('chaosCardBtn').onclick=addChaosCard;
$('lastWordBtn').onclick=addLastWord;
$('guiltyBtn').onclick=()=>judgeVerdict('guilty');
$('innocentBtn').onclick=()=>judgeVerdict('innocent');
$('hostTheme').onchange=saveTheme;
$('courtPack').onchange=saveDefaultPack;
$('hostMissionMode').onchange=saveMissionMode;
$('newPackBtn').onclick=newPack;
$('savePackBtn').onclick=savePack;
$('deletePackBtn').onclick=deletePack;
$('templatePackBtn').onclick=fillPackTemplate;
$('templateMissionBtn').onclick=fillMissionTemplate;
$('newMissionBtn').onclick=newMission;
$('saveMissionBtn').onclick=saveMissions;
$('toggleMissionBtn').onclick=toggleMission;
$('deleteMissionBtn').onclick=deleteMission;

setupAdminLobby();
loadLibrary();

async function createGame(){
  const title=$('gameTitle').value.trim()||'Вечір Абсурдних Справ';
  const mode=document.querySelector('[name="mode"]:checked')?.value||'court';
  const {data,error}=await supabase.from('absurd_games').insert({
    invite_code:makeCode(),
    title,
    mode,
    theme:$('gameTheme').value||'classic',
    default_pack:$('initialCourtPack').value||'mix',
    mission_mode:$('initialMissionMode').value||'active',
    phase:'lobby',
    round_no:0,
    current_case_json:'{}',
    used_accusations_json:'[]',
    used_evidence_json:'[]',
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

function setupAdminLobby(){
  const library=document.createElement('section');
  library.id='adminLibrary';
  library.className='adminLibrary';
  createCard.after(library);
  document.querySelectorAll('#hostCard > .innerPanel').forEach(panel=>library.appendChild(panel));
}

async function loadLibrary(){
  const [packRes,missionRes]=await Promise.all([
    supabase.from('absurd_court_packs').select('*').order('id',{ascending:false}),
    supabase.from('absurd_secret_missions').select('*').order('active',{ascending:false}).order('id',{ascending:false})
  ]);
  customPacks=packRes.data||[];
  customMissions=missionRes.data||[];
  renderPackTools();
  renderMissionTools();
}

async function refreshAdminData(){
  if(game) await loadData();
  else await loadLibrary();
}

async function loadData(){
  if(!game||loading)return;
  loading=true;
  try{
    const [gRes,pRes,packRes,missionRes]=await Promise.all([
      supabase.from('absurd_games').select('*').eq('id',game.id).single(),
      supabase.from('absurd_players').select('*').eq('game_id',game.id).order('score',{ascending:false}),
      supabase.from('absurd_court_packs').select('*').order('id',{ascending:false}),
      supabase.from('absurd_secret_missions').select('*').order('active',{ascending:false}).order('id',{ascending:false})
    ]);
    if(!gRes.error&&gRes.data)game=gRes.data;
    players=pRes.data||[];
    customPacks=packRes.data||[];
    customMissions=missionRes.data||[];
    render();
  }finally{loading=false}
}

function subscribe(){
  if(channel)supabase.removeChannel(channel);
  if(pollInterval)clearInterval(pollInterval);
  channel=supabase.channel('absurd-admin-'+game.id)
    .on('postgres_changes',{event:'*',schema:'public',table:'absurd_games',filter:'id=eq.'+game.id},p=>{game=p.new;loadData()})
    .on('postgres_changes',{event:'*',schema:'public',table:'absurd_players',filter:'game_id=eq.'+game.id},loadData)
    .on('postgres_changes',{event:'*',schema:'public',table:'absurd_secret_missions'},loadData)
    .subscribe();
  pollInterval=setInterval(loadData,1600);
}

function render(){
  applyTheme(game.theme);
  if($('hostTheme')) $('hostTheme').value=game.theme||'classic';
  if($('hostMissionMode')) $('hostMissionMode').value=game.mission_mode||'active';
  renderPackTools();
  renderMissionTools();
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
    ${c.packLabel?`<span class="pill">${escapeHtml(c.packLabel)}</span>`:''}
    <span class="pill">Раунд ${game.round_no||1}</span>
    <div class="caseBrief">${escapeHtml(c.publicBrief||'Справу ще не відкрито.')}</div>
    <p class="muted">${escapeHtml(c.task||'')}</p>
    ${eventsHtml(c)}
  `;
}

function renderResultPanel(){
  if(game.phase!=='results'){$('resultPanel').innerHTML='';return}
  const c=safeJson(game.current_case_json,{});
  if(c.voteType==='judge_verdict'){
    const verdict=c.verdict==='innocent'?'Невинен':'Винен';
    $('resultPanel').innerHTML=`<div class="resultHero"><div class="winnerBadge">⚖</div><h2>${verdict}</h2><p class="muted">Вирок оголосив суддя.</p></div>`;
    return;
  }
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

function eventsHtml(c){
  const events=c.events||[];
  if(!events.length)return '';
  return `<div class="eventStack">${events.map(e=>`<div class="eventCard"><b>${escapeHtml(e.type)}</b><p>${escapeHtml(e.text)}</p></div>`).join('')}</div>`;
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
  const c=safeJson(game.current_case_json,{});
  if(game.phase==='voting'&&c.voteType==='judge_verdict') $('nextBtn').textContent='Вирок через кнопки судді';
  $('nextBtn').disabled=game.phase==='finished';
  if(game.phase==='voting'&&c.voteType==='judge_verdict') $('nextBtn').disabled=true;
  $('nextHint').textContent=hintFor(game.phase);
}

async function nextStage(){
  if(!game)return;
  if(game.phase==='lobby'||game.phase==='results') return startCase();
  if(game.phase==='briefing') return updateGame({phase:'performance'});
  if(game.phase==='performance') return updateGame({phase:'voting'});
  if(game.phase==='voting'){
    const c=safeJson(game.current_case_json,{});
    if(c.voteType==='judge_verdict'){alert('У Суді вирок приймає ведучий-суддя кнопками "Винен" або "Невинен".');return}
    return finishVoting();
  }
}

async function startCase(){
  if(players.length<2){alert('Потрібно хоча б 2 гравці для тесту. Для повної гри краще 4+.');return}
  const nextCase=makeNextCase();
  const missionPlan=(game.mission_mode==='off')?{byPlayer:new Map(),usedIds:[]}:pickMissions(players);
  await assignRoles(nextCase,missionPlan);
  if(missionPlan.usedIds.length){
    await supabase.from('absurd_secret_missions').update({active:false,used_at:new Date().toISOString()}).in('id',missionPlan.usedIds);
  }
  await updateGame({
    phase:'briefing',
    round_no:Number(game.round_no||0)+1,
    current_case_json:JSON.stringify(nextCase),
    used_accusations_json:JSON.stringify(nextUsedList(game.used_accusations_json,nextCase.accusation)),
    used_evidence_json:JSON.stringify(nextUsedList(game.used_evidence_json,nextCase.evidence))
  });
}

function makeNextCase(){
  const selected=document.querySelector('[name="nextMode"]:checked')?.value||'auto';
  const mode=selected==='auto'?game.mode:selected;
  const packChoice=$('courtPack')?.value||game.default_pack||'mix';
  let courtPack=packChoice, customCourtPack=null;
  if(packChoice.startsWith('custom:')){
    const packId=Number(packChoice.split(':')[1]);
    const pack=customPacks.find(x=>Number(x.id)===packId);
    customCourtPack=packToCasePack(pack);
    courtPack='custom';
  }
  return buildCase(mode,players,{
    courtPack,
    customCourtPack,
    usedAccusations:safeJson(game.used_accusations_json,[]),
    usedEvidence:safeJson(game.used_evidence_json,[])
  });
}

async function assignRoles(nextCase,missionPlan={byPlayer:new Map()}){
  await supabase.from('absurd_players').update({role:null,secret_instruction:null,secret_mission:null,vote_target:null}).eq('game_id',game.id);
  for(const p of players){
    const role=nextCase.roles?.[p.id]||{role:'Учасник',instruction:'Імпровізуй і підтримуй хаос.'};
    await supabase.from('absurd_players').update({role:role.role,secret_instruction:role.instruction,secret_mission:missionPlan.byPlayer.get(Number(p.id))||null,vote_target:null}).eq('id',p.id);
  }
}

function nextUsedList(raw,value){
  const arr=safeJson(raw,[]);
  if(!value || arr.includes(value)) return arr;
  return [...arr,value];
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

async function judgeVerdict(verdict){
  const c=safeJson(game.current_case_json,{});
  if(c.voteType!=='judge_verdict'){alert('Вирок судді працює тільки в режимі Суду.');return}
  if(game.phase!=='voting'&&game.phase!=='performance'){alert('Спочатку доведи справу до вироку.');return}
  c.verdict=verdict;
  const accused=players.find(p=>p.role==='Підсудний');
  if(accused && verdict==='innocent') await addScore(accused.id,2);
  await updateGame({phase:'results',current_case_json:JSON.stringify(c)});
}

async function rerollCase(){
  if(!game || !['briefing','performance'].includes(game.phase)){alert('Ре-рол краще робити після старту справи, до вироку.');return}
  const nextCase=makeNextCase();
  await assignRoles(nextCase,{byPlayer:new Map(players.map(p=>[Number(p.id),p.secret_mission]))});
  await updateGame({
    current_case_json:JSON.stringify(nextCase),
    used_accusations_json:JSON.stringify(nextUsedList(game.used_accusations_json,nextCase.accusation)),
    used_evidence_json:JSON.stringify(nextUsedList(game.used_evidence_json,nextCase.evidence))
  });
}

const judgePhrases=[
  'Суду це не подобається, але суд заінтригований.',
  'Заперечення прийнято, бо прозвучало впевнено.',
  'Заперечення відхилено, бо мені не сподобався вайб.',
  'Підсудний виглядає занадто спокійно, це підозріло.',
  'Доказ має погану енергетику, але ми його вислухаємо.',
  'Суд просить менше правди і більше драми.',
  'Це не аргумент, це емоційний феєрверк.',
  'Свідок тримається на чесному слові й закусці.',
  'Суд тимчасово втратив довіру до всіх.',
  'Останнє слово підсудного, і бажано без нових злочинів.'
];

const chaosCards=[
  'Раптовий доказ: будь-який предмет на столі стає доказом.',
  'Новий свідок: будь-хто має 20 секунд придумати, що він бачив.',
  'Суддя вимагає драми: наступна репліка має бути максимально театральною.',
  'Погане алібі: підсудний має 15 секунд вигадати найгірше алібі.',
  'Прокурор перегрівся: прокурор має звинуватити ще й предмет.',
  'Адвокат у паніці: адвокат має захистити доказ, а не підсудного.',
  'Свідок плутається: свідок має змінити одну деталь своєї історії.',
  'Суд втомився: усі наступні відповіді мають бути коротші за 5 слів.',
  'Режим серіалу: наступні 30 секунд усі говорять драматичніше.',
  'Несподіваний поворот: підсудний може звинуватити будь-кого у відповідь.'
];

const lastWordCards=[
  'Підсудний має останнє слово як герой дешевого серіалу.',
  'Підсудний має останнє слово максимально жалюгідно.',
  'Підсудний має останнє слово так, ніби не винен, але дуже хоче уваги.',
  'Підсудний має останнє слово і мусить звинуватити доказ.',
  'Підсудний має останнє слово як політик, який нічого не визнає.',
  'Підсудний має останнє слово романтично.',
  'Підсудний має останнє слово і згадує маму, Славіка або чай.',
  'Підсудний має останнє слово, але кожне речення починає з "чесно".'
];

function showJudgePhrase(){
  const text=randomFrom(judgePhrases);
  $('judgeToolBox').innerHTML=`<b>Фраза судді</b><p>${escapeHtml(text)}</p>`;
}

async function addChaosCard(){
  await addCaseEvent('Картка хаосу',randomFrom(chaosCards));
}

async function addLastWord(){
  await addCaseEvent('Останнє слово',randomFrom(lastWordCards));
}

async function addCaseEvent(type,text){
  if(!game || game.phase==='lobby'){alert('Спочатку запусти справу.');return}
  const c=safeJson(game.current_case_json,{});
  c.events=[...(c.events||[]),{type,text,at:new Date().toISOString()}].slice(-5);
  $('judgeToolBox').innerHTML=`<b>${escapeHtml(type)}</b><p>${escapeHtml(text)}</p>`;
  await updateGame({current_case_json:JSON.stringify(c)});
}

function randomFrom(items){
  return items[Math.floor(Math.random()*items.length)];
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

async function saveTheme(){
  if(!game)return;
  await updateGame({theme:$('hostTheme').value||'classic'});
}

async function saveDefaultPack(){
  if(!game)return;
  await updateGame({default_pack:$('courtPack').value||'mix'});
}

async function saveMissionMode(){
  if(!game)return;
  await updateGame({mission_mode:$('hostMissionMode').value||'active'});
}

function applyTheme(theme='classic'){
  document.body.classList.remove('theme-noir','theme-neon','theme-courtroom','theme-detective');
  if(theme && theme!=='classic') document.body.classList.add('theme-'+theme);
}

function renderPackTools(){
  syncPackSelect('initialCourtPack',$('initialCourtPack')?.value||'mix');
  syncPackSelect('courtPack',game?.default_pack||$('courtPack')?.value||'mix');
  const list=$('customPacksList');
  if(!list)return;
  list.innerHTML=customPacks.length?customPacks.map(p=>`
    <div class="playerRow">
      <div>
        <b>${escapeHtml(p.title||'Без назви')}</b>
        <p class="muted">${packCount(p.accusations_json)} звинувачень · ${packCount(p.objects_json)} доказів</p>
      </div>
      <button class="secondary smallBtn" onclick="window.editPack(${Number(p.id)})">Редагувати</button>
    </div>
  `).join(''):'<p class="muted">Власних наборів ще немає.</p>';
}

function syncPackSelect(id,preferred='mix'){
  const select=$(id);
  if(select){
    const builtIn=[...select.options].filter(o=>!o.value.startsWith('custom:')).map(o=>o.outerHTML).join('');
    const custom=customPacks.map(p=>`<option value="custom:${p.id}">Мій набір: ${escapeHtml(p.title||'Без назви')}</option>`).join('');
    select.innerHTML=builtIn+custom;
    if([...select.options].some(o=>o.value===preferred)) select.value=preferred;
  }
}

function packCount(value){
  return safeJson(value,[]).length;
}

function packToCasePack(pack){
  if(!pack)return null;
  const accusations=safeJson(pack.accusations_json,[]).filter(Boolean);
  const objects=safeJson(pack.objects_json,[]).filter(Boolean);
  if(!accusations.length||!objects.length)return null;
  return {label:pack.title||'Мій набір',accusations,objects};
}

function linesFrom(id){
  return $(id).value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
}

function newPack(){
  editingPackId=null;
  $('packTitle').value='';
  $('packAccusations').value='';
  $('packObjects').value='';
  $('packMsg').textContent='Створи новий набір і збережи.';
}

window.editPack=(id)=>{
  const pack=customPacks.find(p=>Number(p.id)===Number(id));
  if(!pack)return;
  editingPackId=Number(pack.id);
  $('packTitle').value=pack.title||'';
  $('packAccusations').value=safeJson(pack.accusations_json,[]).join('\n');
  $('packObjects').value=safeJson(pack.objects_json,[]).join('\n');
  $('packMsg').textContent='Редагуємо вибраний набір.';
};

async function savePack(){
  const title=$('packTitle').value.trim();
  const accusations=linesFrom('packAccusations');
  const objects=linesFrom('packObjects');
  if(!title||!accusations.length||!objects.length){
    $('packMsg').textContent='Додай назву, хоча б одне звинувачення і хоча б один доказ.';
    return;
  }
  const payload={title,accusations_json:JSON.stringify(accusations),objects_json:JSON.stringify(objects),created_at:new Date().toISOString()};
  const query=editingPackId
    ? supabase.from('absurd_court_packs').update(payload).eq('id',editingPackId)
    : supabase.from('absurd_court_packs').insert(payload);
  const {error}=await query;
  if(error){$('packMsg').textContent=error.message;return}
  $('packMsg').textContent='Набір збережено.';
  editingPackId=null;
  await refreshAdminData();
}

async function deletePack(){
  if(!editingPackId){$('packMsg').textContent='Спочатку обери набір для редагування.';return}
  if(!confirm('Видалити цей набір?'))return;
  const {error}=await supabase.from('absurd_court_packs').delete().eq('id',editingPackId);
  if(error){$('packMsg').textContent=error.message;return}
  newPack();
  await refreshAdminData();
}

function renderMissionTools(){
  const list=$('missionsList');
  if(!list)return;
  const selected=customMissions.find(m=>Number(m.id)===Number(selectedMissionId));
  $('toggleMissionBtn').textContent=selected?.active?'Зробити неактивною':'Зробити активною';
  list.innerHTML=customMissions.length?customMissions.map(m=>`
    <div class="playerRow ${Number(m.id)===Number(selectedMissionId)?'selectedRow':''}">
      <div>
        <b>${m.active?'Активна':'Неактивна'}</b>
        <p>${escapeHtml(m.text||'')}</p>
        ${m.used_at?`<p class="muted">Використана: ${new Date(m.used_at).toLocaleString()}</p>`:''}
      </div>
      <button class="secondary smallBtn" onclick="window.selectMission(${Number(m.id)})">Обрати</button>
    </div>
  `).join(''):'<p class="muted">Таємних місій ще немає.</p>';
}

function newMission(){
  selectedMissionId=null;
  $('missionText').value='';
  $('missionMsg').textContent='Додай одну або кілька місій, кожну з нового рядка.';
  renderMissionTools();
}

window.selectMission=(id)=>{
  selectedMissionId=Number(id);
  const mission=customMissions.find(m=>Number(m.id)===Number(id));
  $('missionText').value=mission?.text||'';
  $('missionMsg').textContent='Місію вибрано.';
  renderMissionTools();
};

async function saveMissions(){
  const missions=linesFrom('missionText');
  if(!missions.length){$('missionMsg').textContent='Напиши хоча б одну місію.';return}
  const rows=missions.map(text=>({text,active:true,used_by:null,used_at:null,created_at:new Date().toISOString()}));
  const {error}=await supabase.from('absurd_secret_missions').insert(rows);
  if(error){$('missionMsg').textContent=error.message;return}
  $('missionMsg').textContent='Місії додано. Вони активні.';
  $('missionText').value='';
  selectedMissionId=null;
  await refreshAdminData();
}

async function toggleMission(){
  const mission=customMissions.find(m=>Number(m.id)===Number(selectedMissionId));
  if(!mission){$('missionMsg').textContent='Спочатку обери місію.';return}
  const nextActive=!mission.active;
  const payload=nextActive?{active:true,used_by:null,used_at:null}:{active:false};
  const {error}=await supabase.from('absurd_secret_missions').update(payload).eq('id',mission.id);
  if(error){$('missionMsg').textContent=error.message;return}
  $('missionMsg').textContent=nextActive?'Місія знову активна.':'Місія стала неактивною.';
  await refreshAdminData();
}

async function deleteMission(){
  if(!selectedMissionId){$('missionMsg').textContent='Спочатку обери місію.';return}
  if(!confirm('Видалити цю місію?'))return;
  const {error}=await supabase.from('absurd_secret_missions').delete().eq('id',selectedMissionId);
  if(error){$('missionMsg').textContent=error.message;return}
  newMission();
  await refreshAdminData();
}

function fillPackTemplate(){
  $('packTitle').value='Стартовий крінж-набір';
  $('packAccusations').value=[
    'підозрюється у крадіжці останнього нормального настрою в кімнаті',
    'звинувачується у незаконному використанні фрази "ну це база"',
    'підозрюється у тому, що приніс напій для всіх, але тримав його біля себе',
    'звинувачується у саботажі плейлиста піснею, яку ніхто не просив',
    'підозрюється у тому, що заспівав пісню, знаючи лише два слова і впевненість',
    'звинувачується у тому, що грав як кончений уйобок',
    'підозрюється у тому, що створив груповий чат, який одразу став джерелом страждання',
    'звинувачується у тому, що запропонував піти кудись посидіти, але не сказав куди'
  ].join('\n');
  $('packObjects').value=[
    'голосове повідомлення від Славіка',
    'порожній пакет від чипсів із відбитками самовпевненості',
    'плейлист із назвою "точно зайде"',
    'фото, де підсудний дивиться прямо в провину',
    'чашка, в якій були чай, кава і пиво, змішані разом',
    'розйобане крісло-гойдалка',
    '20 порожніх пляшок з-під пива',
    'щука'
  ].join('\n');
  $('packMsg').textContent='Шаблон вставлено. Можеш редагувати й натиснути "Зберегти набір".';
}

function fillMissionTemplate(){
  $('missionText').value=[
    'Погладь когось по голові так, ніби це абсолютно нормально. Якщо тебе викрили: стань і урочисто поклонись цій людині.',
    'Вкради в когось один ковток напою. Якщо тебе викрили: підсунь цій людині закуску як компенсацію.',
    'Непомітно пересунь чужий стакан на 10 сантиметрів. Якщо тебе викрили: поверни стакан назад двома руками, як святиню.',
    'Попроси суд внести слово "ой" у протокол. Якщо тебе викрили: тричі скажи "ой" офіційним тоном.',
    'Згадай Артема як головного експерта у справі. Якщо тебе викрили: скажи "Артем мене не уповноважував".',
    'Передай Івану будь-який предмет як таємний доказ. Якщо тебе викрили: скажи "Іван тепер у справі".',
    'Один раз демонстративно понюхай повітря. Якщо тебе викрили: скажи "Пахне пиздежем".',
    'Спробуй зробити комусь уявну печатку на плече. Якщо тебе викрили: постав уявну печатку собі на лоб.'
  ].join('\n');
  $('missionMsg').textContent='Шаблон місій вставлено. Можеш редагувати й натиснути "Додати місії".';
}

function pickMissions(currentPlayers){
  const active=shuffle(customMissions.filter(m=>m.active&&m.text));
  const byPlayer=new Map();
  const usedIds=[];
  currentPlayers.forEach((player,index)=>{
    const mission=active[index];
    if(!mission)return;
    byPlayer.set(Number(player.id),mission.text);
    usedIds.push(mission.id);
  });
  return {byPlayer,usedIds};
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

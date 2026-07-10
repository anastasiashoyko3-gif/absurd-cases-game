import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

if(!supabaseUrl || !supabaseKey){
  alert('Не знайдено VITE_SUPABASE_URL або VITE_SUPABASE_KEY у Vercel Environment Variables');
}

export const supabase = createClient(supabaseUrl,supabaseKey);

export function makeCode(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out='';
  for(let i=0;i<8;i++) out+=chars[Math.floor(Math.random()*chars.length)];
  return out;
}

export function safeJson(value,fallback={}){
  if(!value) return fallback;
  if(typeof value === 'object') return value;
  try{return JSON.parse(value)}catch{return fallback}
}

export function escapeHtml(text){
  return String(text ?? '').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[m]));
}

export function avatarHtml(person,size=''){
  const avatar=(person && person.avatar) || '';
  const cls=`avatar ${size}`.trim();
  if(String(avatar).startsWith('http')) return `<span class="${cls}" style="background-image:url('${escapeHtml(avatar)}')"></span>`;
  return `<span class="${cls}">${escapeHtml(avatar || ((person && person.name) || '?')[0])}</span>`;
}

export function shuffle(items){
  const arr=[...items];
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

export function modeLabel(mode){
  if(mode==='court') return 'Суд присяжних';
  if(mode==='sabotage') return 'Таємний саботажник';
  return 'Мікс справ';
}

const accusations=[
  'підозрюється у крадіжці останнього шматка піци з мотивом "я просто вирівнював коробку"',
  'звинувачується в навмисному псуванні плейлиста під виглядом музичного смаку',
  'підозрюється у тому, що драматично мовчав у чаті рівно 47 хвилин',
  'звинувачується в незаконному використанні фрази "я на хвилинку" перед зникненням на годину',
  'підозрюється у створенні хаосу за допомогою дуже впевненого "мені здається"',
  'звинувачується у тому, що приніс на вечірку загадковий настрій і не пояснив інструкцію'
];

const objects=[
  'пластикова виделка',
  'скріншот без контексту',
  'порожня чашка',
  'плейлист із трьома однаковими піснями',
  'стікер із котом у костюмі',
  'таємничий чек на 17 гривень'
];

const witnessFacts=[
  'Ти бачив/бачила підозрюваного біля місця події, але не впевнений/впевнена, чи це було місце події.',
  'Твій факт звучить переконливо, але ти маєш випадково переплутати одну деталь.',
  'Ти на 80% впевнений/впевнена, що доказ важливий, хоча не знаєш чому.',
  'Ти маєш згадати дивний звук, який усі повинні сприйняти серйозно.',
  'Ти бачив/бачила когось із дуже винним виразом обличчя, але це міг бути просто голод.'
];

const sabotageTasks=[
  'Скласти план ідеальної вечірки за 2 хвилини.',
  'Домовитись про 5 речей, які команда бере на безлюдний острів.',
  'Придумати офіційну версію дуже дивної події.',
  'Обрати найкращий спосіб врятувати зіпсований день народження.',
  'Створити коротку промову мера міста, де все заборонено після 21:00.'
];

const sabotageInstructions=[
  'Підтримуй найгірші ідеї так, ніби вони геніальні.',
  'Проси уточнити очевидні речі й непомітно затягуй час.',
  'Пропонуй варіанти, які звучать логічно, але роблять план гіршим.',
  'Погоджуйся з усіма, а потім мʼяко перевертай висновок у дивний бік.',
  'Спробуй переконати команду прибрати найкорисніший пункт.'
];

export function buildCase(mode,players){
  const actualMode=mode==='mix' ? (Math.random()>.5?'court':'sabotage') : mode;
  if(actualMode==='sabotage') return buildSabotageCase(players);
  return buildCourtCase(players);
}

function buildCourtCase(players){
  const shuffled=shuffle(players);
  const accused=shuffled[0];
  const prosecutor=shuffled[1];
  const defender=shuffled[2];
  const witnesses=shuffled.slice(3,Math.min(shuffled.length,6));
  const jurors=shuffled.slice(Math.min(shuffled.length,6));
  const accusation=accusations[Math.floor(Math.random()*accusations.length)];
  const evidence=objects[Math.floor(Math.random()*objects.length)];

  const roles={};
  if(accused) roles[accused.id]={role:'Підсудний',instruction:'Ти маєш захищатися. Можеш визнавати дрібні дивності, але головне звинувачення заперечуй красиво.'};
  if(prosecutor) roles[prosecutor.id]={role:'Прокурор',instruction:`Доведи, що доказ "${evidence}" повністю викриває підсудного. Будь драматичним/драматичною.`};
  if(defender) roles[defender.id]={role:'Адвокат',instruction:'Захищай підсудного. Твоя стратегія: усе було непорозумінням, а доказ взагалі має інше значення.'};
  witnesses.forEach((p,i)=>roles[p.id]={role:'Свідок',instruction:witnessFacts[i%witnessFacts.length]});
  jurors.forEach(p=>roles[p.id]={role:'Присяжний',instruction:'Слухай аргументи й голосуй: винен чи невинен. Можеш ставити короткі незручні питання.'});

  return {
    mode:'court',
    title:'Суд присяжних',
    publicBrief:`${accused?.name || 'Хтось'} ${accusation}. Ключовий доказ: ${evidence}.`,
    task:'Виступи по черзі: прокурор, адвокат, свідки, підсудний. Потім усі голосують.',
    voteType:'verdict',
    voteOptions:[
      {id:'guilty',text:'Винен'},
      {id:'innocent',text:'Невинен'}
    ],
    roles
  };
}

function buildSabotageCase(players){
  const shuffled=shuffle(players);
  const saboteur=shuffled[0];
  const detective=shuffled[1];
  const task=sabotageTasks[Math.floor(Math.random()*sabotageTasks.length)];
  const instruction=sabotageInstructions[Math.floor(Math.random()*sabotageInstructions.length)];
  const roles={};

  players.forEach(p=>{
    roles[p.id]={role:'Команда',instruction:'Допомагай команді виконати завдання. Слідкуй, хто поводиться підозріло.'};
  });
  if(saboteur) roles[saboteur.id]={role:'Таємний саботажник',instruction};
  if(detective && detective.id!==saboteur?.id) roles[detective.id]={role:'Детектив',instruction:'Ти граєш за команду. Став уточнюючі питання і спробуй викрити саботажника.'};

  return {
    mode:'sabotage',
    title:'Таємний саботажник',
    publicBrief:task,
    task:'Команда має домовитись про результат. Після обговорення всі голосують, хто був саботажником.',
    voteType:'player',
    voteOptions:players.map(p=>({id:String(p.id),text:p.name,player_id:p.id})),
    roles,
    saboteur_id:saboteur?.id || null
  };
}

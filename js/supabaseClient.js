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

const courtPacks={
  party:{
    label:'Крінж вечірки',
    accusations:[
      'звинувачується у тому, що перетворив тост на 12-хвилинний TED Talk без дозволу гостей',
      'підозрюється у саботажі танцполу через демонстрацію руху "пральна машина на віджимі"',
      'звинувачується у викраденні уваги всіх гостей фразою "а давайте зіграємо в одну гру"',
      'підозрюється у тому, що приніс чипси, але відкрив їх сам у коридорі',
      'звинувачується у злочинному перемиканні музики на "оце зараз точно зайде"'
    ],
    objects:[
      'порожній пакет від чипсів',
      'стакан із підозрілою мʼятою',
      'відео танцю, яке ніхто не просив знімати',
      'плейлист із назвою "фінальна версія 7"',
      'кришечка від пляшки, знайдена в дуже драматичному місці'
    ]
  },
  adult:{
    label:'18+ без жорсті',
    accusations:[
      'звинувачується у тому, що фліртував так незграбно, що Wi-Fi попросив перезавантаження',
      'підозрюється у надсиланні повідомлення "ти спиш?" із юридично сумнівним наміром',
      'звинувачується у використанні голосового на 4 хвилини як зброї масового крінжу',
      'підозрюється у тому, що назвав свого колишнього "просто знайомим із сюжетом"',
      'звинувачується у створенні напруги фразою "нам треба поговорити" посеред вечірки'
    ],
    objects:[
      'скріншот переписки без останнього повідомлення',
      'келих, який усе бачив',
      'реакція ❤️ поставлена занадто швидко',
      'плейлист "не думати про нього/неї"',
      'помада/парфум, що випадково став доказом'
    ]
  },
  dating:{
    label:'Дейтинг-катастрофи',
    accusations:[
      'звинувачується у тому, що поставив у профіль фото пʼятирічної давності й назвав це "стабільністю"',
      'підозрюється у ghostingʼу з формулюванням "я просто був у ресурсі мовчати"',
      'звинувачується у першому побаченні, яке перетворилось на співбесіду з HR',
      'підозрюється у фразі "я не шукаю нічого серйозного", сказаній із серйозним обличчям',
      'звинувачується у тому, що написав "ахах" без жодної емоції'
    ],
    objects:[
      'анкета з dating app',
      'скрін "онлайн 2 хвилини тому"',
      'лайк о 03:17',
      'кава, яка була єдиною хімією на побаченні',
      'повідомлення "ой, я тільки побачив/побачила"'
    ]
  },
  home:{
    label:'Побутові злочини',
    accusations:[
      'підозрюється у залишенні однієї ложки салату, щоб формально "не доїдати останнє"',
      'звинувачується у тому, що поставив порожню пляшку назад у холодильник',
      'підозрюється у злочинному складанні пакета з пакетами в ще один пакет',
      'звинувачується у фразі "я потім помию", яка не має строку давності',
      'підозрюється у зникненні зарядки й появі фрази "це не моя"'
    ],
    objects:[
      'порожня пляшка в холодильнику',
      'одна самотня ложка салату',
      'зарядка без власника',
      'тарілка, залишена "замочитись"',
      'пакет із пакетами'
    ]
  },
  office:{
    label:'Офісний цирк',
    accusations:[
      'звинувачується у тому, що сказав "давайте коротко" і відкрив презентацію на 48 слайдів',
      'підозрюється у використанні слова "синергія" без потреби й совісті',
      'звинувачується у крадіжці ідеї з фразою "як ми вже обговорювали"',
      'підозрюється у пасивно-агресивному "як я писав/писала вище"',
      'звинувачується у мітингу, який міг бути одним повідомленням'
    ],
    objects:[
      'календар із трьома однаковими зустрічами',
      'слайд із написом "next steps"',
      'холодна кава менеджера',
      'повідомлення "пінг"',
      'таблиця, яку ніхто не відкривав'
    ]
  }
};

const accusations=Object.values(courtPacks).flatMap(pack=>pack.accusations);
const objects=Object.values(courtPacks).flatMap(pack=>pack.objects);

function randomCourtPack(){
  const packs=Object.values(courtPacks);
  return packs[Math.floor(Math.random()*packs.length)];
}

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

export function buildCase(mode,players,options={}){
  const actualMode=mode==='mix' ? (Math.random()>.5?'court':'sabotage') : mode;
  if(actualMode==='sabotage') return buildSabotageCase(players);
  return buildCourtCase(players,options.courtPack||'mix',options.customCourtPack||null);
}

function buildCourtCase(players,packKey='mix',customPack=null){
  const shuffled=shuffle(players);
  const accused=shuffled[0];
  const prosecutor=shuffled[1];
  const defender=shuffled[2];
  const witnesses=shuffled.slice(3,Math.min(shuffled.length,6));
  const jurors=shuffled.slice(Math.min(shuffled.length,6));
  const pack=customPack || (packKey==='mix' ? randomCourtPack() : (courtPacks[packKey]||randomCourtPack()));
  const accusation=pack.accusations[Math.floor(Math.random()*pack.accusations.length)];
  const evidence=pack.objects[Math.floor(Math.random()*pack.objects.length)];

  const roles={};
  if(accused) roles[accused.id]={role:'Підсудний',instruction:'Ти маєш захищатися. Можеш визнавати дрібні дивності, але головне звинувачення заперечуй красиво.'};
  if(prosecutor) roles[prosecutor.id]={role:'Прокурор',instruction:`Доведи, що доказ "${evidence}" повністю викриває підсудного. Будь драматичним/драматичною.`};
  if(defender) roles[defender.id]={role:'Адвокат',instruction:'Захищай підсудного. Твоя стратегія: усе було непорозумінням, а доказ взагалі має інше значення.'};
  witnesses.forEach((p,i)=>roles[p.id]={role:'Свідок',instruction:witnessFacts[i%witnessFacts.length]});
  jurors.forEach(p=>roles[p.id]={role:'Присяжний',instruction:'Слухай аргументи й голосуй: винен чи невинен. Можеш ставити короткі незручні питання.'});

  return {
    mode:'court',
    title:'Суд присяжних',
    packLabel:pack.label,
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

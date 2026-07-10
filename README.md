# Вечір Абсурдних Справ

Party-game сайт з трьома екранами:

- `admin.html` — ведуча створює гру й керує раундами.
- `player.html` — гравець заходить за кодом, бачить секретну роль і голосує.
- `viewer.html` — TV/глядацький екран без секретних ролей.

## Налаштування Supabase

1. Створи новий Supabase-проєкт або використай існуючий.
2. Відкрий `SQL Editor`.
3. Запусти файл `supabase_schema.sql`.

## Змінні Vercel

Додай у Vercel → Project → Settings → Environment Variables:

```text
VITE_SUPABASE_URL = Project URL із Supabase
VITE_SUPABASE_KEY = anon/public key із Supabase
```

Після додавання змінних зроби redeploy.

## Як грати

1. Відкрий `/admin.html`.
2. Створи гру.
3. Надішли гравцям посилання з адмінки.
4. Відкрий TV-екран на `/viewer.html` або за окремим інвайтом.
5. Натискай “Далі”, щоб рухати гру по фазах.

Це перша MVP-версія. Вона зроблена швидко і весело, без складної авторизації адмінки.

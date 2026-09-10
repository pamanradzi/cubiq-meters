CUBIQ METERS - SUPABASE VERSION

1) Supabase Dashboard > SQL Editor > New query.
2) Copy semua kandungan SUPABASE_SETUP.sql dan Run.
3) Supabase Dashboard > Authentication > Users > Add user.
   Buat email/password admin sendiri. Jangan kongsi password.
4) Copy UUID user yang baru dibuat.
5) SQL Editor, jalankan:
   insert into public.admins(user_id) values ('UUID-ANDA');
6) Host folder ini di GitHub Pages / Cloudflare Pages / Netlify.
7) Buka app > Admin > login dengan email/password admin.
8) Dalam Admin Dashboard tekan "Import 5 Meter + Gambar" sekali sahaja.
9) Selepas import, data dan gambar berada dalam Supabase dan semua pengguna public boleh view/search.

Security:
- Public: SELECT/read sahaja.
- Admin berdaftar dalam public.admins: tambah/edit/delete meter dan upload gambar.
- Publishable key memang direka untuk digunakan di browser; keselamatan write dikawal oleh RLS.
- Jangan letak service_role key atau database password dalam config.js.

IMPORT FIX: Sample images are embedded in data.js, so the 5-meter import works even when index.html is opened directly from Windows (file://).

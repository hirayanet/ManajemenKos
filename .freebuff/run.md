# Run doc — ManajemenKos (KOSFLOW)

Vite + React + TypeScript SPA. Workspace = main checkout (`D:\FILE_AYAH\Project Website\ManajemenKos`), jadi tidak ada file env/artefak yang perlu disalin dari checkout lain — cukup pastikan `node_modules` ada (`npm install` bila kosong). Tidak ada `.env` yang wajib untuk render halaman; panggilan Supabase butuh kredensial env saat runtime.

## Menjalankan server dev

- Default port sesuai `vite.config.ts` adalah **8080**.
- Jika 8080 sudah dipakai proses lain (mis. dev server thread lain), jalankan dengan port bebas lain, contoh `--port 5173`:
  ```
  npm run dev -- --port 5173
  ```
- Detached (Windows, PowerShell) — stdout & stderr ke file berbeda:
  ```
  powershell -NoProfile -Command "(Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev','--','--port','5173' -RedirectStandardOutput '<log>' -RedirectStandardError '<log>.err' -WindowStyle Hidden -PassThru).Id"
  ```
  Pid yang mencetak adalah npm wrapper; proses node yang melayani port bisa dilihat via `netstat -ano | grep :<port>`.
- Verifikasi: `curl -s -o /dev/null -w "%{http_code}" http://localhost:<port>/` → 200.
- Catatan: `Start-Process` lewat bash bisa membuat panggilan `powershell` menggantung >30 s meski server sudah jalan — cek netstat/log alih-alih menganggap gagal.

# sayt22

## Railway sozlamalari

Railway Variables ichida quyidagilar bo'lishi kerak:

```env
BOT_TOKEN=telegram_bot_token
RUN_TELEGRAM_BOT=1
DATA_DIR=/data
```

`DATA_DIR=/data` ishlashi uchun Railway'da Volume yarating va mount path sifatida `/data` ni tanlang. Aks holda `data/data.json` vaqtinchalik diskka yoziladi va restart/deploy paytida o'chib ketishi mumkin.

Gunicorn bitta worker bilan ishga tushadi, chunki Telegram polling bitta bot token bilan faqat bitta workerda ishlashi kerak.

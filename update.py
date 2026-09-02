import os
import sys
from pathlib import Path


def main() -> int:
    BASE_DIR = Path(__file__).resolve().parent
    TARGET_FILE = BASE_DIR / "app-client.js"

    if not TARGET_FILE.exists():
        print(f"[XATO] Fayl topilmadi: {TARGET_FILE}", file=sys.stderr)
        return 1

    try:
        content = TARGET_FILE.read_text(encoding="utf-8")
    except OSError as exc:
        print(f"[XATO] Faylni o'qib bo'lmadi: {exc}", file=sys.stderr)
        return 1

    patches = []

    target_send_msg = '''async function sendMsg() {
  const txt = document.getElementById('msgText').value.trim();
  if (!txt || !selectedChat) return;

  const m = {
    id: Date.now() + Math.random(),
    fromType: curType,
    fromId: curType === 'student' ? curId : curType === 'teacher' ? curTeacherId : curAdminId,
    text: txt,
    timestamp: Date.now(),
    toType: selectedChat.type === 'group' ? 'group' : (selectedChat.type === 'student' ? 'specific_student' : 'specific_teacher'),
    toId: selectedChat.id
  };

  messages.push(m);
  document.getElementById('msgText').value = '';
  await save();
  renderChatHistory();
  renderMessagesPage();
}'''

    replacement_send_msg = '''async function sendMsg() {
  const txt = document.getElementById('msgText').value.trim();
  const fileIn = document.getElementById('msgMediaIn');
  if (!txt && (!fileIn || !fileIn.files[0])) return;
  if (!selectedChat) return;

  const m = {
    id: Date.now() + Math.random(),
    fromType: curType,
    fromId: curType === 'student' ? curId : curType === 'teacher' ? curTeacherId : curAdminId,
    text: txt,
    timestamp: Date.now(),
    toType: selectedChat.type === 'group' ? 'group' : (selectedChat.type === 'admin' ? 'admin' : (selectedChat.type === 'student' ? 'specific_student' : 'specific_teacher')),
    toId: selectedChat.id,
    media: null
  };

  if (fileIn && fileIn.files[0]) {
    const f = fileIn.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
      m.media = { type: f.type, data: e.target.result };
      messages.push(m);
      document.getElementById('msgText').value = '';
      fileIn.value = '';
      await save();
      renderChatHistory();
      renderMessagesPage();
    };
    reader.readAsDataURL(f);
  } else {
    messages.push(m);
    document.getElementById('msgText').value = '';
    await save();
    renderChatHistory();
    renderMessagesPage();
  }
}

function renderMedia(m) {
  if (!m.media) return '';
  if (m.media.type.startsWith('image/')) return `<div style="margin-top:8px;"><img src="${m.media.data}" style="max-width:100%;border-radius:8px;"></div>`;
  if (m.media.type.startsWith('video/')) return `<div style="margin-top:8px;"><video src="${m.media.data}" controls style="max-width:100%;border-radius:8px;"></video></div>`;
  if (m.media.type.startsWith('audio/')) return `<div style="margin-top:8px;"><audio src="${m.media.data}" controls style="width:100%;"></audio></div>`;
  return '';
}'''
    patches.append(("sendMsg + renderMedia qo'shildi", target_send_msg, replacement_send_msg))

    target_fcm1 = '''function formatChatMessage(m, currentType, currentId) {
  const fromLabel = m.fromType === 'student' ? 'Talaba' : m.fromType === 'teacher' ? 'O\\'qituvchi' : m.fromType === 'admin' ? 'Admin' : escHtml(m.fromType);
  const isMine = m.fromType === currentType && nNum(m.fromId) === nNum(currentId);
  return `<div style="margin-bottom:10px;text-align:${isMine ? 'right' : 'left'}"><div style="display:inline-block;padding:10px;border-radius:12px;background:${isMine ? 'rgba(43,125,233,.9)' : 'rgba(255,255,255,.08)'};color:${isMine ? '#fff' : '#e6eafc'};max-width:85%;line-height:1.4;"><strong style="font-size:12px;display:block;margin-bottom:4px;">${escHtml(fromLabel)}</strong>${escHtml(m.text)}<div style="margin-top:6px;font-size:11px;color:rgba(255,255,255,.65);">${new Date(m.timestamp).toLocaleString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</div></div></div>`;
}'''

    replacement_fcm1 = '''function formatChatMessage(m, currentType, currentId) {
  const fromLabel = m.fromType === 'student' ? 'Talaba' : m.fromType === 'teacher' ? 'O\\'qituvchi' : m.fromType === 'admin' ? 'Admin' : escHtml(m.fromType);
  const isMine = m.fromType === currentType && nNum(m.fromId) === nNum(currentId);
  return `<div style="margin-bottom:10px;text-align:${isMine ? 'right' : 'left'}"><div style="display:inline-block;padding:10px;border-radius:12px;background:${isMine ? 'rgba(43,125,233,.9)' : 'rgba(255,255,255,.08)'};color:${isMine ? '#fff' : '#e6eafc'};max-width:85%;line-height:1.4;"><strong style="font-size:12px;display:block;margin-bottom:4px;">${escHtml(fromLabel)}</strong>${escHtml(m.text)}${renderMedia(m)}<div style="margin-top:6px;font-size:11px;color:rgba(255,255,255,.65);">${new Date(m.timestamp).toLocaleString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</div></div></div>`;
}'''
    patches.append(("formatChatMessage ga renderMedia qo'shildi", target_fcm1, replacement_fcm1))

    target_fcm2 = '''          ${escHtml(m.text)}
          <div class="chat-meta">'''

    replacement_fcm2 = '''          ${escHtml(m.text)}
          ${renderMedia(m)}
          <div class="chat-meta">'''
    patches.append(("chat-meta oldiga renderMedia qo'shildi", target_fcm2, replacement_fcm2))

    applied = 0
    skipped = 0
    for name, old, new in patches:
        if old in content:
            content = content.replace(old, new)
            print(f"  [OK] {name}")
            applied += 1
        elif new in content:
            print(f"  [SKIP] {name} — allaqachon qo'llanilgan")
            skipped += 1
        else:
            print(f"  [OGOH] {name} — target qator topilmadi, o'tkazib yuboriladi", file=sys.stderr)
            skipped += 1

    if applied == 0 and skipped == 0:
        print("[XATO] Hech qanday patch qo'llanilmadi. Kod o'zgarmadi.", file=sys.stderr)
        return 2

    try:
        TARGET_FILE.write_text(content, encoding="utf-8")
    except OSError as exc:
        print(f"[XATO] Faylga yozib bo'lmadi: {exc}", file=sys.stderr)
        return 1

    print(f"\nYakun: {applied} ta patch qo'llanildi, {skipped} ta o'tkazib yuborildi.")
    print("Done!")
    return 0


if __name__ == "__main__":
    sys.exit(main())

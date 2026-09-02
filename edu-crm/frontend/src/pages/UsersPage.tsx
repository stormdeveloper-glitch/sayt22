import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api, extractErrorMessage, unwrapListResponse, PaginatedResponse } from '../utils/api';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { useAuth, UserRole } from '../stores/auth';

/* ──────────────────── Types ──────────────────── */
interface UserRow {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  role: 'ADMIN' | 'MANAGER' | 'TEACHER' | 'CASHIER';
  createdAt: string;
  updatedAt: string;
  teacher?: { id: number; name: string; groups: Array<{ id: number; name: string }> } | null;
}

interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

/* ──────────────────── Constants ──────────────────── */
const ROLE_OPTIONS: Array<{ value: Exclude<UserRow['role'], never>; label: string }> = [
  { value: 'ADMIN', label: 'Administrator' },
  { value: 'MANAGER', label: 'Menejer' },
  { value: 'TEACHER', label: "O'qituvchi" },
  { value: 'CASHIER', label: 'Kassir' },
];

const ROLE_LABELS: Record<UserRow['role'], string> = ROLE_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<UserRow['role'], string>,
);

const ROLE_FILTER_OPTIONS = [{ value: '', label: 'Barcha lavozimlar' }, ...ROLE_OPTIONS];

type FormState = {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: UserRow['role'];
};

const EMPTY_FORM: FormState = { email: '', password: '', name: '', phone: '', role: 'MANAGER' };

/* ──────────────────── Helpers ──────────────────── */
function formatPhone(raw: string | null | undefined): string {
  if (!raw) return '—';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('998')) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`;
  }
  if (digits.length === 9) {
    return `+998 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 11 && digits.startsWith('8')) {
    return `+998 ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`;
  }
  return raw;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function normalizePhoneForSend(raw: string): string {
  return raw.replace(/\D/g, '');
}

/* ──────────────────── Component ──────────────────── */
export function UsersPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';
  const canWrite = isAdmin; // read-only for MANAGER

  /* --- State: data --- */
  const [payload, setPayload] = useState<PaginatedResponse<UserRow[]>>({
    data: [],
    meta: { page: 1, limit: 20, total: 0, pageCount: 1 },
  });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);

  /* --- State: UI status --- */
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  /* --- State: errors & toasts --- */
  const [pageError, setPageError] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pushToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4200);
  }, []);

  /* --- State: modal --- */
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [formFieldError, setFormFieldError] = useState<Record<keyof FormState, string>>({
    email: '', password: '', name: '', phone: '', role: '',
  });

  /* ──────────────── Data loader ──────────────── */
  const limit = payload.meta.limit;

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setPageError('');
    try {
      const res = await api.get('/api/users', {
        params: {
          q: search.trim() || undefined,
          role: roleFilter || undefined,
          page,
          limit,
        },
      });
      const next = unwrapListResponse<UserRow[]>(res);
      setPayload(next);
    } catch (err) {
      setPageError(extractErrorMessage(err));
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [search, roleFilter, page, limit]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  /* ──────────────── Openers ──────────────── */
  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setFormFieldError({ email: '', password: '', name: '', phone: '', role: '' });
    setModalOpen(true);
  };

  const openEdit = (row: UserRow) => {
    setEditing(row);
    setForm({
      email: row.email,
      password: '',
      name: row.name ?? '',
      phone: row.phone ?? '',
      role: row.role,
    });
    setFormError('');
    setFormFieldError({ email: '', password: '', name: '', phone: '', role: '' });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
    setEditing(null);
  };

  /* ──────────────── Validators ──────────────── */
  const validateForm = (): boolean => {
    const errs: Record<keyof FormState, string> = { email: '', password: '', name: '', phone: '', role: '' };
    let ok = true;
    if (!form.email.trim()) { errs.email = 'Email majburiy'; ok = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { errs.email = 'Email formati noto‘g‘ri'; ok = false; }

    if (!editing) {
      if (!form.password) { errs.password = 'Parol majburiy'; ok = false; }
      else if (form.password.length < 6) { errs.password = 'Parol kamida 6 belgi'; ok = false; }
    } else if (form.password && form.password.length < 6) {
      errs.password = 'Parol kamida 6 belgi'; ok = false;
    }

    if (form.phone.trim()) {
      const digits = normalizePhoneForSend(form.phone);
      if (digits.length < 9) { errs.phone = 'Telefon raqami to‘liq emas'; ok = false; }
    }
    setFormFieldError(errs);
    return ok;
  };

  /* ──────────────── Submit ──────────────── */
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canWrite) {
      pushToast({ type: 'error', message: "Faqat admin foydalanuvchini yaratishi va tahrirlashi mumkin" });
      return;
    }
    if (!validateForm()) return;

    setSubmitting(true);
    setFormError('');
    try {
      const payloadObj: Record<string, unknown> = {
        email: form.email.trim().toLowerCase(),
        name: form.name.trim() || null,
        phone: normalizePhoneForSend(form.phone) || null,
        role: form.role,
      };
      if (form.password) payloadObj.password = form.password;

      if (editing) {
        await api.put(`/api/users/${editing.id}`, payloadObj);
        pushToast({ type: 'success', message: "Ma'lumotlar yangilandi" });
      } else {
        await api.post('/api/users', payloadObj);
        pushToast({ type: 'success', message: "Yangi xodim qo‘shildi" });
      }
      setModalOpen(false);
      void loadUsers();
    } catch (err: any) {
      const msg = extractErrorMessage(err);
      setFormError(msg);
      if (err?.response?.data?.field === 'email') setFormFieldError((f) => ({ ...f, email: msg }));
      if (err?.response?.data?.field === 'phone') setFormFieldError((f) => ({ ...f, phone: msg }));
      pushToast({ type: 'error', message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  /* ──────────────── Delete ──────────────── */
  const onDelete = async (row: UserRow) => {
    if (!canWrite) {
      pushToast({ type: 'error', message: "Faqat admin o‘chira oladi" });
      return;
    }
    if (currentUser?.id === row.id) {
      pushToast({ type: 'error', message: "O‘zingizni o‘chira olmaysiz. Boshqa admin dan so‘rang." });
      return;
    }
    const confirmMsg = `Rostdan ham "${row.name ?? row.email}"ni o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi.`;
    if (!window.confirm(confirmMsg)) return;
    try {
      await api.delete(`/api/users/${row.id}`);
      pushToast({ type: 'success', message: "Foydalanuvchi o‘chirildi" });
      void loadUsers();
    } catch (err) {
      const msg = extractErrorMessage(err);
      pushToast({ type: 'error', message: msg });
    }
  };

  /* ──────────────── Derived ──────────────── */
  const rows = payload.data;
  const total = payload.meta.total;
  const hasData = rows.length > 0;
  const hasFilters = Boolean(search.trim() || roleFilter);

  const searchDebounce = useMemo(() => search.trim(), [search]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(() => setPage(1), 250); return () => clearTimeout(t); }, [searchDebounce, roleFilter]);

  /* ──────────────── Render ──────────────── */
  return (
    <div className="users-page">
      {/* ── Toasts ── */}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>{t.message}</div>
        ))}
      </div>

      {/* ── Heading ── */}
      <div className="page-heading">
        <div>
          <h1>Foydalanuvchilar / Xodimlar</h1>
          <p className="subtitle">
            Tizim xodimlari: jami <strong className="accent">{total}</strong> nafar
            {hasFilters && ' (filtrlangan)'}
          </p>
        </div>
        {canWrite ? (
          <button className="primary-button" onClick={openCreate} disabled={loading && initialLoad}>
            <span className="btn-icon">+</span> Yangi xodim
          </button>
        ) : (
          <button className="primary-button" disabled title="Faqat admin uchun">
            Huquqlar yetarli emas
          </button>
        )}
      </div>

      {/* ── Toolbar ── */}
      <div className="toolbar-row">
        <div className="search-wrapper">
          <input
            type="search"
            placeholder="Ism, telefon yoki email bo‘yicha qidirish…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Qidiruv"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          aria-label="Lavozim bo‘yicha filter"
        >
          {ROLE_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* ── Page error (API failure) ── */}
      {pageError && (
        <div className="alert alert-error" role="alert">
          <strong>Xato yuz berdi: </strong>{pageError}
          <button className="link-button ml-2" onClick={() => void loadUsers()}>Qayta yuklash</button>
        </div>
      )}

      {/* ── Loading ── */}
      {initialLoad && loading && (
        <div className="table-wrap">
          <div className="table-loading">
            <div className="spinner" aria-hidden />
            <p>Yuklanmoqda…</p>
          </div>
        </div>
      )}

      {/* ── Table / Empty ── */}
      {!initialLoad && (
        hasData ? (
          <div className="table-wrap users-table-wrap">
            <table className="users-table" role="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Ism</th>
                  <th>Telefon</th>
                  <th>Email</th>
                  <th>Lavozim</th>
                  <th>Yaratilgan</th>
                  <th className="col-actions">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const isSelf = currentUser?.id === u.id;
                  return (
                    <tr key={u.id} className={`user-row ${isSelf ? 'row-self' : ''}`}>
                      <td data-label="ID" className="mono">#{u.id}</td>
                      <td data-label="Ism">
                        <div className="cell-primary">{u.name || <span className="muted">Ism kiritilmagan</span>}</div>
                        {isSelf && <span className="pill pill-self">Siz</span>}
                      </td>
                      <td data-label="Telefon" className="cell-phone"><strong>{formatPhone(u.phone)}</strong></td>
                      <td data-label="Email"><span className="cell-email">{u.email}</span></td>
                      <td data-label="Lavozim">
                        <span className={`role-badge role-${u.role.toLowerCase()}`}>{ROLE_LABELS[u.role]}</span>
                      </td>
                      <td data-label="Yaratilgan" className="muted">{formatDate(u.createdAt)}</td>
                      <td data-label="Amallar" className="actions-cell">
                        <div className="actions-group">
                          <button
                            className="small-button"
                            onClick={() => openEdit(u)}
                            disabled={!canWrite || loading}
                            title={canWrite ? "Tahrirlash" : "Faqat admin tahrirlashi mumkin"}
                          >
                            Tahrirlash
                          </button>
                          <button
                            className="outline-button small danger"
                            onClick={() => onDelete(u)}
                            disabled={!canWrite || isSelf || loading}
                            title={
                              isSelf ? "O'zingizni o'chira olmaysiz" :
                              canWrite ? "O'chirish" : "Faqat admin o'chirishi mumkin"
                            }
                          >
                            O‘chirish
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>
              {loading
                ? 'Yuklanmoqda…'
                : hasFilters
                  ? "Hech qanday natija topilmadi"
                  : "Hozircha xodimlar yo‘q"}
            </h3>
            <p>
              {hasFilters
                ? "Qidiruv yoki filter parametrlarini o‘zgartiring va qayta urinib ko‘ring."
                : canWrite
                  ? '"Yangi xodim" tugmasini bosib, birinchi xodimni qo‘shing.'
                  : "Tizimda xodimlar hali yaratilmagan."}
            </p>
            {!hasFilters && canWrite && (
              <button className="primary-button mt-2" onClick={openCreate}>
                <span className="btn-icon">+</span> Birinchi xodimni qo‘shish
              </button>
            )}
          </div>
        )
      )}

      {/* ── Pagination ── */}
      {hasData && (
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      )}

      {/* ── Form Modal ── */}
      <Modal
        title={editing ? 'Xodimni tahrirlash' : 'Yangi xodim qo‘shish'}
        open={modalOpen}
        onClose={closeModal}
      >
        <form className="entity-form" onSubmit={onSubmit} noValidate>
          <div className="form-grid">
            <FieldErrorWrapper label="Email" required error={formFieldError.email}>
              <input
                type="email"
                placeholder="ism@kompaniya.uz"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                disabled={submitting}
                autoComplete="email"
              />
            </FieldErrorWrapper>

            <FieldErrorWrapper
              label={`Parol ${editing ? '(o‘zgartirmaslik uchun bo‘sh qoldiring)' : '(kamida 6 belgi)'}`}
              required={!editing}
              error={formFieldError.password}
            >
              <input
                type="password"
                placeholder={editing ? "••••••••" : "Qayta ishlatilmasin, kuchli parol kiriting"}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                disabled={submitting}
                autoComplete={editing ? 'new-password' : 'new-password'}
              />
            </FieldErrorWrapper>

            <FieldErrorWrapper label="Ism, familiya" error={formFieldError.name}>
              <input
                type="text"
                placeholder="Alisher Usmanov"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                disabled={submitting}
              />
            </FieldErrorWrapper>

            <FieldErrorWrapper label="Telefon raqami" error={formFieldError.phone}>
              <input
                type="tel"
                placeholder="+998 90 123 45 67"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                disabled={submitting}
              />
            </FieldErrorWrapper>

            <FieldErrorWrapper label="Lavozim / Roli" required error={formFieldError.role}>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRow['role'] }))}
                disabled={submitting}
              >
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </FieldErrorWrapper>
          </div>

          {formError && <div className="alert alert-error mt-1">{formError}</div>}

          <div className="form-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={!canWrite || submitting}
            >
              {submitting && <span className="spinner-inline" aria-hidden />}
              {editing ? "O‘zgarishlarni saqlash" : "Yaratish"}
            </button>
            <button
              type="button"
              className="outline-button"
              onClick={closeModal}
              disabled={submitting}
            >
              Bekor qilish
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* ──────────────────── Small helper component ──────────────────── */
interface FEWProps {
  label: React.ReactNode;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}
function FieldErrorWrapper({ label, required, error, children }: FEWProps) {
  return (
    <label className={`field-wrapper ${error ? 'has-error' : ''}`}>
      <div className="field-label">
        <span>{label}</span>
        {required && <span className="req">*</span>}
      </div>
      {children}
      {error && <div className="field-error">{error}</div>}
    </label>
  );
}

export default UsersPage;

import { FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { unwrapListResponse } from '../utils/api';

interface Teacher {
  id: number;
  name: string;
  phone?: string;
  bio?: string;
  user: { email: string };
  groups: Array<{ name: string }>;
}

export function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    bio: ''
  });

  useEffect(() => {
    loadTeachers();
  }, [search, page]);

  async function loadTeachers() {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get('/api/teachers', { params: { q: search, page, limit: meta.limit } });
      const payload = unwrapListResponse<Teacher[]>(response);
      setTeachers(payload.data);
      setMeta(payload.meta);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load teachers.');
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditing(null);
    setForm({ email: '', password: '', name: '', phone: '', bio: '' });
    setModalOpen(true);
  }

  function openEditModal(teacher: Teacher) {
    setEditing(teacher);
    setForm({ email: teacher.user.email, password: '', name: teacher.name, phone: teacher.phone ?? '', bio: teacher.bio ?? '' });
    setModalOpen(true);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (editing) {
        await axios.put(`/api/teachers/${editing.id}`, {
          email: form.email,
          password: form.password || undefined,
          name: form.name,
          phone: form.phone,
          bio: form.bio
        });
      } else {
        await axios.post('/api/teachers', form);
      }
      setModalOpen(false);
      loadTeachers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save teacher.');
    } finally {
      setLoading(false);
    }
  }

  async function deleteTeacher(id: number) {
    if (!window.confirm('Remove this teacher and their account?')) return;
    setLoading(true);
    setError('');
    try {
      await axios.delete(`/api/teachers/${id}`);
      loadTeachers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete teacher.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-heading">
        <div>
          <h1>Teachers</h1>
          <p className="subtitle">Manage instructor profiles, contact info, and class assignments.</p>
        </div>
        <button className="primary-button" onClick={openCreateModal}>New Teacher</button>
      </div>

      <div className="toolbar-row">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search teachers" />
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Groups</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="loading-row">Loading teachers...</td></tr>
            ) : teachers.length ? (
              teachers.map(teacher => (
                <tr key={teacher.id}>
                  <td>{teacher.name}</td>
                  <td>{teacher.user.email}</td>
                  <td>{teacher.phone || '-'}</td>
                  <td>{teacher.groups.map(g => g.name).join(', ') || '-'}</td>
                  <td>
                    <button className="small-button" onClick={() => openEditModal(teacher)}>Edit</button>
                    <button className="outline-button small" onClick={() => deleteTeacher(teacher.id)}>Delete</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={5} className="empty-row">No teachers found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={meta.page} limit={meta.limit} total={meta.total} onPageChange={setPage} />

      <Modal title={editing ? 'Edit Teacher' : 'Create Teacher'} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="entity-form" onSubmit={submitForm}>
          <div className="form-grid">
            <label>
              Email
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            </label>
            <label>
              Password{editing ? ' (leave blank to keep)' : ''}
              <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} {...(editing ? {} : { required: true })} />
            </label>
            <label>
              Name
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label>
              Phone
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </label>
            <label className="full-width">
              Bio
              <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows={4} />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="primary-button">Save teacher</button>
            <button type="button" className="outline-button" onClick={() => setModalOpen(false)}>Cancel</button>
          </div>
          {error && <div className="alert">{error}</div>}
        </form>
      </Modal>
    </div>
  );
}

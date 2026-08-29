import { FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { unwrapListResponse } from '../utils/api';

interface Classroom {
  id: number;
  name: string;
  capacity: number;
  location?: string;
  groups: Array<{ id: number }>;
}

export function ClassroomsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Classroom | null>(null);
  const [form, setForm] = useState({ name: '', capacity: 0, location: '' });

  useEffect(() => {
    loadClassrooms();
  }, [search, page]);

  async function loadClassrooms() {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get('/api/classrooms', { params: { q: search, page, limit: meta.limit } });
      const payload = unwrapListResponse<Classroom[]>(response);
      setClassrooms(payload.data);
      setMeta(payload.meta);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load classrooms.');
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditing(null);
    setForm({ name: '', capacity: 0, location: '' });
    setModalOpen(true);
  }

  function openEditModal(classroom: Classroom) {
    setEditing(classroom);
    setForm({ name: classroom.name, capacity: classroom.capacity, location: classroom.location ?? '' });
    setModalOpen(true);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (editing) {
        await axios.put(`/api/classrooms/${editing.id}`, form);
      } else {
        await axios.post('/api/classrooms', form);
      }
      setModalOpen(false);
      loadClassrooms();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save classroom.');
    } finally {
      setLoading(false);
    }
  }

  async function deleteClassroom(id: number) {
    if (!window.confirm('Delete this classroom?')) return;
    setLoading(true);
    setError('');
    try {
      await axios.delete(`/api/classrooms/${id}`);
      loadClassrooms();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete classroom.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-heading">
        <div>
          <h1>Classrooms</h1>
          <p className="subtitle">Configure room capacity, location, and group assignments.</p>
        </div>
        <button className="primary-button" onClick={openCreateModal}>New Classroom</button>
      </div>

      <div className="toolbar-row">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search classrooms" />
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Capacity</th>
              <th>Location</th>
              <th>Groups</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="loading-row">Loading classrooms...</td></tr>
            ) : classrooms.length ? (
              classrooms.map(room => (
                <tr key={room.id}>
                  <td>{room.name}</td>
                  <td>{room.capacity}</td>
                  <td>{room.location || '-'}</td>
                  <td>{room.groups.length}</td>
                  <td>
                    <button className="small-button" onClick={() => openEditModal(room)}>Edit</button>
                    <button className="outline-button small" onClick={() => deleteClassroom(room.id)}>Delete</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={5} className="empty-row">No classrooms found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={meta.page} limit={meta.limit} total={meta.total} onPageChange={setPage} />

      <Modal title={editing ? 'Edit Classroom' : 'Create Classroom'} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="entity-form" onSubmit={submitForm}>
          <div className="form-grid">
            <label>
              Name
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label>
              Capacity
              <input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: Number(e.target.value) })} min={1} required />
            </label>
            <label className="full-width">
              Location
              <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="primary-button">Save classroom</button>
            <button type="button" className="outline-button" onClick={() => setModalOpen(false)}>Cancel</button>
          </div>
          {error && <div className="alert">{error}</div>}
        </form>
      </Modal>
    </div>
  );
}

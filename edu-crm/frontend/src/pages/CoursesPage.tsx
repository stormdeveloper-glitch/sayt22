import { FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { unwrapListResponse } from '../utils/api';

interface Course {
  id: number;
  code: string;
  title: string;
  durationMonths: number;
  description?: string;
  groups: Array<{ id: number }>;
}

export function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [form, setForm] = useState({ code: '', title: '', durationMonths: 3, description: '' });

  useEffect(() => {
    loadCourses();
  }, [search, page]);

  async function loadCourses() {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get('/api/courses', { params: { q: search, page, limit: meta.limit } });
      const payload = unwrapListResponse<Course[]>(response);
      setCourses(payload.data);
      setMeta(payload.meta);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load courses.');
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditing(null);
    setForm({ code: '', title: '', durationMonths: 3, description: '' });
    setModalOpen(true);
  }

  function openEditModal(course: Course) {
    setEditing(course);
    setForm({ code: course.code, title: course.title, durationMonths: course.durationMonths, description: course.description ?? '' });
    setModalOpen(true);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (editing) {
        await axios.put(`/api/courses/${editing.id}`, form);
      } else {
        await axios.post('/api/courses', form);
      }
      setModalOpen(false);
      loadCourses();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save course.');
    } finally {
      setLoading(false);
    }
  }

  async function deleteCourse(id: number) {
    if (!window.confirm('Delete this course and all its groups?')) return;
    setLoading(true);
    setError('');
    try {
      await axios.delete(`/api/courses/${id}`);
      loadCourses();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete course.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-heading">
        <div>
          <h1>Courses</h1>
          <p className="subtitle">Maintain the curriculum catalog and duration details.</p>
        </div>
        <button className="primary-button" onClick={openCreateModal}>New Course</button>
      </div>

      <div className="toolbar-row">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search courses" />
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Title</th>
              <th>Duration</th>
              <th>Groups</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="loading-row">Loading courses...</td></tr>
            ) : courses.length ? (
              courses.map(course => (
                <tr key={course.id}>
                  <td>{course.code}</td>
                  <td>{course.title}</td>
                  <td>{course.durationMonths} months</td>
                  <td>{course.groups.length}</td>
                  <td>
                    <button className="small-button" onClick={() => openEditModal(course)}>Edit</button>
                    <button className="outline-button small" onClick={() => deleteCourse(course.id)}>Delete</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={5} className="empty-row">No courses found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={meta.page} limit={meta.limit} total={meta.total} onPageChange={setPage} />

      <Modal title={editing ? 'Edit Course' : 'Create Course'} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="entity-form" onSubmit={submitForm}>
          <div className="form-grid">
            <label>
              Code
              <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} required />
            </label>
            <label>
              Title
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
            </label>
            <label>
              Duration (months)
              <input type="number" value={form.durationMonths} onChange={e => setForm({ ...form, durationMonths: Number(e.target.value) })} min={1} required />
            </label>
            <label className="full-width">
              Description
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="primary-button">Save course</button>
            <button type="button" className="outline-button" onClick={() => setModalOpen(false)}>Cancel</button>
          </div>
          {error && <div className="alert">{error}</div>}
        </form>
      </Modal>
    </div>
  );
}

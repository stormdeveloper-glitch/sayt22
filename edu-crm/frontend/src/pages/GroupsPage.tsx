import { FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { unwrapListResponse } from '../utils/api';

interface Group {
  id: number;
  name: string;
  status: string;
  capacity: number;
  monthlyFee: number;
  availableSeats: number;
  course: { id: number; title: string };
  teacher: { id: number; name: string };
  classroom: { id: number; name: string };
  lessons: Array<{ id: number; weekday: string; startTime: string; endTime: string }>;
}

interface Course {
  id: number;
  title: string;
}

interface Teacher {
  id: number;
  name: string;
}

interface Classroom {
  id: number;
  name: string;
}

export function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [form, setForm] = useState({
    name: '',
    courseId: 0,
    teacherId: 0,
    classroomId: 0,
    startDate: '',
    endDate: '',
    capacity: 0,
    monthlyFee: 0,
    status: 'ACTIVE',
    lessonsText: 'MONDAY 09:00 11:00\nWEDNESDAY 09:00 11:00'
  });

  useEffect(() => {
    loadGroups();
    loadLookups();
  }, [search, statusFilter, page]);

  async function loadGroups() {
    setLoading(true);
    setError('');

    try {
      const response = await axios.get('/api/groups', { params: { q: search, status: statusFilter, page, limit: meta.limit } });
      const payload = unwrapListResponse<Group[]>(response);
      setGroups(payload.data);
      setMeta(payload.meta);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load groups.');
    } finally {
      setLoading(false);
    }
  }

  async function loadLookups() {
    try {
      const [coursesResponse, teachersResponse, classroomsResponse] = await Promise.all([
        axios.get('/api/courses', { params: { limit: 100 } }),
        axios.get('/api/teachers', { params: { limit: 100 } }),
        axios.get('/api/classrooms', { params: { limit: 100 } })
      ]);
      setCourses(unwrapListResponse<Course[]>(coursesResponse).data);
      setTeachers(unwrapListResponse<Teacher[]>(teachersResponse).data);
      setClassrooms(unwrapListResponse<Classroom[]>(classroomsResponse).data);
    } catch {
      // ignore minimal lookup errors
    }
  }

  function openCreateModal() {
    setEditing(null);
    setForm({
      name: '',
      courseId: 0,
      teacherId: 0,
      classroomId: 0,
      startDate: '',
      endDate: '',
      capacity: 0,
      monthlyFee: 0,
      status: 'ACTIVE',
      lessonsText: 'MONDAY 09:00 11:00\nWEDNESDAY 09:00 11:00'
    });
    setModalOpen(true);
  }

  function openEditModal(group: Group) {
    setEditing(group);
    setForm({
      name: group.name,
      courseId: group.course.id,
      teacherId: group.teacher.id,
      classroomId: group.classroom.id,
      startDate: '',
      endDate: '',
      capacity: group.capacity,
      monthlyFee: group.monthlyFee,
      status: group.status,
      lessonsText: group.lessons.map(l => `${l.weekday} ${l.startTime} ${l.endTime}`).join('\n')
    });
    setModalOpen(true);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    const lessons = form.lessonsText.split('\n').map(line => {
      const parts = line.trim().split(/\s+/);
      return { weekday: parts[0], startTime: parts[1], endTime: parts[2] };
    }).filter(item => item.weekday && item.startTime && item.endTime);

    const payload = {
      name: form.name,
      courseId: Number(form.courseId),
      teacherId: Number(form.teacherId),
      classroomId: Number(form.classroomId),
      startDate: form.startDate,
      endDate: form.endDate,
      capacity: Number(form.capacity),
      monthlyFee: Number(form.monthlyFee),
      status: form.status,
      lessons
    };

    try {
      if (editing) {
        await axios.put(`/api/groups/${editing.id}`, payload);
      } else {
        await axios.post('/api/groups', payload);
      }
      setModalOpen(false);
      loadGroups();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save group.');
    } finally {
      setLoading(false);
    }
  }

  async function deleteGroup(id: number) {
    if (!window.confirm('Delete this group permanently?')) return;
    setLoading(true);
    setError('');
    try {
      await axios.delete(`/api/groups/${id}`);
      loadGroups();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete group.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-heading">
        <div>
          <h1>Groups</h1>
          <p className="subtitle">Track classrooms, teachers, schedules, and student capacity.</p>
        </div>
        <button className="primary-button" onClick={openCreateModal}>New Group</button>
      </div>

      <div className="toolbar-row">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search groups, courses, teachers or rooms" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="FULL">Full</option>
          <option value="FINISHED">Finished</option>
        </select>
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Course</th>
              <th>Teacher</th>
              <th>Classroom</th>
              <th>Capacity</th>
              <th>Seats</th>
              <th>Fee</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="loading-row">Loading groups...</td></tr>
            ) : groups.length ? (
              groups.map(group => (
                <tr key={group.id}>
                  <td>{group.name}</td>
                  <td>{group.course.title}</td>
                  <td>{group.teacher.name}</td>
                  <td>{group.classroom.name}</td>
                  <td>{group.capacity}</td>
                  <td>{group.availableSeats}</td>
                  <td>{group.monthlyFee}</td>
                  <td>{group.status}</td>
                  <td>
                    <button className="small-button" onClick={() => openEditModal(group)}>Edit</button>
                    <button className="outline-button small" onClick={() => deleteGroup(group.id)}>Delete</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={9} className="empty-row">No groups found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={meta.page} limit={meta.limit} total={meta.total} onPageChange={setPage} />

      <Modal title={editing ? 'Edit Group' : 'Create Group'} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="entity-form" onSubmit={submitForm}>
          <div className="form-grid">
            <label>
              Name
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label>
              Course
              <select value={form.courseId} onChange={e => setForm({ ...form, courseId: Number(e.target.value) })} required>
                <option value={0}>Select course</option>
                {courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
              </select>
            </label>
            <label>
              Teacher
              <select value={form.teacherId} onChange={e => setForm({ ...form, teacherId: Number(e.target.value) })} required>
                <option value={0}>Select teacher</option>
                {teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
              </select>
            </label>
            <label>
              Classroom
              <select value={form.classroomId} onChange={e => setForm({ ...form, classroomId: Number(e.target.value) })} required>
                <option value={0}>Select classroom</option>
                {classrooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}
              </select>
            </label>
            <label>
              Start date
              <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} required />
            </label>
            <label>
              End date
              <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
            </label>
            <label>
              Capacity
              <input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: Number(e.target.value) })} min={1} required />
            </label>
            <label>
              Monthly fee
              <input type="number" value={form.monthlyFee} onChange={e => setForm({ ...form, monthlyFee: Number(e.target.value) })} min={0} required />
            </label>
            <label>
              Status
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="ACTIVE">Active</option>
                <option value="FULL">Full</option>
                <option value="FINISHED">Finished</option>
              </select>
            </label>
            <label className="full-width">
              Schedule lines
              <textarea value={form.lessonsText} onChange={e => setForm({ ...form, lessonsText: e.target.value })} rows={5} />
              <small>Use one lesson per line like: MONDAY 09:00 11:00</small>
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="primary-button">Save group</button>
            <button type="button" className="outline-button" onClick={() => setModalOpen(false)}>Cancel</button>
          </div>
          {error && <div className="alert">{error}</div>}
        </form>
      </Modal>
    </div>
  );
}

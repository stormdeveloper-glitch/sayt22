import { FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { unwrapListResponse } from '../utils/api';

interface AttendanceRecord {
  id: number;
  date: string;
  status: string;
  note?: string;
  student: { id: number; studentId: string; firstName: string; lastName: string };
  group: { id: number; name: string };
}

interface Student {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
}

interface Group {
  id: number;
  name: string;
}

export function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ studentId: 0, groupId: 0, date: '', status: 'PRESENT', note: '' });

  useEffect(() => {
    loadAttendance();
    loadLookups();
  }, [search, statusFilter, page]);

  async function loadAttendance() {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get('/api/attendance', {
        params: { q: search, status: statusFilter, page, limit: meta.limit }
      });
      const payload = unwrapListResponse<AttendanceRecord[]>(response);
      setRecords(payload.data);
      setMeta(payload.meta);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load attendance records.');
    } finally {
      setLoading(false);
    }
  }

  async function loadLookups() {
    try {
      const [studentsResponse, groupsResponse] = await Promise.all([
        axios.get('/api/students', { params: { limit: 200 } }),
        axios.get('/api/groups', { params: { limit: 200 } })
      ]);
      setStudents(unwrapListResponse<Student[]>(studentsResponse).data);
      setGroups(unwrapListResponse<Group[]>(groupsResponse).data);
    } catch {
      // ignore lookup errors
    }
  }

  function openCreateModal() {
    setForm({ studentId: 0, groupId: 0, date: '', status: 'PRESENT', note: '' });
    setModalOpen(true);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await axios.post('/api/attendance', {
        studentId: form.studentId,
        groupId: form.groupId,
        date: form.date || new Date().toISOString(),
        status: form.status,
        note: form.note
      });
      setModalOpen(false);
      loadAttendance();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save attendance record.');
    } finally {
      setLoading(false);
    }
  }

  async function deleteRecord(id: number) {
    if (!window.confirm('Delete this attendance record?')) return;
    setLoading(true);
    setError('');
    try {
      await axios.delete(`/api/attendance/${id}`);
      loadAttendance();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete attendance record.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-heading">
        <div>
          <h1>Attendance</h1>
          <p className="subtitle">Track student attendance by group and status.</p>
        </div>
        <button className="primary-button" onClick={openCreateModal}>New Record</button>
      </div>

      <div className="toolbar-row">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students, groups or status" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="PRESENT">Present</option>
          <option value="ABSENT">Absent</option>
          <option value="LATE">Late</option>
          <option value="EXCUSED">Excused</option>
        </select>
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Student</th>
              <th>Group</th>
              <th>Status</th>
              <th>Note</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="loading-row">Loading attendance records...</td></tr>
            ) : records.length ? (
              records.map(record => (
                <tr key={record.id}>
                  <td>{new Date(record.date).toLocaleDateString()}</td>
                  <td>{record.student.studentId} — {record.student.firstName} {record.student.lastName}</td>
                  <td>{record.group.name}</td>
                  <td>{record.status}</td>
                  <td>{record.note || '-'}</td>
                  <td>
                    <button className="outline-button small" onClick={() => deleteRecord(record.id)}>Delete</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={6} className="empty-row">No attendance records found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={meta.page} limit={meta.limit} total={meta.total} onPageChange={setPage} />

      <Modal title="Add Attendance" open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="entity-form" onSubmit={submitForm}>
          <div className="form-grid">
            <label>
              Student
              <select value={form.studentId} onChange={e => setForm({ ...form, studentId: Number(e.target.value) })} required>
                <option value={0}>Select student</option>
                {students.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.studentId} — {student.firstName} {student.lastName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Group
              <select value={form.groupId} onChange={e => setForm({ ...form, groupId: Number(e.target.value) })} required>
                <option value={0}>Select group</option>
                {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </label>
            <label>
              Date
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </label>
            <label>
              Status
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="PRESENT">Present</option>
                <option value="ABSENT">Absent</option>
                <option value="LATE">Late</option>
                <option value="EXCUSED">Excused</option>
              </select>
            </label>
            <label className="full-width">
              Note
              <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={3} />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="primary-button">Save record</button>
            <button type="button" className="outline-button" onClick={() => setModalOpen(false)}>Cancel</button>
          </div>
          {error && <div className="alert">{error}</div>}
        </form>
      </Modal>
    </div>
  );
}

import { FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { unwrapListResponse } from '../utils/api';

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

interface Payment {
  id: number;
  amount: string;
  paidAt: string;
  method: string;
  reference?: string;
  student: Student;
  group: Group;
}

interface Receipt extends Payment {
  note?: string;
}

export function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [form, setForm] = useState({ studentId: 0, groupId: 0, amount: 0, method: 'CASH', paidAt: '', reference: '', note: '' });

  useEffect(() => {
    loadPayments();
    loadLookups();
  }, [search, page]);

  async function loadPayments() {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get('/api/payments', { params: { q: search, page, limit: meta.limit } });
      const payload = unwrapListResponse<Payment[]>(response);
      setPayments(payload.data);
      setMeta(payload.meta);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load payments.');
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
      // optional
    }
  }

  function openCreateModal() {
    setForm({ studentId: 0, groupId: 0, amount: 0, method: 'CASH', paidAt: '', reference: '', note: '' });
    setModalOpen(true);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await axios.post('/api/payments', {
        studentId: form.studentId,
        groupId: form.groupId,
        amount: form.amount,
        method: form.method,
        paidAt: form.paidAt || new Date().toISOString(),
        reference: form.reference,
        note: form.note
      });
      setModalOpen(false);
      loadPayments();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save payment.');
    } finally {
      setLoading(false);
    }
  }

  async function viewReceipt(id: number) {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`/api/payments/receipt/${id}`);
      setReceipt(response.data);
      setReceiptOpen(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Receipt not found.');
    } finally {
      setLoading(false);
    }
  }

  async function deletePayment(id: number) {
    if (!window.confirm('Delete this payment record?')) return;
    setLoading(true);
    setError('');
    try {
      await axios.delete(`/api/payments/${id}`);
      loadPayments();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete payment.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-heading">
        <div>
          <h1>Payments</h1>
          <p className="subtitle">Record receipts and monitor cashflow with balance checks.</p>
        </div>
        <button className="primary-button" onClick={openCreateModal}>Record Payment</button>
      </div>

      <div className="toolbar-row">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search payments" />
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Student</th>
              <th>Group</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Reference</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="loading-row">Loading payments...</td></tr>
            ) : payments.length ? (
              payments.map(payment => (
                <tr key={payment.id}>
                  <td>{new Date(payment.paidAt).toLocaleDateString()}</td>
                  <td>{payment.student.firstName} {payment.student.lastName}</td>
                  <td>{payment.group.name}</td>
                  <td>{payment.amount}</td>
                  <td>{payment.method}</td>
                  <td>{payment.reference || '-'}</td>
                  <td>
                    <button className="small-button" onClick={() => viewReceipt(payment.id)}>Receipt</button>
                    <button className="outline-button small" onClick={() => deletePayment(payment.id)}>Delete</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={7} className="empty-row">No payment records found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={meta.page} limit={meta.limit} total={meta.total} onPageChange={setPage} />

      <Modal title="Record Payment" open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="entity-form" onSubmit={submitForm}>
          <div className="form-grid">
            <label>
              Student
              <select value={form.studentId} onChange={e => setForm({ ...form, studentId: Number(e.target.value) })} required>
                <option value={0}>Select a student</option>
                {students.map(student => (
                  <option key={student.id} value={student.id}>{student.studentId} — {student.firstName} {student.lastName}</option>
                ))}
              </select>
            </label>
            <label>
              Group
              <select value={form.groupId} onChange={e => setForm({ ...form, groupId: Number(e.target.value) })} required>
                <option value={0}>Select a group</option>
                {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </label>
            <label>
              Amount
              <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} min={0} step="0.01" required />
            </label>
            <label>
              Method
              <select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="TRANSFER">Transfer</option>
              </select>
            </label>
            <label>
              Date
              <input type="date" value={form.paidAt} onChange={e => setForm({ ...form, paidAt: e.target.value })} />
            </label>
            <label>
              Reference
              <input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} />
            </label>
            <label className="full-width">
              Note
              <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={3} />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="primary-button">Save payment</button>
            <button type="button" className="outline-button" onClick={() => setModalOpen(false)}>Cancel</button>
          </div>
          {error && <div className="alert">{error}</div>}
        </form>
      </Modal>

      <Modal title="Payment Receipt" open={receiptOpen} onClose={() => setReceiptOpen(false)}>
        {receipt ? (
          <div className="receipt-card">
            <p><strong>Student:</strong> {receipt.student.firstName} {receipt.student.lastName}</p>
            <p><strong>Group:</strong> {receipt.group.name}</p>
            <p><strong>Amount:</strong> {receipt.amount}</p>
            <p><strong>Method:</strong> {receipt.method}</p>
            <p><strong>Date:</strong> {new Date(receipt.paidAt).toLocaleDateString()}</p>
            <p><strong>Reference:</strong> {receipt.reference || '-'}</p>
            <p><strong>Note:</strong> {receipt.note || '-'}</p>
          </div>
        ) : (
          <p>Loading receipt...</p>
        )}
      </Modal>
    </div>
  );
}

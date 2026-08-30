import { useEffect, useState } from 'react';
import axios from 'axios';

interface TopGroup {
  id: number;
  name: string;
  enrolled: number;
  capacity: number;
}

interface UpcomingLesson {
  id: number;
  weekday: string;
  time: string;
  group: { id: number; name: string };
}

interface DashboardStats {
  totalStudents: number;
  activeStudents: number;
  totalGroups: number;
  teachers: number;
  classrooms: number;
  todaysLessons: number;
  todaysAttendance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  overdueStudents: number;
  topGroups: TopGroup[];
  upcomingLessons: UpcomingLesson[];
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    axios.get('/api/dashboard').then(response => setStats(response.data));
  }, []);

  return (
    <div>
      <div className="page-heading">
        <div>
          <h1>Dashboard</h1>
          <p className="subtitle">Quick overview of student, group, attendance, and finance health.</p>
        </div>
      </div>

      {stats ? (
        <>
          <div className="grid cards">
            <div className="card">
              Total students
              <div className="metric">{stats.totalStudents}</div>
            </div>
            <div className="card">
              Active students
              <div className="metric">{stats.activeStudents}</div>
            </div>
            <div className="card">
              Total groups
              <div className="metric">{stats.totalGroups}</div>
            </div>
            <div className="card">
              Teachers
              <div className="metric">{stats.teachers}</div>
            </div>
            <div className="card">
              Classrooms
              <div className="metric">{stats.classrooms}</div>
            </div>
            <div className="card">
              Today's lessons
              <div className="metric">{stats.todaysLessons}</div>
            </div>
            <div className="card">
              Today's attendance
              <div className="metric">{stats.todaysAttendance}</div>
            </div>
            <div className="card">
              Monthly income
              <div className="metric">{stats.monthlyIncome}</div>
            </div>
            <div className="card">
              Overdue students
              <div className="metric">{stats.overdueStudents}</div>
            </div>
          </div>

          <div className="page-section">
            <div className="section-header">
              <h2>Top groups by enrollment</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Group</th>
                    <th>Enrolled</th>
                    <th>Capacity</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topGroups.map(group => (
                    <tr key={group.id}>
                      <td>{group.name}</td>
                      <td>{group.enrolled}</td>
                      <td>{group.capacity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="page-section">
            <div className="section-header">
              <h2>Upcoming lessons</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Time</th>
                    <th>Group</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.upcomingLessons.map(lesson => (
                    <tr key={lesson.id}>
                      <td>{lesson.weekday}</td>
                      <td>{lesson.time}</td>
                      <td>{lesson.group.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="loader">Loading dashboard...</div>
      )}
    </div>
  );
}

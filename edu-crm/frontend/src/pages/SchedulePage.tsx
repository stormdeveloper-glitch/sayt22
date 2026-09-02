import { useEffect, useState } from 'react';
import axios from 'axios';

interface Lesson {
  id: number;
  weekday: string;
  startTime: string;
  endTime: string;
  group: { id: number; name: string };
}

const weekdays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export function SchedulePage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    axios.get('/api/groups', { params: { limit: 100 } })
      .then(res => {
        const data = res.data.data || res.data;
        const schedule: Lesson[] = [];
        data.forEach((group: any) => {
          group.lessons.forEach((lesson: any) => {
            schedule.push({
              id: lesson.id,
              weekday: lesson.weekday,
              startTime: lesson.startTime,
              endTime: lesson.endTime,
              group: { id: group.id, name: group.name }
            });
          });
        });
        setLessons(schedule.sort((a, b) => weekdays.indexOf(a.weekday) - weekdays.indexOf(b.weekday) || a.startTime.localeCompare(b.startTime)));
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-heading">
        <h1>Schedule</h1>
      </div>
      {loading ? (
        <div className="loader">Loading schedule...</div>
      ) : (
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
              {weekdays.map(day => {
                const dayLessons = lessons.filter(item => item.weekday === day);
                return dayLessons.length ? dayLessons.map(lesson => (
                  <tr key={`${day}-${lesson.id}`}>
                    <td>{day}</td>
                    <td>{lesson.startTime} - {lesson.endTime}</td>
                    <td>{lesson.group.name}</td>
                  </tr>
                )) : (
                  <tr key={day}>
                    <td>{day}</td>
                    <td colSpan={2} className="empty-row">No scheduled lessons</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

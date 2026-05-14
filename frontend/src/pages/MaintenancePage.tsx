import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../lib/api';

interface ScheduleInfo {
  id: number;
  date: string;
  pool: { address: string };
  customer: { name: string };
}

export default function MaintenancePage() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();

  const [schedule, setSchedule] = useState<ScheduleInfo | null>(null);
  const [workDone, setWorkDone] = useState('');
  const [chemicalsUsed, setChemicalsUsed] = useState('');
  const [photoBefore, setPhotoBefore] = useState<File | null>(null);
  const [photoAfter, setPhotoAfter] = useState<File | null>(null);
  const [photoBeforePreview, setPhotoBeforePreview] = useState<string | null>(null);
  const [photoAfterPreview, setPhotoAfterPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/schedules/${scheduleId}`)
      .then((res) => setSchedule(res.data))
      .catch(() => setError('Failed to load schedule'));
  }, [scheduleId]);

  const handleFileSelect = (
    file: File | null,
    setFile: (f: File | null) => void,
    setPreview: (p: string | null) => void,
  ) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('File must be under 5 MB');
      return;
    }
    setFile(file);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setError('');
  };

  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('photo', file);
    const res = await api.post('/uploads', formData);
    return res.data.url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workDone.trim()) {
      setError('Please describe the work done');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Upload photos first (if any)
      let photoBeforeUrl: string | null = null;
      let photoAfterUrl: string | null = null;

      if (photoBefore) photoBeforeUrl = await uploadFile(photoBefore);
      if (photoAfter) photoAfterUrl = await uploadFile(photoAfter);

      // Create maintenance record (backend auto-marks schedule as COMPLETED)
      await api.post('/maintenance', {
        scheduleId: Number(scheduleId),
        workDone: workDone.trim(),
        chemicalsUsed: chemicalsUsed.trim() || null,
        photoBeforeUrl,
        photoAfterUrl,
      });

      navigate('/schedules');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to submit maintenance record'));
    } finally {
      setSubmitting(false);
    }
  };

  if (error && !schedule) {
    return <p className="text-red-500">{error}</p>;
  }

  if (!schedule) {
    return <p className="text-gray-500">Loading schedule...</p>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Log Maintenance</h2>

      {/* Schedule info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-gray-700">
        <p><strong>Pool:</strong> {schedule.pool.address}</p>
        <p><strong>Customer:</strong> {schedule.customer.name}</p>
        <p>
          <strong>Date:</strong>{' '}
          {new Date(schedule.date).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Work Done */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Work Done <span className="text-red-500">*</span>
          </label>
          <textarea
            value={workDone}
            onChange={(e) => setWorkDone(e.target.value)}
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Describe the cleaning work performed..."
          />
        </div>

        {/* Chemicals Used */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Chemicals Used <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={chemicalsUsed}
            onChange={(e) => setChemicalsUsed(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., Chlorine 2L, pH balancer 500ml"
          />
        </div>

        {/* Photo Before */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Photo Before <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={(e) =>
              handleFileSelect(e.target.files?.[0] || null, setPhotoBefore, setPhotoBeforePreview)
            }
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {photoBeforePreview && (
            <img src={photoBeforePreview} alt="Before preview" className="mt-2 rounded-lg max-h-48 object-cover" />
          )}
        </div>

        {/* Photo After */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Photo After <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={(e) =>
              handleFileSelect(e.target.files?.[0] || null, setPhotoAfter, setPhotoAfterPreview)
            }
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {photoAfterPreview && (
            <img src={photoAfterPreview} alt="After preview" className="mt-2 rounded-lg max-h-48 object-cover" />
          )}
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Complete & Submit'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/schedules')}
            className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

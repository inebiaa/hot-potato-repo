import { useCallback, useEffect, useState } from 'react';
import { Flag, Trash2 } from 'lucide-react';
import {
  adminRemoveReportedContent,
  fetchOpenContentReports,
  resolveContentReport,
  type ContentReportRow,
} from '../../lib/ugcSafety';
import { Button } from '../ui';

export default function ModerationTab() {
  const [reports, setReports] = useState<ContentReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchOpenContentReports();
      setReports(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (report: ContentReportRow, action: 'remove' | 'dismiss') => {
    setBusyId(report.id);
    setError('');
    try {
      if (action === 'remove') {
        const { error: removeError } = await adminRemoveReportedContent(report);
        if (removeError) throw new Error(removeError);
        const { error: resolveError } = await resolveContentReport(report.id, 'resolved');
        if (resolveError) throw new Error(resolveError);
      } else {
        const { error: resolveError } = await resolveContentReport(report.id, 'dismissed');
        if (resolveError) throw new Error(resolveError);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading reports…</p>;
  }

  if (reports.length === 0) {
    return <p className="text-sm text-muted-foreground">No open reports.</p>;
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {reports.map((report) => (
        <div
          key={report.id}
          className="rounded-lg border border-border bg-muted/30 p-3 text-sm"
        >
          <div className="mb-2 flex items-start gap-2">
            <Flag size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground capitalize">
                {report.reason.replace('_', ' ')}
              </p>
              <p className="text-muted-foreground">{report.target_label}</p>
              {report.reporter_username ? (
                <p className="text-xs text-muted-foreground">Reported by {report.reporter_username}</p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={busyId === report.id}
              onClick={() => void act(report, 'remove')}
            >
              <Trash2 size={14} />
              Remove content
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busyId === report.id}
              onClick={() => void act(report, 'dismiss')}
            >
              Dismiss
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

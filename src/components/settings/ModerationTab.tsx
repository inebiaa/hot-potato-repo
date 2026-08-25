import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Flag, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  adminRemoveReportedContent,
  fetchOpenContentReports,
  resolveContentReport,
  resolveReportTargetLinks,
  type ContentReportRow,
  type ReportTargetLink,
} from '../../lib/ugcSafety';
import { useT } from '../../hooks/useCopy';
import { Button } from '../ui';

function formatReportTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function ModerationTab() {
  const t = useT();
  const [reports, setReports] = useState<ContentReportRow[]>([]);
  const [targetLinks, setTargetLinks] = useState<Map<string, ReportTargetLink>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchOpenContentReports();
      setReports(rows);
      setTargetLinks(await resolveReportTargetLinks(rows));
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
    return <p className="text-sm text-muted-foreground">{t('safety.moderation.loading')}</p>;
  }

  if (reports.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('safety.moderation.empty')}</p>;
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {reports.map((report) => {
        const targetLink = targetLinks.get(report.id);
        return (
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
                <p className="text-xs text-muted-foreground">{formatReportTime(report.created_at)}</p>
                {report.reporter_username ? (
                  <p className="text-xs text-muted-foreground">
                    {t('safety.moderation.reportedBy').replace('{name}', report.reporter_username)}
                  </p>
                ) : null}
              </div>
              {targetLink ? (
                <Link
                  to={targetLink.href}
                  className="inline-flex shrink-0 items-center gap-1 text-xs text-foreground underline-offset-2 hover:underline"
                >
                  {t('safety.moderation.viewTarget')}
                  <ExternalLink size={12} />
                </Link>
              ) : null}
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
                {t('safety.moderation.remove')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busyId === report.id}
                onClick={() => void act(report, 'dismiss')}
              >
                {t('safety.moderation.dismiss')}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

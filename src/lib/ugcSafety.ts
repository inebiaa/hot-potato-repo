import { supabase } from './supabase';

export type ReportTargetType = 'rating' | 'profile' | 'list' | 'event';
export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'other';

export type ContentReport = {
  id: string;
  reporter_id: string | null;
  target_type: ReportTargetType;
  target_id: string;
  target_user_id: string | null;
  reason: ReportReason;
  status: 'open' | 'resolved' | 'dismissed';
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
};

export type ContentReportRow = ContentReport & {
  reporter_username?: string | null;
  target_label?: string | null;
};

export const REPORT_REASONS: { value: ReportReason; labelKey: `safety.report.reason.${ReportReason}` }[] = [
  { value: 'spam', labelKey: 'safety.report.reason.spam' },
  { value: 'harassment', labelKey: 'safety.report.reason.harassment' },
  { value: 'inappropriate', labelKey: 'safety.report.reason.inappropriate' },
  { value: 'other', labelKey: 'safety.report.reason.other' },
];

export async function submitContentReport(input: {
  targetType: ReportTargetType;
  targetId: string;
  targetUserId?: string | null;
  reason: ReportReason;
}): Promise<{ error: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: 'Sign in to submit a report.' };

  const { error } = await supabase.from('content_reports').insert({
    reporter_id: userId,
    target_type: input.targetType,
    target_id: input.targetId,
    target_user_id: input.targetUserId ?? null,
    reason: input.reason,
  });

  if (error) {
    if (error.code === '23505') return { error: 'You already reported this.' };
    return { error: error.message || 'Could not submit report.' };
  }
  return { error: null };
}

export async function fetchBlockedUserIds(): Promise<string[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocked_id')
    .eq('blocker_id', userId);
  if (error) {
    console.warn('fetchBlockedUserIds', error.message);
    return [];
  }
  return (data || []).map((r) => r.blocked_id).filter(Boolean);
}

export async function fetchBlockedUsersWithLabels(): Promise<
  { userId: string; displayName: string; handle: string | null }[]
> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const { data: blocks, error } = await supabase
    .from('user_blocks')
    .select('blocked_id')
    .eq('blocker_id', userId);
  if (error || !blocks?.length) return [];

  const ids = blocks.map((b) => b.blocked_id);
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('user_id, username, user_id_public')
    .in('user_id', ids);

  const byId = new Map(
    (profiles || []).map((p) => [
      p.user_id,
      {
        userId: p.user_id,
        displayName: (p.username || '').trim() || 'User',
        handle: (p.user_id_public || '').trim() || null,
      },
    ]),
  );

  return ids.map((id) => byId.get(id) || { userId: id, displayName: 'User', handle: null });
}

export async function blockUser(blockedId: string): Promise<{ error: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: 'Sign in to block users.' };
  if (userId === blockedId) return { error: 'You cannot block yourself.' };

  const { error } = await supabase.from('user_blocks').insert({
    blocker_id: userId,
    blocked_id: blockedId,
  });
  if (error) {
    if (error.code === '23505') return { error: null };
    return { error: error.message || 'Could not block user.' };
  }
  return { error: null };
}

export async function unblockUser(blockedId: string): Promise<{ error: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: 'Sign in to unblock users.' };

  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', userId)
    .eq('blocked_id', blockedId);
  if (error) return { error: error.message || 'Could not unblock user.' };
  return { error: null };
}

export async function fetchOpenContentReports(): Promise<ContentReportRow[]> {
  const { data, error } = await supabase
    .from('content_reports')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return enrichReports((data || []) as ContentReport[]);
}

async function enrichReports(rows: ContentReport[]): Promise<ContentReportRow[]> {
  if (rows.length === 0) return [];

  const reporterIds = [...new Set(rows.map((r) => r.reporter_id).filter(Boolean))] as string[];
  const targetUserIds = [...new Set(rows.map((r) => r.target_user_id).filter(Boolean))] as string[];

  const profileIds = [...new Set([...reporterIds, ...targetUserIds])];
  const profilesByUser = new Map<string, string>();
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, username, user_id_public')
      .in('user_id', profileIds);
    for (const p of profiles || []) {
      const name = (p.username || '').trim();
      const handle = (p.user_id_public || '').trim();
      profilesByUser.set(p.user_id, handle ? `${name} (@${handle})` : name || 'User');
    }
  }

  return rows.map((row) => {
    let targetLabel: string;
    if (row.target_user_id) {
      targetLabel = `${row.target_type}: ${profilesByUser.get(row.target_user_id) || row.target_user_id}`;
    } else {
      targetLabel = `${row.target_type}: ${row.target_id}`;
    }
    return {
      ...row,
      reporter_username: row.reporter_id ? profilesByUser.get(row.reporter_id) || null : null,
      target_label: targetLabel,
    };
  });
}

export async function resolveContentReport(
  reportId: string,
  status: 'resolved' | 'dismissed',
): Promise<{ error: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: 'Sign in required.' };

  const { error } = await supabase
    .from('content_reports')
    .update({
      status,
      resolved_by: userId,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', reportId);
  if (error) return { error: error.message || 'Could not update report.' };
  return { error: null };
}

export async function adminRemoveReportedContent(
  report: ContentReport,
): Promise<{ error: string | null }> {
  try {
    switch (report.target_type) {
      case 'rating': {
        const { error } = await supabase.from('ratings').delete().eq('id', report.target_id);
        if (error) throw error;
        break;
      }
      case 'profile': {
        if (!report.target_user_id) return { error: 'Missing profile user.' };
        const { error } = await supabase
          .from('user_profiles')
          .update({ avatar_url: null, cover_image_url: null })
          .eq('user_id', report.target_user_id);
        if (error) throw error;
        break;
      }
      case 'list': {
        const { error } = await supabase.from('user_lists').delete().eq('id', report.target_id);
        if (error) throw error;
        break;
      }
      case 'event': {
        const { error } = await supabase.from('events').delete().eq('id', report.target_id);
        if (error) throw error;
        break;
      }
      default:
        return { error: 'Unknown report type.' };
    }
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not remove content.' };
  }
}

export function ratingAuthorLabel(rating: {
  author_display_name?: string | null;
  username?: string | null;
}): string {
  const fromRating = (rating.author_display_name || '').trim();
  if (fromRating) return fromRating;
  return (rating.username || '').trim() || 'Unknown User';
}

export function isUserBlocked(blockedIds: ReadonlySet<string>, userId: string | null | undefined): boolean {
  if (!userId) return false;
  return blockedIds.has(userId);
}

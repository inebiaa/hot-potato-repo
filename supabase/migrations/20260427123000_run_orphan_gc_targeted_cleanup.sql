-- Targeted cleanup pass for orphan tag identities.
-- Uses the guarded GC function added earlier.

SELECT public.garbage_collect_orphan_tag_identities();

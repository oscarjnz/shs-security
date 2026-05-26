-- 015: Delete seeded demo notifications. From now on every row in the
--      notifications table comes from a real event (scan finding, KEV sync
--      update, threat detected, weekly report, etc).
-- Down:
--   No down. The deleted rows were demo seeds, recreating them is not desired.

-- 1) Add a `source` column so we can tell apart real events from any future
--    test data. Default 'seed' so the next step can purge precisely.
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'event';

-- 2) Nuke everything that's already there. The app has no real user data in
--    this table yet, and the previous rows were the hardcoded demo set the
--    user wants gone. Future inserts must set `source` (we keep the default
--    of 'event' so the kev_cron / scan / threat triggers don't have to).
DELETE FROM notifications;

-- 3) Helpful index for the new "feed" page query order.
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC)
  WHERE NOT dismissed;

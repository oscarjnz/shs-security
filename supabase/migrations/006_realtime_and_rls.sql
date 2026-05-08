-- 006: Enable realtime subscriptions
-- Down: ALTER PUBLICATION supabase_realtime DROP TABLE threats, network_metrics, activity_logs, notifications, scan_results;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'threats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE threats;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'network_metrics'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE network_metrics;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'activity_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE activity_logs;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'scan_results'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE scan_results;
  END IF;
END $$;

ALTER TABLE threats REPLICA IDENTITY FULL;
ALTER TABLE network_metrics REPLICA IDENTITY FULL;
ALTER TABLE activity_logs REPLICA IDENTITY FULL;
ALTER TABLE notifications REPLICA IDENTITY FULL;
ALTER TABLE scan_results REPLICA IDENTITY FULL;

# WorkSession is the timesheet; legacy window sessions stay frozen

Beholder used to persist one `sessions` row per foreground-window `aggregation_key`. The redesign treats ActivityEvents as telemetry and WorkSessions as billed time. Existing `sessions` rows are not reprocessed into WorkSessions: they remain a read-only “Storico precedente” so historical data is not silently rewritten. New tracking writes only the new tables.

SWITCH_DELAY_HIGH is 30s (not the sketch’s 10s) so a 20s glance at another Cursor workspace does not confirm a switch (acceptance case 3).

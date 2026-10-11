"""Validate preserved launchd definitions without loading or running jobs."""

from pathlib import Path
import plistlib
import unittest

ROOT = Path(__file__).resolve().parents[1]
PREFIX = "com.okamoto.kabu_doragon_incremental_update_"


class LocalUpdateScheduleTests(unittest.TestCase):
    def job(self, name):
        with (ROOT / "launchd" / f"{PREFIX}{name}.plist").open("rb") as source:
            return plistlib.load(source)

    def test_three_jobs_use_the_checked_daily_entrypoint(self):
        for name in ("early", "main", "catchup"):
            with self.subTest(job=name):
                job = self.job(name)
                base = Path(job["WorkingDirectory"])
                self.assertEqual(job["Label"], PREFIX + name)
                self.assertEqual(job["ProgramArguments"], [
                    str(base / ".venv/bin/python"),
                    str(base / "scripts/kabu_daily_update.py"),
                ])

    def test_weekday_update_times_are_preserved(self):
        for name, hour, minute in (("early", 16, 40), ("main", 18, 30)):
            with self.subTest(job=name):
                job = self.job(name)
                self.assertFalse(job["RunAtLoad"])
                self.assertEqual(job["StartCalendarInterval"], [
                    {"Weekday": day, "Hour": hour, "Minute": minute}
                    for day in range(1, 6)
                ])

    def test_catchup_runs_at_load_not_on_a_second_calendar(self):
        job = self.job("catchup")
        self.assertTrue(job["RunAtLoad"])
        self.assertNotIn("StartCalendarInterval", job)

    def test_jobs_keep_separate_logs(self):
        paths = []
        for name in ("early", "main", "catchup"):
            job = self.job(name)
            base = Path(job["WorkingDirectory"])
            for key in ("StandardOutPath", "StandardErrorPath"):
                path = Path(job[key])
                self.assertEqual(path.parent, base / "logs")
                paths.append(str(path))
        self.assertEqual(len(paths), len(set(paths)))


if __name__ == "__main__":
    unittest.main()

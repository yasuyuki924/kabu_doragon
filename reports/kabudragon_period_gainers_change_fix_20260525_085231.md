# KabuDragon period gainers changePercent fix

- Created: 20260525_085231
- Backup JSONL gzip: `/Users/okamoto/My Project/kabu_doragon/reports/overview_period_change_backup_20260525_085231/change_fields_before.jsonl.gz`
- Summary JSON: `/Users/okamoto/My Project/kabu_doragon/reports/overview_period_change_backup_20260525_085231/summary.json`
- Scope: `data/public_json/overview_lite/*/market_pulse_weekly.json` and `market_pulse_monthly.json`
- Changed fields only: `records[].change`, `records[].changePercent`
- Definition: weekly/monthly change is calculated from previous period close to current period close.

## Summary

```json
{
  "createdAt": "20260525_085231",
  "backup": "/Users/okamoto/My Project/kabu_doragon/reports/overview_period_change_backup_20260525_085231/change_fields_before.jsonl.gz",
  "timeframes": {
    "weekly": {
      "files": 340,
      "periods": 273,
      "changedFiles": 339,
      "changedRecords": 971865,
      "skippedNoPreviousPeriodFiles": 1,
      "changedFileExamples": [
        "data/public_json/overview_lite/2021-03-12/market_pulse_weekly.json",
        "data/public_json/overview_lite/2021-03-19/market_pulse_weekly.json",
        "data/public_json/overview_lite/2021-03-26/market_pulse_weekly.json",
        "data/public_json/overview_lite/2021-04-02/market_pulse_weekly.json",
        "data/public_json/overview_lite/2021-04-09/market_pulse_weekly.json",
        "data/public_json/overview_lite/2021-04-16/market_pulse_weekly.json",
        "data/public_json/overview_lite/2021-04-23/market_pulse_weekly.json",
        "data/public_json/overview_lite/2021-04-30/market_pulse_weekly.json",
        "data/public_json/overview_lite/2021-05-07/market_pulse_weekly.json",
        "data/public_json/overview_lite/2021-05-14/market_pulse_weekly.json"
      ]
    },
    "monthly": {
      "files": 144,
      "periods": 63,
      "changedFiles": 143,
      "changedRecords": 439387,
      "skippedNoPreviousPeriodFiles": 1,
      "changedFileExamples": [
        "data/public_json/overview_lite/2021-04-30/market_pulse_monthly.json",
        "data/public_json/overview_lite/2021-05-31/market_pulse_monthly.json",
        "data/public_json/overview_lite/2021-06-30/market_pulse_monthly.json",
        "data/public_json/overview_lite/2021-07-30/market_pulse_monthly.json",
        "data/public_json/overview_lite/2021-08-31/market_pulse_monthly.json",
        "data/public_json/overview_lite/2021-09-30/market_pulse_monthly.json",
        "data/public_json/overview_lite/2021-10-29/market_pulse_monthly.json",
        "data/public_json/overview_lite/2021-11-30/market_pulse_monthly.json",
        "data/public_json/overview_lite/2021-12-30/market_pulse_monthly.json",
        "data/public_json/overview_lite/2022-01-31/market_pulse_monthly.json"
      ]
    }
  },
  "examples": [
    {
      "file": "data/public_json/overview_lite/2021-03-12/market_pulse_weekly.json",
      "code": "3853",
      "name": "アステリア",
      "before": {
        "change": 23.0,
        "changePercent": 2.8083
      },
      "after": {
        "change": 25.0,
        "changePercent": 3.06
      }
    },
    {
      "file": "data/public_json/overview_lite/2021-03-12/market_pulse_weekly.json",
      "code": "7082",
      "name": "ジモティー",
      "before": {
        "change": 39.0,
        "changePercent": 3.7002
      },
      "after": {
        "change": 49.0,
        "changePercent": 4.6935
      }
    },
    {
      "file": "data/public_json/overview_lite/2021-03-19/market_pulse_weekly.json",
      "code": "3853",
      "name": "アステリア",
      "before": {
        "change": 8.0,
        "changePercent": 0.9423
      },
      "after": {
        "change": 15.0,
        "changePercent": 1.7815
      }
    },
    {
      "file": "data/public_json/overview_lite/2021-03-19/market_pulse_weekly.json",
      "code": "7082",
      "name": "ジモティー",
      "before": {
        "change": 4.0,
        "changePercent": 0.3645
      },
      "after": {
        "change": 8.5,
        "changePercent": 0.7777
      }
    },
    {
      "file": "data/public_json/overview_lite/2021-03-26/market_pulse_weekly.json",
      "code": "3853",
      "name": "アステリア",
      "before": {
        "change": -27.0,
        "changePercent": -3.1323
      },
      "after": {
        "change": -22.0,
        "changePercent": -2.5671
      }
    },
    {
      "file": "data/public_json/overview_lite/2021-03-26/market_pulse_weekly.json",
      "code": "7082",
      "name": "ジモティー",
      "before": {
        "change": -13.0,
        "changePercent": -1.1696
      },
      "after": {
        "change": -3.0,
        "changePercent": -0.2724
      }
    },
    {
      "file": "data/public_json/overview_lite/2021-04-02/market_pulse_weekly.json",
      "code": "3853",
      "name": "アステリア",
      "before": {
        "change": 35.0,
        "changePercent": 4.1716
      },
      "after": {
        "change": 39.0,
        "changePercent": 4.6707
      }
    },
    {
      "file": "data/public_json/overview_lite/2021-04-02/market_pulse_weekly.json",
      "code": "7082",
      "name": "ジモティー",
      "before": {
        "change": 37.0,
        "changePercent": 3.418
      },
      "after": {
        "change": 21.0,
        "changePercent": 1.9117
      }
    },
    {
      "file": "data/public_json/overview_lite/2021-04-09/market_pulse_weekly.json",
      "code": "3853",
      "name": "アステリア",
      "before": {
        "change": -26.0,
        "changePercent": -2.9246
      },
      "after": {
        "change": -11.0,
        "changePercent": -1.2586
      }
    },
    {
      "file": "data/public_json/overview_lite/2021-04-09/market_pulse_weekly.json",
      "code": "7082",
      "name": "ジモティー",
      "before": {
        "change": -57.0,
        "changePercent": -5.0689
      },
      "after": {
        "change": -52.0,
        "changePercent": -4.6449
      }
    },
    {
      "file": "data/public_json/overview_lite/2021-04-16/market_pulse_weekly.json",
      "code": "7082",
      "name": "ジモティー",
      "before": {
        "change": -6.5,
        "changePercent": -0.6069
      },
      "after": {
        "change": -3.0,
        "changePercent": -0.281
      }
    },
    {
      "file": "data/public_json/overview_lite/2021-04-23/market_pulse_weekly.json",
      "code": "3853",
      "name": "アステリア",
      "before": {
        "change": -35.0,
        "changePercent": -3.9863
      },
      "after": {
        "change": -50.0,
        "changePercent": -5.5991
      }
    },
    {
      "file": "data/public_json/overview_lite/2021-04-23/market_pulse_weekly.json",
      "code": "7082",
      "name": "ジモティー",
      "before": {
        "change": -51.5,
        "changePercent": -4.8562
      },
      "after": {
        "change": -55.5,
        "changePercent": -5.2137
      }
    },
    {
      "file": "data/public_json/overview_lite/2021-04-30/market_pulse_weekly.json",
      "code": "3853",
      "name": "アステリア",
      "before": {
        "change": -24.0,
        "changePercent": -2.8235
      },
      "after": {
        "change": -17.0,
        "changePercent": -2.0166
      }
    },
    {
      "file": "data/public_json/overview_lite/2021-04-30/market_pulse_weekly.json",
      "code": "7082",
      "name": "ジモティー",
      "before": {
        "change": -25.0,
        "changePercent": -2.4752
      },
      "after": {
        "change": -24.0,
        "changePercent": -2.3786
      }
    },
    {
      "file": "data/public_json/overview_lite/2021-05-07/market_pulse_weekly.json",
      "code": "3853",
      "name": "アステリア",
      "before": {
        "change": 19.0,
        "changePercent": 2.3143
      },
      "after": {
        "change": 14.0,
        "changePercent": 1.6949
      }
    },
    {
      "file": "data/public_json/overview_lite/2021-05-07/market_pulse_weekly.json",
      "code": "5074",
      "name": "テスホールディングス",
      "before": {
        "change": -39.0,
        "changePercent": -1.9807
      },
      "after": {
        "change": -13.0,
        "changePercent": -0.6691
      }
    },
    {
      "file": "data/public_json/overview_lite/2021-05-07/market_pulse_weekly.json",
      "code": "7082",
      "name": "ジモティー",
      "before": {
        "change": 7.0,
        "changePercent": 0.7074
      },
      "after": {
        "change": 11.5,
        "changePercent": 1.1675
      }
    },
    {
      "file": "data/public_json/overview_lite/2021-05-14/market_pulse_weekly.json",
      "code": "3853",
      "name": "アステリア",
      "before": {
        "change": -65.0,
        "changePercent": -7.7938
      },
      "after": {
        "change": -71.0,
        "changePercent": -8.4524
      }
    },
    {
      "file": "data/public_json/overview_lite/2021-05-14/market_pulse_weekly.json",
      "code": "5074",
      "name": "テスホールディングス",
      "before": {
        "change": -210.0,
        "changePercent": -10.9091
      },
      "after": {
        "change": -215.0,
        "changePercent": -11.1399
      }
    }
  ],
  "totalChangedRecords": 1411252
}
```

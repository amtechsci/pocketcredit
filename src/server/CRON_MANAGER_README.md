# Cron Manager Documentation

A Laravel-style task scheduler for managing all cron jobs in the application.

## Features

- ✅ Laravel-style scheduling API
- ✅ Timezone support (default: IST)
- ✅ Task status tracking
- ✅ Enable/disable tasks
- ✅ Manual task execution
- ✅ Admin API endpoints

## Usage

### Registering Jobs

All jobs are registered in `src/server/jobs/index.js`:

```javascript
const cronManager = require('../services/cronManager');
const { calculateLoanInterestAndPenalty } = require('./loanCalculationJob');

function registerJobs() {
  // Daily at specific time
  cronManager.daily('00:01', 'daily-loan-calculation', async () => {
    await calculateLoanInterestAndPenalty();
  }, {
    timezone: 'Asia/Kolkata',
    runOnInit: false
  });

  // Hourly
  cronManager.hourly(0, 'hourly-task', async () => {
    // Your task
  });

  // Every N minutes
  cronManager.everyMinutes(15, 'quarterly-task', async () => {
    // Your task
  });

  // Weekly
  cronManager.weekly(0, '09:00', 'weekly-report', async () => {
    // Your task (Sundays at 9 AM)
  });

  // Monthly
  cronManager.monthly(1, '00:00', 'monthly-report', async () => {
    // Your task (1st of month at midnight)
  });

  // Custom cron expression
  cronManager.schedule('0 */6 * * *', 'every-6-hours', async () => {
    // Your task
  });
}
```

### Scheduling Methods

#### `daily(time, name, task, options)`
Schedule a task to run daily at a specific time.

- `time`: Time in HH:MM format (e.g., '00:01', '14:30')
- `name`: Unique task name
- `task`: Async function to execute
- `options`: Optional configuration

#### `hourly(minute, name, task, options)`
Schedule a task to run hourly at a specific minute.

- `minute`: Minute of the hour (0-59)
- `name`: Unique task name
- `task`: Async function to execute
- `options`: Optional configuration

#### `everyMinutes(minutes, name, task, options)`
Schedule a task to run every N minutes.

- `minutes`: Interval in minutes
- `name`: Unique task name
- `task`: Async function to execute
- `options`: Optional configuration

#### `weekly(dayOfWeek, time, name, task, options)`
Schedule a task to run weekly.

- `dayOfWeek`: Day of week (0-6, 0 = Sunday)
- `time`: Time in HH:MM format
- `name`: Unique task name
- `task`: Async function to execute
- `options`: Optional configuration

#### `monthly(dayOfMonth, time, name, task, options)`
Schedule a task to run monthly.

- `dayOfMonth`: Day of month (1-31)
- `time`: Time in HH:MM format
- `name`: Unique task name
- `task`: Async function to execute
- `options`: Optional configuration

#### `schedule(cronExpression, name, task, options)`
Schedule a task with a custom cron expression.

- `cronExpression`: Standard cron expression (e.g., '0 0 * * *')
- `name`: Unique task name
- `task`: Async function to execute
- `options`: Optional configuration

### Options

```javascript
{
  enabled: true,              // Whether task is enabled
  timezone: 'Asia/Kolkata',    // Timezone (default: IST)
  runOnInit: false             // Run immediately on server start
}
```

## Admin API Endpoints

### Get All Cron Jobs Status
```
GET /api/admin/cron/status
```

Response:
```json
{
  "success": true,
  "data": {
    "isRunning": true,
    "totalTasks": 1,
    "tasks": [
      {
        "name": "daily-loan-calculation",
        "schedule": "1 0 * * *",
        "enabled": true,
        "timezone": "Asia/Kolkata",
        "lastRun": "2026-01-15T00:01:00.000Z",
        "nextRun": "Scheduled",
        "runCount": 15,
        "errorCount": 0,
        "lastError": null
      }
    ]
  }
}
```

### Get Specific Task Status
```
GET /api/admin/cron/task/:name
```

### Manually Run a Task
```
POST /api/admin/cron/task/:name/run
```

### Enable a Task
```
POST /api/admin/cron/task/:name/enable
```

### Disable a Task
```
POST /api/admin/cron/task/:name/disable
```

## Cron Expression Format

Standard cron format: `minute hour day month dayOfWeek`

Examples:
- `0 0 * * *` - Daily at midnight
- `0 */6 * * *` - Every 6 hours
- `*/15 * * * *` - Every 15 minutes
- `0 9 * * 1` - Every Monday at 9 AM
- `0 0 1 * *` - First day of every month at midnight

## Current Jobs

### Daily Loan Calculation
- **Name**: `daily-loan-calculation`
- **Schedule**: Daily at 00:01 IST
- **Purpose**: Calculate and update interest and penalty for all processed loans
- **File**: `src/server/jobs/loanCalculationJob.js`

## Adding New Jobs

1. Create a new job file in `src/server/jobs/`:
   ```javascript
   // src/server/jobs/myNewJob.js
   async function myNewJob() {
     // Your job logic
   }
   
   module.exports = { myNewJob };
   ```

2. Register it in `src/server/jobs/index.js`:
   ```javascript
   const { myNewJob } = require('./myNewJob');
   
   cronManager.daily('09:00', 'my-new-job', async () => {
     await myNewJob();
   });
   ```

3. The job will automatically start when the server starts.

## Testing

You can manually run a job for testing:

```javascript
const cronManager = require('./services/cronManager');

// Run a specific job
await cronManager.run('daily-loan-calculation');
```

Or use the admin API:
```bash
curl -X POST http://localhost:3002/api/admin/cron/task/daily-loan-calculation/run \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Notes

- All times are in IST (Asia/Kolkata) by default
- Tasks run in the same process as the server
- Failed tasks are logged but don't stop the scheduler
- Task execution is tracked (run count, error count, last run time)


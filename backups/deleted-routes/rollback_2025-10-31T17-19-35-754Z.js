#!/usr/bin/env node

/**
 * ROLLBACK SCRIPT
 * Generated: 2025-10-31T17:19:35.774Z
 * 
 * This script will restore deleted files from backup.
 * Run this if the cleanup caused issues.
 */

const fs = require('fs');
const path = require('path');

const filesToRestore = [
  {
    "original": "src/server/routes/auth.js",
    "backup": "backups\\deleted-routes\\2025-10-31T17-19-35-754Z_auth.js"
  },
  {
    "original": "src/server/routes/dashboard.js",
    "backup": "backups\\deleted-routes\\2025-10-31T17-19-35-754Z_dashboard.js"
  },
  {
    "original": "src/server/routes/users.js",
    "backup": "backups\\deleted-routes\\2025-10-31T17-19-35-754Z_users.js"
  },
  {
    "original": "src/server/routes/activityLogs.js",
    "backup": "backups\\deleted-routes\\2025-10-31T17-19-35-754Z_activityLogs.js"
  }
];

console.log('🔄 Rolling back deleted files...');

let restoredCount = 0;
filesToRestore.forEach(({ original, backup }) => {
  try {
    if (fs.existsSync(backup)) {
      fs.copyFileSync(backup, original);
      console.log(`✓ Restored: ${original}`);
      restoredCount++;
    } else {
      console.log(`⚠ Backup not found: ${backup}`);
    }
  } catch (error) {
    console.log(`✗ Failed to restore ${original}: ${error.message}`);
  }
});

console.log(`\n✓ Rollback complete. Restored ${restoredCount} files.`);
console.log('⚠ You may need to restart your server.');

# Rules Migration Script

## Overview

The `migrate_rules.py` script migrates data integrity rules from YAML files to Firestore, enabling runtime rule management without code deployments.

## Features

- **Initial Migration**: Load all YAML rules into Firestore
- **Sync**: Update Firestore with YAML changes (preserves user-created rules)
- **Reset**: Delete all Firestore rules and reload from YAML
- **Clear**: Delete all Firestore rules
- **Dry Run**: Preview changes without applying them

## Usage

### 1. Initial Migration (First Time)

**Step 1: Preview changes (dry run)**
```bash
cd backend
python -m scripts.migrate_rules --action=migrate --dry-run
```

This will show you what rules will be created without actually creating them.

**Step 2: Run the actual migration**
```bash
python -m scripts.migrate_rules --action=migrate
```

This loads all rules from `config/schema.yaml` and `config/rules.yaml` into Firestore.

### 2. Sync YAML Changes

After modifying YAML files, sync changes to Firestore:

```bash
python -m scripts.migrate_rules --action=sync
```

This will:
- ✅ Add new YAML rules
- ✅ Update existing YAML rules
- ✅ Delete removed YAML rules
- ⏭️  Preserve user-created rules (source != "yaml")

### 3. Reset to YAML Defaults

To delete all Firestore rules and reload from YAML:

```bash
python -m scripts.migrate_rules --action=reset --confirm
```

⚠️ **Warning:** This deletes ALL rules, including user-created ones!

### 4. Clear All Rules

To delete all Firestore rules without reloading:

```bash
python -m scripts.migrate_rules --action=clear --confirm
```

## Rule Categories

The script migrates four categories of rules:

### 1. Duplicate Rules
- **Source:** `config/schema.yaml` → `duplicates` section
- **Firestore Path:** `rules/duplicates/{entity}/{rule_id}`
- **Entities:** students, parents, contractors
- **Types:** likely, possible

### 2. Relationship Rules
- **Source:** `config/schema.yaml` → `entities[*].relationships`
- **Firestore Path:** `rules/relationships/{source_entity}/{target_entity}`
- **Entities:** students, parents, contractors, classes

### 3. Required Field Rules
- **Source:** `config/schema.yaml` → `entities[*].missing_key_data`
- **Firestore Path:** `rules/required_fields/{entity}/{field_name}`
- **Entities:** students, parents, contractors, classes

### 4. Attendance Rules
- **Source:** `config/rules.yaml` → `attendance_rules`
- **Firestore Path:** `rules/attendance/thresholds/{metric_name}`
- **Metrics:** absence_rate_30d, consecutive_absences, tardy_rate, etc.

## Firestore Schema

Each rule document includes:

```javascript
{
  rule_id: string,
  entity: string,
  // ... rule-specific fields ...
  source: "yaml" | "firestore" | "user",
  enabled: boolean,
  created_at: timestamp,
  updated_at: timestamp,
  created_by: user_id,
  updated_by: user_id
}
```

The `source` field tracks rule origin:
- `"yaml"`: Loaded from YAML files
- `"user"`: Created by users via UI
- `"firestore"`: Created via API/script

## Examples

### Example 1: Initial Setup

```bash
# 1. Preview migration
python -m scripts.migrate_rules --action=migrate --dry-run

# Output:
# 📋 Migrating Duplicate Rules...
#    Entity: students
#       [DRY RUN] Would create: dup.student.email_dob (likely)
#       [DRY RUN] Would create: dup.student.name_campus (possible)
# ...
# TOTAL: Created: 45, Updated: 0, Deleted: 0, Preserved: 0

# 2. Run migration
python -m scripts.migrate_rules --action=migrate

# Output:
# ✅ Created: dup.student.email_dob (likely)
# ✅ Created: dup.student.name_campus (possible)
# ...
# ✅ Migration completed successfully
```

### Example 2: Update YAML and Sync

```bash
# 1. Edit config/schema.yaml
# Add new duplicate rule for students

# 2. Sync changes
python -m scripts.migrate_rules --action=sync

# Output:
# 📋 Syncing Duplicate Rules...
#    Entity: students
#       ✅ Created: dup.student.new_rule (likely)
#       ⏭️  Preserved user rule: dup.student.custom_001
# ...
```

### Example 3: Reset After Major Changes

```bash
# Reset to YAML defaults (preview first)
python -m scripts.migrate_rules --action=reset --dry-run

# Confirm and execute
python -m scripts.migrate_rules --action=reset --confirm
```

## Troubleshooting

### Error: "GOOGLE_APPLICATION_CREDENTIALS not set"

Set up Firebase credentials:
```bash
# Option 1: Application Default Credentials (recommended for local dev)
gcloud auth application-default login

# Option 2: Service account key
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
```

### Error: "Module not found"

Run from the backend directory:
```bash
cd backend
python -m scripts.migrate_rules --action=migrate
```

### Rules not appearing in UI

1. Verify migration succeeded (check console output)
2. Check Firestore console for `rules/` collection
3. Verify `enabled: true` on rules
4. Check browser console for errors

### Sync not detecting changes

The sync command only updates rules with `source: "yaml"`. User-created rules are preserved. To force update:

1. Use `--action=reset` to delete all and reload
2. Or manually update in Firestore console

## Best Practices

### 1. Always Preview First
```bash
# Always run dry-run before actual migration
python -m scripts.migrate_rules --action=migrate --dry-run
```

### 2. Backup Before Reset
```bash
# Export rules before destructive operations
# (Future: export functionality will be added)
```

### 3. Version Control YAML Files
```bash
# Commit YAML changes before syncing
git add backend/config/schema.yaml backend/config/rules.yaml
git commit -m "Updated duplicate rules"

# Then sync to Firestore
python -m scripts.migrate_rules --action=sync
```

### 4. Test in Staging First
```bash
# Use different Firebase projects for staging/production
# Set GOOGLE_APPLICATION_CREDENTIALS for staging
export GOOGLE_APPLICATION_CREDENTIALS="./staging-key.json"
python -m scripts.migrate_rules --action=migrate
```

## Next Steps

After migration, you can:

1. **View rules** in Firestore Console
   - Navigate to `rules/` collection
   - Browse by category and entity

2. **Edit rules** via API or UI
   - Use existing `/rules` endpoints
   - Rules page (coming soon)

3. **Create custom rules**
   - Add via API with `source: "user"`
   - These will be preserved during sync

4. **Run integrity checks**
   - Backend will automatically load rules from Firestore
   - Falls back to YAML if Firestore empty

## Script Architecture

```
migrate_rules.py
├── RulesMigrator (main class)
│   ├── migrate()         # Initial migration
│   ├── sync()            # Sync YAML changes
│   ├── reset()           # Delete all + migrate
│   └── clear()           # Delete all
│
├── Per-category methods:
│   ├── _migrate_duplicates()
│   ├── _migrate_relationships()
│   ├── _migrate_required_fields()
│   └── _migrate_attendance()
│
└── Utilities:
    ├── _create_*_rule()  # Create rule in Firestore
    ├── _update_*_rule()  # Update existing rule
    ├── _delete_rule()    # Delete single rule
    └── _print_summary()  # Show statistics
```

## Future Enhancements

Planned improvements:

- [ ] Export rules to JSON
- [ ] Import rules from JSON
- [ ] Backup/restore functionality
- [ ] Rule validation before migration
- [ ] Batch operations for large rule sets
- [ ] Migration status tracking
- [ ] Rollback capability

## Support

For issues or questions:

1. Check Firestore Console for rule documents
2. Review migration logs for errors
3. Use `--dry-run` to preview changes
4. Consult [RULES-FIREBASE-MIGRATION-PLAN.md](../../RULES-FIREBASE-MIGRATION-PLAN.md) for architecture details

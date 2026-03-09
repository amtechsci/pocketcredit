/**
 * Admin CRUD for credit limit rules (dynamic limit logic).
 * Mount: /api/admin/credit-limit-rules
 */

const express = require('express');
const { executeQuery, initializeDatabase } = require('../config/database');
const { authenticateAdmin } = require('../middleware/auth');
const router = express.Router();

function parseTiers(value) {
  if (value == null) return null;
  if (Array.isArray(value)) return value.every(n => typeof n === 'number') ? value : null;
  if (typeof value === 'string') {
    try {
      const arr = JSON.parse(value);
      return Array.isArray(arr) && arr.every(n => typeof n === 'number') ? arr : null;
    } catch (_) { return null; }
  }
  return null;
}

function validateRuleBody(body, isUpdate = false) {
  const {
    rule_name,
    rule_code,
    description,
    calculation_mode,
    percentage_tiers,
    fixed_amount_tiers,
    first_time_percentage,
    max_regular_cap,
    premium_limit,
    premium_tenure_months,
    triggers_cooling_period,
    block_after_tier,
    is_default,
    is_active,
    sort_order,
    salary_min,
    salary_max,
    auto_assign
  } = body;

  if (!isUpdate && (!rule_name || typeof rule_name !== 'string' || !rule_name.trim())) {
    return { error: 'rule_name is required and must be a non-empty string' };
  }

  const mode = calculation_mode || 'percentage';
  if (!['percentage', 'fixed'].includes(mode)) {
    return { error: 'calculation_mode must be "percentage" or "fixed"' };
  }

  const pctTiers = parseTiers(percentage_tiers);
  const fixTiers = parseTiers(fixed_amount_tiers);

  if (!isUpdate) {
    if (mode === 'percentage' && (!pctTiers || pctTiers.length < 1)) {
      return { error: 'percentage_tiers is required for percentage mode' };
    }
    if (mode === 'fixed' && (!fixTiers || fixTiers.length < 1)) {
      return { error: 'fixed_amount_tiers is required for fixed mode' };
    }
  }
  if (percentage_tiers !== undefined && percentage_tiers !== null && percentage_tiers !== '') {
    if (!pctTiers || pctTiers.length < 1) {
      return { error: 'percentage_tiers must be a non-empty array of numbers' };
    }
  }
  if (fixed_amount_tiers !== undefined && fixed_amount_tiers !== null && fixed_amount_tiers !== '') {
    if (!fixTiers || fixTiers.length < 1) {
      return { error: 'fixed_amount_tiers must be a non-empty array of numbers' };
    }
  }

  if (first_time_percentage != null) {
    const firstPct = parseFloat(first_time_percentage);
    if (isNaN(firstPct) || firstPct <= 0 || firstPct > 100) {
      return { error: 'first_time_percentage must be between 0 and 100' };
    }
  }
  if (max_regular_cap != null && max_regular_cap !== '') {
    const maxCap = parseFloat(max_regular_cap);
    if (isNaN(maxCap) || maxCap <= 0) {
      return { error: 'max_regular_cap must be greater than 0' };
    }
  }
  if (block_after_tier != null && block_after_tier !== '') {
    const bat = parseInt(block_after_tier, 10);
    if (isNaN(bat) || bat < 1) {
      return { error: 'block_after_tier must be a positive integer' };
    }
  }

  const out = {};
  out.calculation_mode = mode;
  if (rule_name !== undefined) out.rule_name = String(rule_name).trim();
  if (rule_code !== undefined) out.rule_code = rule_code === '' ? null : String(rule_code).trim();
  if (description !== undefined) out.description = String(description);
  if (pctTiers) out.percentage_tiers = pctTiers;
  if (fixTiers) out.fixed_amount_tiers = fixTiers;
  if (percentage_tiers === null || percentage_tiers === '') out.percentage_tiers = null;
  if (fixed_amount_tiers === null || fixed_amount_tiers === '') out.fixed_amount_tiers = null;
  if (first_time_percentage != null) out.first_time_percentage = parseFloat(first_time_percentage);
  if (max_regular_cap != null && max_regular_cap !== '') out.max_regular_cap = parseFloat(max_regular_cap);
  if (premium_limit !== undefined) out.premium_limit = (premium_limit === null || premium_limit === '') ? null : parseFloat(premium_limit);
  if (premium_tenure_months !== undefined) out.premium_tenure_months = (premium_tenure_months === null || premium_tenure_months === '') ? null : parseInt(premium_tenure_months, 10);
  if (triggers_cooling_period !== undefined) out.triggers_cooling_period = (triggers_cooling_period === true || triggers_cooling_period === 1) ? 1 : 0;
  if (block_after_tier !== undefined) out.block_after_tier = (block_after_tier === null || block_after_tier === '') ? null : parseInt(block_after_tier, 10);
  if (is_default !== undefined) out.is_default = (is_default === true || is_default === 1) ? 1 : 0;
  if (is_active !== undefined) out.is_active = (is_active === false || is_active === 0) ? 0 : 1;
  if (sort_order !== undefined) out.sort_order = parseInt(sort_order, 10) || 0;
  if (salary_min !== undefined) out.salary_min = (salary_min === null || salary_min === '') ? null : parseFloat(salary_min);
  if (salary_max !== undefined) out.salary_max = (salary_max === null || salary_max === '') ? null : parseFloat(salary_max);
  if (auto_assign !== undefined) out.auto_assign = (auto_assign === true || auto_assign === 1) ? 1 : 0;

  if (!isUpdate) {
    if (!out.rule_name) return { error: 'rule_name is required' };
    out.first_time_percentage = out.first_time_percentage ?? 8;
    out.max_regular_cap = out.max_regular_cap ?? 999999;
    out.premium_limit = out.premium_limit !== undefined ? out.premium_limit : null;
    out.premium_tenure_months = out.premium_tenure_months !== undefined ? out.premium_tenure_months : null;
    out.triggers_cooling_period = out.triggers_cooling_period ?? 1;
    out.block_after_tier = out.block_after_tier !== undefined ? out.block_after_tier : null;
    out.is_default = out.is_default ?? 0;
    out.is_active = out.is_active ?? 1;
    out.sort_order = out.sort_order ?? 0;
    out.salary_min = out.salary_min !== undefined ? out.salary_min : null;
    out.salary_max = out.salary_max !== undefined ? out.salary_max : null;
    out.auto_assign = out.auto_assign ?? 0;
  }
  return out;
}

/**
 * GET /api/admin/credit-limit-rules - List all rules
 */
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const rows = await executeQuery(
      'SELECT * FROM credit_limit_rules ORDER BY sort_order ASC, rule_name ASC'
    );
    const data = (rows || []).map(r => ({
      ...r,
      percentage_tiers: r.percentage_tiers ? (typeof r.percentage_tiers === 'string' ? JSON.parse(r.percentage_tiers) : r.percentage_tiers) : null,
      fixed_amount_tiers: r.fixed_amount_tiers ? (typeof r.fixed_amount_tiers === 'string' ? JSON.parse(r.fixed_amount_tiers) : r.fixed_amount_tiers) : null
    }));
    res.json({ success: true, data });
  } catch (error) {
    console.error('List credit limit rules error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch credit limit rules' });
  }
});

/**
 * GET /api/admin/credit-limit-rules/:id - Get one rule
 */
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;
    const rows = await executeQuery('SELECT * FROM credit_limit_rules WHERE id = ?', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Credit limit rule not found' });
    }
    const r = rows[0];
    const data = {
      ...r,
      percentage_tiers: r.percentage_tiers ? (typeof r.percentage_tiers === 'string' ? JSON.parse(r.percentage_tiers) : r.percentage_tiers) : null,
      fixed_amount_tiers: r.fixed_amount_tiers ? (typeof r.fixed_amount_tiers === 'string' ? JSON.parse(r.fixed_amount_tiers) : r.fixed_amount_tiers) : null
    };
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get credit limit rule error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch credit limit rule' });
  }
});

/**
 * POST /api/admin/credit-limit-rules - Create rule
 */
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const validated = validateRuleBody(req.body, false);
    if (validated.error) {
      return res.status(400).json({ success: false, message: validated.error });
    }

    if (validated.rule_code) {
      const existing = await executeQuery(
        'SELECT id FROM credit_limit_rules WHERE rule_code = ?',
        [validated.rule_code]
      );
      if (existing && existing.length > 0) {
        return res.status(400).json({ success: false, message: 'A rule with this rule_code already exists' });
      }
    }

    if (validated.is_default === 1) {
      await executeQuery('UPDATE credit_limit_rules SET is_default = 0 WHERE is_default = 1');
    }

    const result = await executeQuery(
      `INSERT INTO credit_limit_rules (
        rule_name, rule_code, description, calculation_mode,
        percentage_tiers, fixed_amount_tiers,
        first_time_percentage, max_regular_cap, premium_limit, premium_tenure_months,
        triggers_cooling_period, block_after_tier,
        is_default, is_active, sort_order,
        salary_min, salary_max, auto_assign
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        validated.rule_name,
        validated.rule_code || null,
        validated.description || null,
        validated.calculation_mode,
        validated.percentage_tiers ? JSON.stringify(validated.percentage_tiers) : null,
        validated.fixed_amount_tiers ? JSON.stringify(validated.fixed_amount_tiers) : null,
        validated.first_time_percentage,
        validated.max_regular_cap,
        validated.premium_limit,
        validated.premium_tenure_months,
        validated.triggers_cooling_period,
        validated.block_after_tier,
        validated.is_default,
        validated.is_active,
        validated.sort_order,
        validated.salary_min,
        validated.salary_max,
        validated.auto_assign
      ]
    );
    res.status(201).json({
      success: true,
      message: 'Credit limit rule created successfully',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Create credit limit rule error:', error);
    res.status(500).json({ success: false, message: 'Failed to create credit limit rule' });
  }
});

/**
 * PUT /api/admin/credit-limit-rules/:id - Update rule
 */
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;
    const validated = validateRuleBody(req.body, true);

    const existing = await executeQuery('SELECT id FROM credit_limit_rules WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Credit limit rule not found' });
    }

    if (validated.rule_code !== undefined && validated.rule_code) {
      const dup = await executeQuery(
        'SELECT id FROM credit_limit_rules WHERE rule_code = ? AND id != ?',
        [validated.rule_code, id]
      );
      if (dup && dup.length > 0) {
        return res.status(400).json({ success: false, message: 'A rule with this rule_code already exists' });
      }
    }

    if (validated.is_default === 1) {
      await executeQuery('UPDATE credit_limit_rules SET is_default = 0 WHERE is_default = 1 AND id != ?', [id]);
    }

    const updates = [];
    const values = [];
    const jsonFields = ['percentage_tiers', 'fixed_amount_tiers'];
    const fields = [
      'rule_name', 'rule_code', 'description', 'calculation_mode',
      'percentage_tiers', 'fixed_amount_tiers',
      'first_time_percentage', 'max_regular_cap', 'premium_limit', 'premium_tenure_months',
      'triggers_cooling_period', 'block_after_tier',
      'is_default', 'is_active', 'sort_order',
      'salary_min', 'salary_max', 'auto_assign'
    ];
    for (const key of fields) {
      if (validated[key] !== undefined) {
        updates.push(`${key} = ?`);
        const val = jsonFields.includes(key)
          ? (validated[key] != null ? JSON.stringify(validated[key]) : null)
          : validated[key];
        values.push(val);
      }
    }
    if (updates.length === 0) {
      return res.json({ success: true, message: 'Nothing to update' });
    }
    values.push(id);
    await executeQuery(
      `UPDATE credit_limit_rules SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );
    res.json({ success: true, message: 'Credit limit rule updated successfully' });
  } catch (error) {
    console.error('Update credit limit rule error:', error);
    res.status(500).json({ success: false, message: 'Failed to update credit limit rule' });
  }
});

/**
 * PATCH /api/admin/credit-limit-rules/:id/toggle - Toggle is_active
 */
router.patch('/:id/toggle', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;
    const rows = await executeQuery('SELECT id, is_active, is_default FROM credit_limit_rules WHERE id = ?', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Credit limit rule not found' });
    }
    if (rows[0].is_default === 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate the default rule. Set another rule as default first.'
      });
    }
    const newActive = rows[0].is_active ? 0 : 1;
    await executeQuery(
      'UPDATE credit_limit_rules SET is_active = ?, updated_at = NOW() WHERE id = ?',
      [newActive, id]
    );
    res.json({
      success: true,
      message: newActive ? 'Rule activated' : 'Rule deactivated',
      data: { is_active: newActive }
    });
  } catch (error) {
    console.error('Toggle credit limit rule error:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle rule' });
  }
});

/**
 * PATCH /api/admin/credit-limit-rules/:id/set-default - Set this rule as default
 */
router.patch('/:id/set-default', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;
    const rows = await executeQuery('SELECT id FROM credit_limit_rules WHERE id = ? AND is_active = 1', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Credit limit rule not found or inactive' });
    }
    await executeQuery('UPDATE credit_limit_rules SET is_default = 0');
    await executeQuery('UPDATE credit_limit_rules SET is_default = 1, updated_at = NOW() WHERE id = ?', [id]);
    res.json({ success: true, message: 'Default credit limit rule updated' });
  } catch (error) {
    console.error('Set default credit limit rule error:', error);
    res.status(500).json({ success: false, message: 'Failed to set default rule' });
  }
});

/**
 * DELETE /api/admin/credit-limit-rules/:id - Delete rule (unassign users first)
 */
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;
    const rows = await executeQuery('SELECT id, is_default FROM credit_limit_rules WHERE id = ?', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Credit limit rule not found' });
    }
    if (rows[0].is_default === 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the default rule. Set another rule as default first.'
      });
    }
    await executeQuery('UPDATE users SET credit_limit_rule_id = NULL WHERE credit_limit_rule_id = ?', [id]);
    await executeQuery('DELETE FROM credit_limit_rules WHERE id = ?', [id]);
    res.json({ success: true, message: 'Credit limit rule deleted successfully' });
  } catch (error) {
    console.error('Delete credit limit rule error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete credit limit rule' });
  }
});

module.exports = router;

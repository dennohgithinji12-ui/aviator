/**
 * ShiftStack Aviator SQLite Database Module
 * Uses Node.js native DatabaseSync (node:sqlite) for zero-dependency,
 * ACID-compliant, persistent storage of:
 * - Users & Auth credentials
 * - Real Money Balances (M-PESA) & Demo Balances (50,000 KES Demo Bankroll per Account)
 * - PayHero M-PESA Deposits Ledger (Min 49 Bob)
 * - Real Money & Demo Game Bets Ledger
 * - Password Reset Rate Limiter (strictly max 2 resets per rolling week)
 */

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'shiftstack.db');
const db = new DatabaseSync(DB_PATH);

// Initialize Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firebase_uid TEXT,
    phone TEXT UNIQUE NOT NULL,
    username TEXT,
    password_hash TEXT,
    real_balance REAL DEFAULT 0.0,
    demo_balance REAL DEFAULT 50000.0,
    created_at INTEGER NOT NULL,
    last_login INTEGER
  );

  CREATE TABLE IF NOT EXISTS deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL, -- 'PENDING', 'SUCCESS', 'FAILED'
    receipt_number TEXT,
    created_at INTEGER NOT NULL,
    completed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    mode TEXT NOT NULL, -- 'REAL' or 'DEMO'
    terminal_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    round_nonce INTEGER NOT NULL,
    cashed_out INTEGER DEFAULT 0,
    multiplier REAL DEFAULT 0.0,
    payout REAL DEFAULT 0.0,
    profit REAL DEFAULT 0.0,
    status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'WON', 'LOST', 'CANCELLED'
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  );

  -- Withdrawals Table (With 5% Gaming Withholding Tax Enforcement)
  CREATE TABLE IF NOT EXISTS withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    phone TEXT NOT NULL,
    amount REAL NOT NULL,
    tax_amount REAL DEFAULT 0,
    net_amount REAL DEFAULT 0,
    tax_rate REAL DEFAULT 0.05,
    reference TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL, -- 'REQUESTED', 'PROCESSING', 'SETTLED', 'MANUAL_HOLD_HIGH_VALUE', 'MANUAL_HOLD_VELOCITY', 'REJECTED'
    risk_score INTEGER DEFAULT 0,
    risk_reason TEXT,
    created_at INTEGER NOT NULL,
    completed_at INTEGER
  );

  -- PayHero STK Push Attempts Tracker (Sliding Rate Limits & Abuse Protection)
  CREATE TABLE IF NOT EXISTS stk_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    status TEXT NOT NULL, -- 'SUCCESS', 'FAILED', 'CANCELLED'
    timestamp INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
  CREATE INDEX IF NOT EXISTS idx_deposits_ref ON deposits(reference);
  CREATE INDEX IF NOT EXISTS idx_deposits_phone ON deposits(phone);
  CREATE INDEX IF NOT EXISTS idx_bets_phone ON bets(phone);
  CREATE INDEX IF NOT EXISTS idx_withdrawals_phone ON withdrawals(phone);
  CREATE INDEX IF NOT EXISTS idx_withdrawals_ref ON withdrawals(reference);
  CREATE INDEX IF NOT EXISTS idx_stk_attempts_phone ON stk_attempts(phone, timestamp);
  CREATE INDEX IF NOT EXISTS idx_resets_phone_time ON password_resets(phone, timestamp);
`);

// Safe migration for firebase_uid column if table already exists
try {
  db.exec("ALTER TABLE users ADD COLUMN firebase_uid TEXT;");
} catch (e) {
  // column already exists
}

// Safe migrations for 5% Withholding Gaming Tax columns in withdrawals
try { db.exec("ALTER TABLE withdrawals ADD COLUMN tax_amount REAL DEFAULT 0;"); } catch (e) {}
try { db.exec("ALTER TABLE withdrawals ADD COLUMN net_amount REAL DEFAULT 0;"); } catch (e) {}
try { db.exec("ALTER TABLE withdrawals ADD COLUMN tax_rate REAL DEFAULT 0.05;"); } catch (e) {}

// Safe migrations for Promos (KES 20 Signup Bonus & 500-for-100 Casino Stake Bonus)
try { db.exec("ALTER TABLE users ADD COLUMN signup_bonus_claimed INTEGER DEFAULT 0;"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN casino_bonus_claimed INTEGER DEFAULT 0;"); } catch (e) {}

function normalizePhone(raw) {
  if (!raw) return '';
  let phone = String(raw).trim().replace(/[^\d+]/g, '');
  if (phone.startsWith('07') || phone.startsWith('01')) {
    phone = '254' + phone.substring(1);
  } else if (phone.startsWith('+254')) {
    phone = phone.substring(1);
  } else if (!phone.startsWith('254') && phone.length === 9) {
    phone = '254' + phone;
  }
  return phone;
}

// Clean database mode: No test accounts auto-seeded

const DatabaseService = {
  db,

  // --- USER & WALLET MANAGEMENT ---

  getUser(phone) {
    const norm = normalizePhone(phone);
    if (!norm) return null;
    const stmt = db.prepare('SELECT * FROM users WHERE phone = ?');
    return stmt.get(norm) || null;
  },

  getOrCreateUser(phone, username = null, password = 'password') {
    const norm = normalizePhone(phone);
    if (!norm) return null;
    let user = this.getUser(norm);
    if (!user) {
      const uname = username || `pilot_${norm.slice(-4)}`;
      const stmt = db.prepare(`
        INSERT INTO users (phone, username, password_hash, real_balance, demo_balance, created_at, last_login)
        VALUES (?, ?, ?, 0.0, 50000.0, ?, ?)
      `);
      const now = Date.now();
      stmt.run(norm, uname, password, now, now);
      user = this.getUser(norm);
    }
    return user;
  },

  registerPhoneUser(phone, firebaseUid = null, username = null, passwordHash = null) {
    const norm = normalizePhone(phone);
    if (!norm) return null;
    let user = this.getUser(norm);
    const now = Date.now();
    const uname = username || `pilot_${norm.slice(-4)}`;
    if (!user) {
      const stmt = db.prepare(`
        INSERT INTO users (phone, firebase_uid, username, password_hash, real_balance, demo_balance, created_at, last_login)
        VALUES (?, ?, ?, ?, 0.0, 50000.0, ?, ?)
      `);
      stmt.run(norm, firebaseUid, uname, passwordHash, now, now);
      user = this.getUser(norm);
    } else {
      const stmt = db.prepare(`
        UPDATE users 
        SET firebase_uid = COALESCE(?, firebase_uid),
            password_hash = COALESCE(?, password_hash),
            last_login = ?
        WHERE phone = ?
      `);
      stmt.run(firebaseUid, passwordHash, now, norm);
      user = this.getUser(norm);
    }
    return user;
  },

  updatePassword(phone, passwordHash) {
    const norm = normalizePhone(phone);
    if (!norm) return false;
    const now = Date.now();
    const stmt = db.prepare(`
      UPDATE users 
      SET password_hash = ?, last_login = ?
      WHERE phone = ?
    `);
    const result = stmt.run(passwordHash, now, norm);
    return result.changes > 0;
  },

  getBalances(phone) {
    const norm = normalizePhone(phone);
    if (!norm) {
      return { phone: '', realBalance: 0.0, demoBalance: 50000.0, signupBonusClaimed: false, casinoBonusClaimed: false };
    }
    const user = this.getUser(norm);
    if (user) {
      return {
        phone: user.phone,
        username: user.username,
        realBalance: parseFloat(user.real_balance || 0),
        demoBalance: parseFloat(user.demo_balance || 50000),
        signupBonusClaimed: !!user.signup_bonus_claimed,
        casinoBonusClaimed: !!user.casino_bonus_claimed
      };
    }
    return { phone: norm, realBalance: 0.0, demoBalance: 50000.0, signupBonusClaimed: false, casinoBonusClaimed: false };
  },

  claimSignupBonus(phone) {
    const norm = normalizePhone(phone);
    if (!norm) return { success: false, error: 'PHONE_REQUIRED', message: 'Valid phone required' };
    const user = this.getUser(norm);
    if (!user) return { success: false, error: 'USER_NOT_FOUND', message: 'Account not found. Please register first.' };
    if (user.signup_bonus_claimed) {
      return { success: false, error: 'ALREADY_CLAIMED', message: 'Signup bonus of KES 20 has already been claimed for this account.' };
    }

    const now = Date.now();
    const ref = `SIGNUP_BONUS_${norm}_${now}`;
    
    // Credit KES 20 and mark as claimed
    const updateStmt = db.prepare('UPDATE users SET real_balance = real_balance + 20, signup_bonus_claimed = 1 WHERE phone = ?');
    updateStmt.run(norm);

    const depStmt = db.prepare(`
      INSERT INTO deposits (reference, phone, amount, status, receipt_number, created_at, completed_at)
      VALUES (?, ?, 20, 'SUCCESS', 'SIGNUP_FREEBET_20', ?, ?)
    `);
    depStmt.run(ref, norm, now, now);

    const updated = this.getUser(norm);
    return {
      success: true,
      amount: 20,
      realBalance: parseFloat(updated.real_balance || 0),
      message: '🎉 Congratulations! KES 20.00 Signup Freebet credited to your account!'
    };
  },

  claimCasinoStakeBonus(phone) {
    const norm = normalizePhone(phone);
    if (!norm) return { success: false, error: 'PHONE_REQUIRED', message: 'Valid phone required' };
    const user = this.getUser(norm);
    if (!user) return { success: false, error: 'USER_NOT_FOUND', message: 'Account not found' };
    if (user.casino_bonus_claimed) {
      return { success: false, error: 'ALREADY_CLAIMED', message: 'KES 100 Casino Bonus has already been claimed for this account.' };
    }

    const turnover = this.getTotalTurnover(norm);
    if (turnover < 500) {
      return {
        success: false,
        error: 'INSUFFICIENT_TURNOVER',
        turnover,
        required: 500,
        message: `You need KES 500 total stakes to unlock this bonus. Current progress: KES ${turnover.toFixed(2)} / 500.00`
      };
    }

    const now = Date.now();
    const ref = `CASINO_BONUS_100_${norm}_${now}`;
    
    const updateStmt = db.prepare('UPDATE users SET real_balance = real_balance + 100, casino_bonus_claimed = 1 WHERE phone = ?');
    updateStmt.run(norm);

    const depStmt = db.prepare(`
      INSERT INTO deposits (reference, phone, amount, status, receipt_number, created_at, completed_at)
      VALUES (?, ?, 100, 'SUCCESS', 'CASINO_BONUS_100', ?, ?)
    `);
    depStmt.run(ref, norm, now, now);

    const updated = this.getUser(norm);
    return {
      success: true,
      amount: 100,
      realBalance: parseFloat(updated.real_balance || 0),
      message: '🎰 Awesome! KES 100.00 Casino Bonus Freebet credited to your wallet!'
    };
  },

  updateBalance(phone, mode, delta) {
    const norm = normalizePhone(phone);
    if (!norm) return null;
    this.getOrCreateUser(norm);

    const isReal = (mode === 'REAL');
    const col = isReal ? 'real_balance' : 'demo_balance';

    // Atomic update
    const stmt = db.prepare(`
      UPDATE users 
      SET ${col} = MAX(0.0, ${col} + ?)
      WHERE phone = ?
    `);
    stmt.run(delta, norm);

    const updated = this.getUser(norm);
    return {
      phone: norm,
      mode: isReal ? 'REAL' : 'DEMO',
      realBalance: parseFloat(updated.real_balance),
      demoBalance: parseFloat(updated.demo_balance)
    };
  },

  setBalance(phone, mode, amount) {
    const norm = normalizePhone(phone);
    if (!norm) return null;
    this.getOrCreateUser(norm);

    const isReal = (mode === 'REAL');
    const col = isReal ? 'real_balance' : 'demo_balance';

    const stmt = db.prepare(`
      UPDATE users 
      SET ${col} = ?
      WHERE phone = ?
    `);
    stmt.run(Math.max(0, amount), norm);

    const updated = this.getUser(norm);
    return {
      phone: norm,
      mode: isReal ? 'REAL' : 'DEMO',
      realBalance: parseFloat(updated.real_balance),
      demoBalance: parseFloat(updated.demo_balance)
    };
  },

  // --- PAYHERO DEPOSITS LEDGER (Min 49 Bob) ---

  createDeposit(reference, phone, amount) {
    const norm = normalizePhone(phone);
    const stmt = db.prepare(`
      INSERT INTO deposits (reference, phone, amount, status, created_at)
      VALUES (?, ?, ?, 'PENDING', ?)
    `);
    stmt.run(reference, norm, amount, Date.now());
    return {
      reference,
      phone: norm,
      amount,
      status: 'PENDING',
      createdAt: Date.now()
    };
  },

  getDeposit(reference) {
    const stmt = db.prepare('SELECT * FROM deposits WHERE reference = ?');
    return stmt.get(reference) || null;
  },

  getDepositByReceipt(receiptNumber) {
    if (!receiptNumber) return null;
    const stmt = db.prepare('SELECT * FROM deposits WHERE receipt_number = ? COLLATE NOCASE');
    return stmt.get(receiptNumber) || null;
  },

  completeDeposit(reference, receiptNumber = null) {
    const dep = this.getDeposit(reference);
    if (!dep) return null;

    if (dep.status === 'SUCCESS') {
      return dep; // already completed
    }

    const receipt = receiptNumber || ('NL' + Math.random().toString(36).substring(2, 9).toUpperCase());
    const now = Date.now();

    // 1. Mark deposit SUCCESS in database
    const updateDep = db.prepare(`
      UPDATE deposits
      SET status = 'SUCCESS', receipt_number = ?, completed_at = ?
      WHERE reference = ?
    `);
    updateDep.run(receipt, now, reference);

    // 2. Automatically credit user's real_balance in SQLite
    const user = this.getOrCreateUser(dep.phone);
    const updateBal = db.prepare(`
      UPDATE users
      SET real_balance = real_balance + ?
      WHERE phone = ?
    `);
    updateBal.run(dep.amount, dep.phone);

    console.log(`[SQLite Database] Successfully credited KES ${dep.amount} to user ${dep.phone}. Receipt: ${receipt}`);

    return {
      reference,
      phone: dep.phone,
      amount: dep.amount,
      status: 'SUCCESS',
      receiptNumber: receipt,
      completedAt: now
    };
  },

  failDeposit(reference) {
    const stmt = db.prepare(`
      UPDATE deposits
      SET status = 'FAILED', completed_at = ?
      WHERE reference = ?
    `);
    stmt.run(Date.now(), reference);
  },

  getRecentDeposits(phone, limit = 10) {
    const norm = normalizePhone(phone);
    const stmt = db.prepare(`
      SELECT * FROM deposits 
      WHERE phone = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    return stmt.all(norm, limit);
  },

  // --- GAME BETS LEDGER ---

  recordBet(phone, mode, terminalId, amount, roundNonce) {
    const norm = normalizePhone(phone);
    const stmt = db.prepare(`
      INSERT INTO bets (phone, mode, terminal_id, amount, round_nonce, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)
    `);
    const now = Date.now();
    stmt.run(norm, mode, terminalId, amount, roundNonce, now);

    const lastId = db.prepare('SELECT last_insert_rowid() as id').get().id;
    return lastId;
  },

  settleBet(betId, multiplier, payout, profit) {
    const stmt = db.prepare(`
      UPDATE bets
      SET cashed_out = 1, multiplier = ?, payout = ?, profit = ?, status = 'WON'
      WHERE id = ?
    `);
    stmt.run(multiplier, payout, profit, betId);
  },

  cancelBet(betId) {
    const stmt = db.prepare(`
      UPDATE bets
      SET status = 'CANCELLED'
      WHERE id = ?
    `);
    stmt.run(betId);
  },

  markLostBet(betId) {
    const stmt = db.prepare(`
      UPDATE bets
      SET status = 'LOST'
      WHERE id = ? AND cashed_out = 0
    `);
    stmt.run(betId);
  },

  // --- PASSWORD RESET RATE LIMITER (Strict Max 2x / Week) ---

  checkResetRateLimit(phone) {
    const norm = normalizePhone(phone);
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    const stmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM password_resets 
      WHERE phone = ? AND timestamp > ?
    `);
    const result = stmt.get(norm, sevenDaysAgo);
    const count = result ? result.count : 0;
    const maxAllowed = 2;

    return {
      allowed: count < maxAllowed,
      attemptsInPastWeek: count,
      remainingResets: Math.max(0, maxAllowed - count),
      maxAllowed: maxAllowed
    };
  },

  recordResetAttempt(phone) {
    const norm = normalizePhone(phone);
    const stmt = db.prepare(`
      INSERT INTO password_resets (phone, timestamp)
      VALUES (?, ?)
    `);
    stmt.run(norm, Date.now());
  },

  // --- WITHDRAWALS & AUTOMATED RISK ENGINE (NotebookLM Blueprint) ---

  createWithdrawal(phone, amount, reference, status = 'PROCESSING', riskScore = 0, riskReason = '', taxAmount = 0, netAmount = null) {
    const norm = normalizePhone(phone);
    const user = this.getUser(norm);
    const userId = user ? user.id : null;
    const now = Date.now();
    const net = (netAmount !== null) ? netAmount : Math.max(0, Math.round((amount - taxAmount) * 100) / 100);
    const tax = Math.round(taxAmount * 100) / 100;
    const stmt = db.prepare(`
      INSERT INTO withdrawals (user_id, phone, amount, tax_amount, net_amount, reference, status, risk_score, risk_reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(userId, norm, amount, tax, net, reference, status, riskScore, riskReason, now);

    return {
      reference,
      phone: norm,
      grossAmount: amount,
      taxAmount: tax,
      netAmount: net,
      status,
      riskScore,
      riskReason,
      createdAt: now
    };
  },

  getDailyWithdrawalCount(phone) {
    const norm = normalizePhone(phone);
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const stmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM withdrawals 
      WHERE phone = ? AND created_at > ?
    `);
    const row = stmt.get(norm, oneDayAgo);
    return row ? row.count : 0;
  },

  getTotalDeposits(phone) {
    const norm = normalizePhone(phone);
    const stmt = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM deposits 
      WHERE phone = ? AND status = 'SUCCESS'
    `);
    const row = stmt.get(norm);
    return row ? row.total : 0;
  },

  getTotalTurnover(phone) {
    const norm = normalizePhone(phone);
    const stmt = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM bets 
      WHERE phone = ? AND mode = 'REAL'
    `);
    const row = stmt.get(norm);
    return row ? row.total : 0;
  },

  getWithdrawals(phone, limit = 10) {
    const norm = normalizePhone(phone);
    const stmt = db.prepare(`
      SELECT * FROM withdrawals 
      WHERE phone = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    return stmt.all(norm, limit);
  },

  // --- PAYHERO STK PUSH SLIDING ANTI-ABUSE ENGINE (NotebookLM Section 5.2) ---

  recordStkAttempt(phone, status = 'PENDING') {
    const norm = normalizePhone(phone);
    const stmt = db.prepare(`
      INSERT INTO stk_attempts (phone, status, timestamp)
      VALUES (?, ?, ?)
    `);
    stmt.run(norm, status, Date.now());
  },

  checkStkRateLimit(phone) {
    const norm = normalizePhone(phone);
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    // Rule 1: Max 3 STK attempts per 5 minutes per phone
    const stmtRecent = db.prepare(`
      SELECT COUNT(*) as count 
      FROM stk_attempts 
      WHERE phone = ? AND timestamp > ?
    `);
    const recentCount = stmtRecent.get(norm, fiveMinutesAgo)?.count || 0;
    if (recentCount >= 3) {
      return {
        allowed: false,
        reason: 'RATE_LIMIT_5M',
        message: 'Too many deposit requests. Please wait 5 minutes before initiating another STK push.'
      };
    }

    // Rule 2: >10 successive failed/cancelled STK requests within 24h blocks phone for 24 hours
    const stmtDailyFails = db.prepare(`
      SELECT COUNT(*) as count 
      FROM stk_attempts 
      WHERE phone = ? AND status IN ('FAILED', 'CANCELLED') AND timestamp > ?
    `);
    const failCount = stmtDailyFails.get(norm, oneDayAgo)?.count || 0;
    if (failCount >= 10) {
      return {
        allowed: false,
        reason: 'BLOCKED_24H_EXCESSIVE_FAILURES',
        message: 'Security Notice: This phone has exceeded maximum failed deposit attempts. Suspended for 24 hours per PayHero anti-abuse policy.'
      };
    }

    return { allowed: true };
  },

  // --- DATABASE HEALTH & REPORTING ---

  getStats() {
    const usersCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const depositsTotal = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM deposits WHERE status = 'SUCCESS'").get();
    const withdrawalsTotal = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM withdrawals WHERE status IN ('PROCESSING', 'SETTLED')").get();
    const betsTotal = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as volume FROM bets').get();

    return {
      databaseEngine: 'node:sqlite (SQLite3)',
      databaseFile: DB_PATH,
      totalUsers: usersCount,
      successfulDepositsCount: depositsTotal.count,
      totalDepositedKes: depositsTotal.total,
      withdrawalsCount: withdrawalsTotal.count,
      totalWithdrawnKes: withdrawalsTotal.total,
      totalBetsPlaced: betsTotal.count,
      totalStakingVolumeKes: betsTotal.volume
    };
  }
};

module.exports = DatabaseService;

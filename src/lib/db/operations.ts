import { prisma } from '../db';

function normalizePhone(raw: string): string {
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

// User Operations
export async function getUser(phone: string) {
  const norm = normalizePhone(phone);
  if (!norm) return null;
  return await prisma.user.findUnique({
    where: { phone: norm }
  });
}

export async function getOrCreateUser(phone: string, username?: string) {
  const norm = normalizePhone(phone);
  if (!norm) return null;
  let user = await getUser(norm);
  if (!user) {
    const uname = username || `pilot_${norm.slice(-4)}`;
    const now = BigInt(Date.now());
    user = await prisma.user.create({
      data: {
        phone: norm,
        username: uname,
        passwordHash: 'password',
        realBalance: 0,
        demoBalance: 50000,
        createdAt: now,
        lastLogin: now
      }
    });
  }
  return user;
}

export async function registerPhoneUser(
  phone: string,
  firebaseUid?: string | null,
  username?: string | null,
  passwordHash?: string | null
) {
  const norm = normalizePhone(phone);
  if (!norm) return null;
  let user = await getUser(norm);
  const now = BigInt(Date.now());
  const uname = username || `pilot_${norm.slice(-4)}`;

  if (!user) {
    user = await prisma.user.create({
      data: {
        phone: norm,
        firebaseUid,
        username: uname,
        passwordHash,
        realBalance: 0,
        demoBalance: 50000,
        createdAt: now,
        lastLogin: now
      }
    });
  } else {
    user = await prisma.user.update({
      where: { phone: norm },
      data: {
        firebaseUid: firebaseUid || user.firebaseUid,
        passwordHash: passwordHash || user.passwordHash,
        lastLogin: now
      }
    });
  }
  return user;
}

export async function updatePassword(phone: string, passwordHash: string) {
  const norm = normalizePhone(phone);
  if (!norm) return false;
  const now = BigInt(Date.now());
  const result = await prisma.user.updateMany({
    where: { phone: norm },
    data: {
      passwordHash,
      lastLogin: now
    }
  });
  return result.count > 0;
}

export async function getBalances(phone: string) {
  const norm = normalizePhone(phone);
  if (!norm) {
    return {
      phone: '',
      realBalance: 0,
      demoBalance: 50000,
      signupBonusClaimed: false,
      casinoBonusClaimed: false
    };
  }
  const user = await getUser(norm);
  if (user) {
    return {
      phone: user.phone,
      username: user.username,
      realBalance: Number(user.realBalance),
      demoBalance: Number(user.demoBalance),
      signupBonusClaimed: user.signupBonusClaimed,
      casinoBonusClaimed: user.casinoBonusClaimed
    };
  }
  return {
    phone: norm,
    realBalance: 0,
    demoBalance: 50000,
    signupBonusClaimed: false,
    casinoBonusClaimed: false
  };
}

export async function updateBalance(phone: string, mode: 'REAL' | 'DEMO', delta: number) {
  const norm = normalizePhone(phone);
  if (!norm) return null;
  await getOrCreateUser(norm);

  const isReal = mode === 'REAL';
  const updateData = isReal
    ? { realBalance: { increment: delta } }
    : { demoBalance: { increment: delta } };

  const updated = await prisma.user.update({
    where: { phone: norm },
    data: updateData
  });

  return {
    phone: norm,
    mode: isReal ? 'REAL' : 'DEMO',
    realBalance: Number(updated.realBalance),
    demoBalance: Number(updated.demoBalance)
  };
}

export async function setBalance(phone: string, mode: 'REAL' | 'DEMO', amount: number) {
  const norm = normalizePhone(phone);
  if (!norm) return null;
  await getOrCreateUser(norm);

  const isReal = mode === 'REAL';
  const updateData = isReal
    ? { realBalance: Math.max(0, amount) }
    : { demoBalance: Math.max(0, amount) };

  const updated = await prisma.user.update({
    where: { phone: norm },
    data: updateData
  });

  return {
    phone: norm,
    mode: isReal ? 'REAL' : 'DEMO',
    realBalance: Number(updated.realBalance),
    demoBalance: Number(updated.demoBalance)
  };
}

// Deposit Operations
export async function createDeposit(reference: string, phone: string, amount: number) {
  const norm = normalizePhone(phone);
  const now = BigInt(Date.now());
  return await prisma.deposit.create({
    data: {
      reference,
      phone: norm,
      amount,
      status: 'PENDING',
      createdAt: now
    }
  });
}

export async function getDeposit(reference: string) {
  return await prisma.deposit.findUnique({
    where: { reference }
  });
}

export async function getDepositByReceipt(receiptNumber: string) {
  if (!receiptNumber) return null;
  return await prisma.deposit.findFirst({
    where: { receiptNumber }
  });
}

export async function completeDeposit(reference: string, receiptNumber?: string) {
  const receipt = receiptNumber || ('NL' + Math.random().toString(36).substring(2, 9).toUpperCase());
  const now = BigInt(Date.now());
  return prisma.$transaction(async (tx) => {
    const deposit = await tx.deposit.findUnique({ where: { reference } });
    if (!deposit) return null;
    if (deposit.status === 'SUCCESS') return deposit;

    const changed = await tx.deposit.updateMany({
      where: { id: deposit.id, status: { not: 'SUCCESS' } },
      data: { status: 'SUCCESS', receiptNumber: receipt, completedAt: now, failureReason: null }
    });
    if (!changed.count) return tx.deposit.findUnique({ where: { reference } });

    const user = await tx.user.update({ where: { phone: deposit.phone }, data: { realBalance: { increment: deposit.amount } } });
    const balanceAfter = Number(user.realBalance);
    await tx.walletTransaction.create({ data: {
      phone: deposit.phone, reference: `DEPOSIT_${deposit.reference}`, type: 'DEPOSIT_CREDIT', mode: 'REAL', amount: deposit.amount,
      balanceBefore: balanceAfter - Number(deposit.amount), balanceAfter, createdAt: BigInt(Date.now()), metadata: { depositReference: deposit.reference, receiptNumber: receipt }
    } });
    return tx.deposit.findUnique({ where: { reference } });
  });
}

export async function updateDepositProviderDetails(reference: string, providerReference?: string, checkoutRequestId?: string) {
  return prisma.deposit.updateMany({
    where: { reference },
    data: {
      ...(providerReference ? { providerReference } : {}),
      ...(checkoutRequestId ? { checkoutRequestId } : {})
    }
  });
}

export async function failDeposit(reference: string) {
  const now = BigInt(Date.now());
  await prisma.deposit.update({
    where: { reference },
    data: {
      status: 'FAILED',
      completedAt: now
    }
  });
}

export async function getRecentDeposits(phone: string, limit: number = 10) {
  const norm = normalizePhone(phone);
  return await prisma.deposit.findMany({
    where: { phone: norm },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
}

// Bet Operations
export async function recordBet(
  phone: string,
  mode: string,
  terminalId: number,
  amount: number,
  roundNonce: number
) {
  const norm = normalizePhone(phone);
  const now = BigInt(Date.now());
  const bet = await prisma.bet.create({
    data: {
      phone: norm,
      mode,
      terminalId,
      amount,
      roundNonce,
      status: 'ACTIVE',
      createdAt: now
    }
  });
  return bet.id;
}

export async function settleBet(betId: number, multiplier: number, payout: number, profit: number) {
  await prisma.bet.update({
    where: { id: betId },
    data: {
      cashedOut: 1,
      multiplier,
      payout,
      profit,
      status: 'WON'
    }
  });
}

export async function cancelBet(betId: number) {
  await prisma.bet.update({
    where: { id: betId },
    data: {
      status: 'CANCELLED'
    }
  });
}

export async function markLostBet(betId: number) {
  await prisma.bet.updateMany({
    where: {
      id: betId,
      cashedOut: 0
    },
    data: {
      status: 'LOST'
    }
  });
}

// Password Reset Operations
export async function checkResetRateLimit(phone: string) {
  const norm = normalizePhone(phone);
  const sevenDaysAgo = BigInt(Date.now() - (7 * 24 * 60 * 60 * 1000));

  const count = await prisma.passwordReset.count({
    where: {
      phone: norm,
      timestamp: { gt: sevenDaysAgo }
    }
  });

  const maxAllowed = 2;

  return {
    allowed: count < maxAllowed,
    attemptsInPastWeek: count,
    remainingResets: Math.max(0, maxAllowed - count),
    maxAllowed
  };
}

export async function recordResetAttempt(phone: string) {
  const norm = normalizePhone(phone);
  await prisma.passwordReset.create({
    data: {
      phone: norm,
      timestamp: BigInt(Date.now())
    }
  });
}

// Withdrawal Operations
export async function createWithdrawal(
  phone: string,
  amount: number,
  reference: string,
  status: string = 'PROCESSING',
  riskScore: number = 0,
  riskReason: string = '',
  taxAmount: number = 0,
  netAmount: number | null = null
) {
  const norm = normalizePhone(phone);
  const user = await getUser(norm);
  const userId = user?.id;
  const now = BigInt(Date.now());
  const net = netAmount !== null ? netAmount : Math.max(0, Math.round((amount - taxAmount) * 100) / 100);
  const tax = Math.round(taxAmount * 100) / 100;

  return await prisma.withdrawal.create({
    data: {
      userId,
      phone: norm,
      amount,
      taxAmount: tax,
      netAmount: net,
      taxRate: 0.05,
      reference,
      status,
      riskScore,
      riskReason,
      createdAt: now
    }
  });
}

export async function getDailyWithdrawalCount(phone: string) {
  const norm = normalizePhone(phone);
  const oneDayAgo = BigInt(Date.now() - (24 * 60 * 60 * 1000));

  const result = await prisma.withdrawal.count({
    where: {
      phone: norm,
      createdAt: { gt: oneDayAgo }
    }
  });

  return result;
}

export async function getTotalDeposits(phone: string) {
  const norm = normalizePhone(phone);
  const result = await prisma.deposit.aggregate({
    where: {
      phone: norm,
      status: 'SUCCESS'
    },
    _sum: {
      amount: true
    }
  });
  return Number(result._sum.amount || 0);
}

export async function getTotalTurnover(phone: string) {
  const norm = normalizePhone(phone);
  const result = await prisma.bet.aggregate({
    where: {
      phone: norm,
      mode: 'REAL'
    },
    _sum: {
      amount: true
    }
  });
  return Number(result._sum.amount || 0);
}

export async function getWithdrawals(phone: string, limit: number = 10) {
  const norm = normalizePhone(phone);
  return await prisma.withdrawal.findMany({
    where: { phone: norm },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
}

// STK Attempt Operations
export async function recordStkAttempt(phone: string, status: string = 'PENDING') {
  const norm = normalizePhone(phone);
  await prisma.stkAttempt.create({
    data: {
      phone: norm,
      status,
      timestamp: BigInt(Date.now())
    }
  });
}

export async function checkStkRateLimit(phone: string) {
  const norm = normalizePhone(phone);
  const now = Date.now();
  const fiveMinutesAgo = BigInt(now - (5 * 60 * 1000));
  const oneDayAgo = BigInt(now - (24 * 60 * 60 * 1000));

  const recentCount = await prisma.stkAttempt.count({
    where: {
      phone: norm,
      timestamp: { gt: fiveMinutesAgo }
    }
  });

  if (recentCount >= 3) {
    return {
      allowed: false,
      reason: 'RATE_LIMIT_5M',
      message: 'Too many deposit requests. Please wait 5 minutes before initiating another STK push.'
    };
  }

  const failCount = await prisma.stkAttempt.count({
    where: {
      phone: norm,
      status: { in: ['FAILED', 'CANCELLED'] },
      timestamp: { gt: oneDayAgo }
    }
  });

  if (failCount >= 10) {
    return {
      allowed: false,
      reason: 'BLOCKED_24H_EXCESSIVE_FAILURES',
      message: 'Security Notice: This phone has exceeded maximum failed deposit attempts. Suspended for 24 hours.'
    };
  }

  return { allowed: true };
}

// Bonus Operations
export async function claimSignupBonus(phone: string) {
  const norm = normalizePhone(phone);
  if (!norm) {
    return { success: false, error: 'PHONE_REQUIRED', message: 'Valid phone required' };
  }

  const user = await getUser(norm);
  if (!user) {
    return { success: false, error: 'USER_NOT_FOUND', message: 'Account not found' };
  }

  const now = BigInt(Date.now());
  const ref = `SIGNUP_BONUS_${norm}_${now}`;
  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.user.updateMany({
      where: { phone: norm, signupBonusClaimed: false },
      data: { realBalance: { increment: 20 }, signupBonusClaimed: true }
    });
    if (!claimed.count) return null;
    const credited = await tx.user.findUniqueOrThrow({ where: { phone: norm } });
    const balanceAfter = Number(credited.realBalance);
    await tx.deposit.create({ data: {
      reference: ref, phone: norm, amount: 20, status: 'SUCCESS', receiptNumber: 'SIGNUP_FREEBET_20', createdAt: now, completedAt: now
    } });
    await tx.walletTransaction.create({ data: {
      phone: norm, reference: ref, type: 'PROMO_CREDIT', mode: 'REAL', amount: 20,
      balanceBefore: balanceAfter - 20, balanceAfter, createdAt: now, metadata: { promo: 'SIGNUP_FREEBET_20' }
    } });
    return credited;
  });
  if (!updated) return { success: false, error: 'ALREADY_CLAIMED', message: 'Signup bonus of KES 20 has already been claimed for this account.' };
  return {
    success: true,
    amount: 20,
    realBalance: Number(updated?.realBalance || 0),
    message: 'KES 20.00 Signup Freebet credited to your account!'
  };
}

export async function claimCasinoStakeBonus(phone: string) {
  const norm = normalizePhone(phone);
  if (!norm) {
    return { success: false, error: 'PHONE_REQUIRED', message: 'Valid phone required' };
  }

  const user = await getUser(norm);
  if (!user) {
    return { success: false, error: 'USER_NOT_FOUND', message: 'Account not found' };
  }

  const turnover = await getTotalTurnover(norm);
  if (turnover < 500) {
    return {
      success: false,
      error: 'INSUFFICIENT_TURNOVER',
      turnover,
      required: 500,
      message: `You need KES 500 total stakes to unlock this bonus. Current progress: KES ${turnover.toFixed(2)} / 500.00`
    };
  }

  const now = BigInt(Date.now());
  const ref = `CASINO_BONUS_100_${norm}_${now}`;

  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.user.updateMany({
      where: { phone: norm, casinoBonusClaimed: false },
      data: { realBalance: { increment: 100 }, casinoBonusClaimed: true }
    });
    if (!claimed.count) return null;
    const credited = await tx.user.findUniqueOrThrow({ where: { phone: norm } });
    const balanceAfter = Number(credited.realBalance);
    await tx.deposit.create({ data: {
      reference: ref, phone: norm, amount: 100, status: 'SUCCESS', receiptNumber: 'CASINO_BONUS_100', createdAt: now, completedAt: now
    } });
    await tx.walletTransaction.create({ data: {
      phone: norm, reference: ref, type: 'PROMO_CREDIT', mode: 'REAL', amount: 100,
      balanceBefore: balanceAfter - 100, balanceAfter, createdAt: now, metadata: { promo: 'CASINO_BONUS_100' }
    } });
    return credited;
  });
  if (!updated) return { success: false, error: 'ALREADY_CLAIMED', message: 'KES 100 Casino Bonus has already been claimed for this account.' };
  return {
    success: true,
    amount: 100,
    realBalance: Number(updated?.realBalance || 0),
    message: 'KES 100.00 Casino Bonus Freebet credited to your wallet!'
  };
}

// Database Stats
export async function getStats() {
  const usersCount = await prisma.user.count();
  const depositsTotal = await prisma.deposit.aggregate({
    where: { status: 'SUCCESS' },
    _count: true,
    _sum: { amount: true }
  });
  const withdrawalsTotal = await prisma.withdrawal.aggregate({
    where: { status: { in: ['PROCESSING', 'SETTLED'] } },
    _count: true,
    _sum: { amount: true }
  });
  const betsTotal = await prisma.bet.aggregate({
    _count: true,
    _sum: { amount: true }
  });

  return {
    databaseEngine: 'PostgreSQL with Prisma ORM',
    totalUsers: usersCount,
    successfulDepositsCount: depositsTotal._count,
    totalDepositedKes: Number(depositsTotal._sum.amount || 0),
    withdrawalsCount: withdrawalsTotal._count,
    totalWithdrawnKes: Number(withdrawalsTotal._sum.amount || 0),
    totalBetsPlaced: betsTotal._count,
    totalStakingVolumeKes: Number(betsTotal._sum.amount || 0)
  };
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createAdminToken } from '@/lib/admin-auth';
import { verifyPassword } from '@/lib/password';

export async function POST(request: NextRequest) {
  if (!process.env.ADMIN_JWT_SECRET) return NextResponse.json({ success: false, error: 'Admin login is not configured' }, { status: 503 });
  try {
    const data = await request.json();
    const email = String(data.email || '').trim().toLowerCase();
    const password = String(data.password || '');
    if (!email || !password) return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });

    const admin = await prisma.admin.findUnique({ where: { email } });
    const valid = admin?.isActive ? await verifyPassword(password, admin.passwordHash) : false;
    if (!admin || !valid) return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 });

    const now = BigInt(Date.now());
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    await prisma.$transaction([
      prisma.admin.update({ where: { id: admin.id }, data: { lastLoginAt: now, updatedAt: now } }),
      prisma.adminAuditLog.create({ data: { adminId: admin.id, action: 'LOGIN', ipAddress, createdAt: now } })
    ]);

    return NextResponse.json({
      success: true,
      token: createAdminToken(admin),
      admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role }
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Admin login failed' }, { status: 500 });
  }
}

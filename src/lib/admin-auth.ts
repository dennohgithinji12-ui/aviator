import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

interface AdminToken {
  adminId: number;
  role: string;
  type: 'admin';
}

export function createAdminToken(admin: { id: number; role: string }) {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error('ADMIN_JWT_SECRET is not configured');
  return jwt.sign({ adminId: admin.id, role: admin.role, type: 'admin' }, secret, { expiresIn: '8h' });
}

export async function getAdminSession(request: NextRequest) {
  const secret = process.env.ADMIN_JWT_SECRET;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!secret || !token) return null;
  try {
    const payload = jwt.verify(token, secret) as AdminToken;
    if (payload.type !== 'admin' || !Number.isInteger(payload.adminId)) return null;
    return await prisma.admin.findFirst({ where: { id: payload.adminId, isActive: true, role: { in: ['SUPER_ADMIN', 'ADMIN', 'READ_ONLY'] } } });
  } catch {
    return null;
  }
}

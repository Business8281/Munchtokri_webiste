import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(req: NextRequest) {
  return handlePromotions(req);
}

async function handlePromotions(req: NextRequest) {
  try {
    const now = Date.now();
    const couponsQuery = query(
      collection(db, 'coupons'),
      where('status', '==', 'active')
    );
    const snapshot = await getDocs(couponsQuery);

    const promotions: Array<{
      reference_id: string;
      type: string;
      code: string;
      value: number;
      value_type: string;
      summary: string;
      description: string;
    }> = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.isInfluencer) return; // influencer codes are never listed publicly

      // Check expiry
      if (data.expiryDate) {
        const expiryMillis = data.expiryDate.toMillis
          ? data.expiryDate.toMillis()
          : data.expiryDate.toDate
          ? data.expiryDate.toDate().getTime()
          : new Date(data.expiryDate).getTime();
        if (now > expiryMillis) {
          return;
        }
      }

      // Check max uses limit
      if (data.maxUses && (data.usedCount || 0) >= data.maxUses) {
        return;
      }

      const isPercentage = data.discountType === 'percentage';
      const code = (data.code || doc.id).toUpperCase();
      const discountVal = Number(data.discountValue) || 0;
      const minOrder = Number(data.minOrderValue) || 0;
      const maxDiscount = Number(data.maxDiscount) || 0;

      promotions.push({
        reference_id: doc.id,
        type: 'offer',
        code: code,
        value: isPercentage ? discountVal : discountVal * 100, // paise if fixed amount
        value_type: isPercentage ? 'percentage' : 'fixed_amount',
        summary: isPercentage ? `${discountVal}% OFF` : `₹${discountVal} OFF`,
        description: `Min cart value ₹${minOrder}${maxDiscount > 0 ? `, up to ₹${maxDiscount} off` : ''}`,
      });
    });

    return NextResponse.json(
      { promotions },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        },
      }
    );
  } catch (error: any) {
    console.error('Magic Checkout Promotions Error:', error);
    return NextResponse.json(
      { promotions: [], error: error.message || 'Failed to fetch promotions' },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        },
      }
    );
  }
}

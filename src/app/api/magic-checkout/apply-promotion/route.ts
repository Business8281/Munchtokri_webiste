import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

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
  try {
    const body = await req.json().catch(() => ({}));
    const code = (body.code || req.nextUrl.searchParams.get('code') || '')
      .toString()
      .trim()
      .toUpperCase();

    if (!code) {
      return NextResponse.json(
        {
          failure_code: 'INVALID_CODE',
          failure_reason: 'Coupon code is required.',
        },
        {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          },
        }
      );
    }

    // 1. Look up coupon by document ID or by code field
    let couponData: any = null;
    let couponId: string = code;

    const directDocSnap = await getDoc(doc(db, 'coupons', code));
    if (directDocSnap.exists()) {
      couponData = directDocSnap.data();
      couponId = directDocSnap.id;
    } else {
      const q = query(collection(db, 'coupons'), where('code', '==', code));
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        const found = qSnap.docs[0];
        couponData = found.data();
        couponId = found.id;
      }
    }

    if (!couponData) {
      return NextResponse.json(
        {
          failure_code: 'INVALID_CODE',
          failure_reason: 'The coupon code you entered is invalid.',
        },
        {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          },
        }
      );
    }

    // 2. Status check
    if (couponData.status !== 'active') {
      return NextResponse.json(
        {
          failure_code: 'INACTIVE_COUPON',
          failure_reason: 'This coupon is no longer active.',
        },
        {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          },
        }
      );
    }

    // 3. Expiry check
    if (couponData.expiryDate) {
      const expiryMillis = couponData.expiryDate.toMillis
        ? couponData.expiryDate.toMillis()
        : couponData.expiryDate.toDate
        ? couponData.expiryDate.toDate().getTime()
        : new Date(couponData.expiryDate).getTime();
      if (Date.now() > expiryMillis) {
        return NextResponse.json(
          {
            failure_code: 'COUPON_EXPIRED',
            failure_reason: 'This coupon has expired.',
          },
          {
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            },
          }
        );
      }
    }

    // 4. Max uses check
    if (couponData.maxUses && (couponData.usedCount || 0) >= couponData.maxUses) {
      return NextResponse.json(
        {
          failure_code: 'USAGE_LIMIT_EXCEEDED',
          failure_reason: 'This coupon usage limit has been reached.',
        },
        {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          },
        }
      );
    }

    // 5. Calculate Cart Total in Rupees
    let cartTotalInPaise = Number(body.cart?.cart_total || body.cart_total || 0);
    if (!cartTotalInPaise && Array.isArray(body.cart?.line_items)) {
      cartTotalInPaise = body.cart.line_items.reduce((acc: number, it: any) => {
        return acc + Number(it.offer_price || it.price || 0) * Number(it.quantity || 1);
      }, 0);
    }
    const cartAmountInRupees = cartTotalInPaise > 0 ? cartTotalInPaise / 100 : 0;

    const minOrder = Number(couponData.minOrderValue) || 0;
    if (cartAmountInRupees > 0 && minOrder > 0 && cartAmountInRupees < minOrder) {
      return NextResponse.json(
        {
          failure_code: 'MIN_ORDER_NOT_MET',
          failure_reason: `Minimum cart value of ₹${minOrder} is required for this coupon.`,
        },
        {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          },
        }
      );
    }

    // 6. Calculate discount
    const isPercentage = couponData.discountType === 'percentage';
    const discountVal = Number(couponData.discountValue) || 0;
    const maxDiscount = Number(couponData.maxDiscount) || 0;

    let calculatedDiscountPaise = 0;
    if (isPercentage) {
      if (cartAmountInRupees > 0) {
        let discountInRupees = (cartAmountInRupees * discountVal) / 100;
        if (maxDiscount > 0) {
          discountInRupees = Math.min(discountInRupees, maxDiscount);
        }
        calculatedDiscountPaise = Math.round(discountInRupees * 100);
      } else {
        // Fallback percentage
        calculatedDiscountPaise = discountVal;
      }
    } else {
      // Fixed amount in rupees converted to paise
      calculatedDiscountPaise = Math.round(discountVal * 100);
    }

    return NextResponse.json(
      {
        promotion: {
          reference_id: couponId,
          type: 'offer',
          code: code,
          value: calculatedDiscountPaise,
          value_type: 'fixed_amount',
          description: isPercentage
            ? `${discountVal}% discount applied!`
            : `₹${discountVal} discount applied!`,
        },
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        },
      }
    );
  } catch (error: any) {
    console.error('Magic Checkout Apply Promotion Error:', error);
    return NextResponse.json(
      {
        failure_code: 'SERVER_ERROR',
        failure_reason: error.message || 'Failed to process coupon.',
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        },
      }
    );
  }
}

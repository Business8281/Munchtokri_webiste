import { NextRequest, NextResponse } from 'next/server';

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
    const lineItems = Array.isArray(body.line_items) ? body.line_items : [];

    let cartTotalInPaise = 0;
    for (const item of lineItems) {
      const priceInPaise = Number(item.offer_price || item.price || 0);
      const qty = Number(item.quantity || 1);
      cartTotalInPaise += priceInPaise * qty;
    }
    let subtotalInRupees = cartTotalInPaise > 0 ? cartTotalInPaise / 100 : 0;
    if (subtotalInRupees === 0) {
      const rawAmount = body.order_amount || body.amount || body.order?.amount || body.total_amount || 0;
      if (rawAmount > 0) {
        subtotalInRupees = Number(rawAmount) / 100;
      }
    }

    const isCodAdvance = lineItems.some(
      (it: any) =>
        it.sku === 'cod_advance_20' ||
        it.id === 'cod_advance_20' ||
        String(it.name || '').toLowerCase().includes('advance') ||
        String(it.name || '').toLowerCase().includes('cod')
    );

    // If line_items sent was the 20% advance amount, convert back to 100% full subtotal for shipping rules
    if (isCodAdvance && subtotalInRupees > 0) {
      subtotalInRupees = Math.round((subtotalInRupees / 0.20) * 100) / 100;
    }

    // Default store settings based on business rules
    let freeShippingThreshold = 450;
    let shippingRate = 80;
    let codPrice = 50;
    let enableCOD = true;
    let enableFlatRateShipping = true;

    // Fetch dynamic store settings from Firestore if available
    try {
      const res = await fetch(
        'https://firestore.googleapis.com/v1/projects/munch-tokri/databases/(default)/documents/settings/store',
        { next: { revalidate: 60 }, signal: AbortSignal.timeout(2500) }
      );
      if (res.ok) {
        const json = await res.json();
        const fields = json.fields || {};
        if (fields.freeShippingThreshold) {
          freeShippingThreshold = Number(fields.freeShippingThreshold.integerValue ?? fields.freeShippingThreshold.doubleValue ?? 450);
        }
        if (fields.shippingRate) {
          shippingRate = Number(fields.shippingRate.integerValue ?? fields.shippingRate.doubleValue ?? 80);
        }
        if (fields.codPrice) {
          codPrice = Number(fields.codPrice.integerValue ?? fields.codPrice.doubleValue ?? 50);
        }
        if (fields.enableCOD) {
          enableCOD = Boolean(fields.enableCOD.booleanValue ?? true);
        }
        if (fields.enableFlatRateShipping) {
          enableFlatRateShipping = Boolean(fields.enableFlatRateShipping.booleanValue ?? true);
        }
      }
    } catch (e) {
      // Use fallback defaults: Free threshold ₹450, Flat shipping ₹80, COD ₹50
    }

    // Over 450 shipping is free (0 rs), less than 450 is ₹80
    const isFreeShipping = !enableFlatRateShipping || subtotalInRupees >= freeShippingThreshold;
    const shippingFeeInRupees = isFreeShipping ? 0 : shippingRate;
    const shippingFeeInPaise = Math.round(shippingFeeInRupees * 100);

    // COD extra charge of ₹50
    const codFeeInRupees = enableCOD ? codPrice : 0;
    const codFeeInPaise = Math.round(codFeeInRupees * 100);

    const incomingAddresses = Array.isArray(body.addresses) && body.addresses.length > 0
      ? body.addresses
      : (body.address ? [body.address] : [{ id: '0' }]);

    const shippingMethods = [
      {
        id: 'standard_shipping',
        name: 'Standard Delivery',
        description: isFreeShipping
          ? 'Free Delivery (3-5 business days)'
          : `Flat Delivery (₹${shippingRate}) - Free on orders above ₹${freeShippingThreshold}`,
        serviceable: true,
        shipping_fee: shippingFeeInPaise,
        cod: enableCOD,
        cod_serviceable: enableCOD,
        cod_available: enableCOD,
        cod_fee: codFeeInPaise,
      },
    ];

    const mappedAddresses = incomingAddresses.map((addr: any, idx: number) => ({
      id: String(addr.id || addr.address_id || idx),
      zipcode: addr.zipcode || addr.pincode || addr.postal_code || '560001',
      state_code: addr.state_code || addr.state || 'KA',
      country: (addr.country || 'IN').toUpperCase(),
      serviceable: true,
      cod: enableCOD,
      cod_serviceable: enableCOD,
      cod_available: enableCOD,
      shipping_fee: shippingFeeInPaise,
      cod_fee: codFeeInPaise,
      estimated_delivery_days: 3,
      shipping_methods: shippingMethods,
    }));

    return NextResponse.json(
      {
        success: true,
        serviceable: true,
        cod: enableCOD,
        cod_serviceable: enableCOD,
        cod_available: enableCOD,
        cod_fee: codFeeInPaise,
        addresses: mappedAddresses,
        shipping_methods: shippingMethods,
        data: {
          addresses: mappedAddresses,
          shipping_methods: shippingMethods,
        },
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  } catch (err) {
    const fallbackAddresses = [
      {
        id: '0',
        zipcode: '560001',
        state_code: 'KA',
        country: 'IN',
        serviceable: true,
        cod: true,
        cod_serviceable: true,
        cod_available: true,
        shipping_fee: 8000,
        cod_fee: 5000,
        estimated_delivery_days: 3,
        shipping_methods: [
          {
            id: 'standard_shipping',
            name: 'Standard Delivery',
            description: 'Delivery within 3-5 business days - Free above ₹450',
            serviceable: true,
            shipping_fee: 8000,
            cod: true,
            cod_serviceable: true,
            cod_available: true,
            cod_fee: 5000,
          },
        ],
      },
    ];
    return NextResponse.json(
      {
        success: true,
        serviceable: true,
        cod: true,
        cod_serviceable: true,
        cod_available: true,
        cod_fee: 5000,
        addresses: fallbackAddresses,
        shipping_methods: fallbackAddresses[0].shipping_methods,
        data: {
          addresses: fallbackAddresses,
        },
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

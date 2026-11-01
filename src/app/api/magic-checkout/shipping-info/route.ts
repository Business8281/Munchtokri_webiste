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
    const subtotalInRupees = cartTotalInPaise > 0 ? cartTotalInPaise / 100 : 0;

    const freeShippingThreshold = 350;
    const shippingRate = 50;
    const isFreeShipping = subtotalInRupees >= freeShippingThreshold;
    const shippingFeeInRupees = isFreeShipping ? 0 : shippingRate;
    const shippingFeeInPaise = shippingFeeInRupees * 100;

    const incomingAddresses = Array.isArray(body.addresses) && body.addresses.length > 0
      ? body.addresses
      : (body.address ? [body.address] : [{ id: '0' }]);

    const mappedAddresses = incomingAddresses.map((addr: any, idx: number) => ({
      id: String(addr.id || addr.address_id || idx),
      zipcode: addr.zipcode || addr.pincode || addr.postal_code || '560001',
      state_code: addr.state_code || addr.state || 'KA',
      country: (addr.country || 'IN').toUpperCase(),
      serviceable: true,
      cod: true,
      cod_serviceable: true,
      cod_available: true,
      shipping_fee: shippingFeeInPaise,
      cod_fee: 0,
      estimated_delivery_days: 3,
      shipping_methods: [
        {
          id: 'standard_shipping',
          name: 'Standard Delivery',
          description: isFreeShipping
            ? 'Free Delivery (3-5 business days)'
            : `Flat Delivery (3-5 business days) - Free on orders above ₹${freeShippingThreshold}`,
          serviceable: true,
          shipping_fee: shippingFeeInPaise,
          cod: true,
          cod_serviceable: true,
          cod_available: true,
          cod_fee: 0,
        },
      ],
    }));

    const shippingMethods = [
      {
        id: 'standard_shipping',
        name: 'Standard Delivery',
        description: isFreeShipping
          ? 'Free Delivery (3-5 business days)'
          : `Flat Delivery (3-5 business days) - Free on orders above ₹${freeShippingThreshold}`,
        serviceable: true,
        shipping_fee: shippingFeeInPaise,
        cod: true,
        cod_serviceable: true,
        cod_available: true,
        cod_fee: 0,
      },
    ];

    return NextResponse.json(
      {
        success: true,
        serviceable: true,
        cod: true,
        cod_serviceable: true,
        cod_available: true,
        cod_fee: 0,
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
        shipping_fee: 5000,
        cod_fee: 0,
        estimated_delivery_days: 3,
        shipping_methods: [
          {
            id: 'standard_shipping',
            name: 'Standard Delivery',
            description: 'Delivery within 3-5 business days',
            serviceable: true,
            shipping_fee: 5000,
            cod: true,
            cod_serviceable: true,
            cod_available: true,
            cod_fee: 0,
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
        cod_fee: 0,
        addresses: fallbackAddresses,
        shipping_methods: [
          {
            id: 'standard_shipping',
            name: 'Standard Delivery',
            description: 'Delivery within 3-5 business days',
            serviceable: true,
            shipping_fee: 5000,
            cod: true,
            cod_serviceable: true,
            cod_available: true,
            cod_fee: 0,
          },
        ],
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

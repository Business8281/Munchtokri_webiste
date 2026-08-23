import React from 'react';
import { Metadata } from 'next';
import CombosClient from '@/components/combos/CombosClient';
import { getCombos } from '@/lib/server/data';

export const revalidate = 60; // ISR each minute

export const metadata: Metadata = {
    title: 'Snack Combos & Gift Packs | MunchTokri',
    description: 'Explore our curated snack combos and gift packs. Perfect for gifting or trying a variety of our handcrafted traditional snacks.',
    alternates: {
        canonical: 'https://munchtokri.com/combos',
    },
};

export default async function CombosPage() {
    const combos = await getCombos();
    return <CombosClient combos={combos} />;
}

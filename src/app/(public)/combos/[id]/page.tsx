import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCombo, getCombos } from '@/lib/server/data';
import ComboDetailsClient from './ComboDetailsClient';

export const revalidate = 60; // ISR each minute

export async function generateStaticParams() {
    try {
        const combos = await getCombos();
        return combos.map(c => ({ id: c.id }));
    } catch {
        return [];
    }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const combo = await getCombo(id);
    if (!combo) {
        return {
            title: 'Combo Pack Not Found | MunchTokri',
        };
    }

    const packCount = combo.packSize || combo.products?.length || 0;
    const packLabel = combo.packLabel || `Pack of ${packCount}`;

    return {
        title: `${combo.name} (${packLabel}) | MunchTokri`,
        description: combo.description || `Buy ${combo.name} ${packLabel} heritage snack combo online. Special offer price ₹${combo.price}.`,
        openGraph: {
            title: `${combo.name} (${packLabel})`,
            description: combo.description,
            images: combo.imageURL ? [{ url: combo.imageURL }] : [],
        },
    };
}

export default async function ComboDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const combo = await getCombo(id);

    if (!combo) {
        notFound();
    }

    return <ComboDetailsClient initialCombo={combo} />;
}

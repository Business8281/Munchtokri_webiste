import React from 'react';
import HomeClient from '@/components/home/HomeClient';
import { getFeaturedProducts } from '@/lib/server/data';

export const revalidate = 60; // ISR each minute

export default async function Home() {
    const bestSellers = await getFeaturedProducts(4);

    return <HomeClient bestSellers={bestSellers} />;
}

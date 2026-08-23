import React from 'react';
import { Metadata } from 'next';
import RefundClient from './RefundClient';

export const metadata: Metadata = {
    title: 'Refund & Return Policy | MunchTokri',
    description: 'Understand the refund and return polices of Hurigalu Angadi (MunchTokri). We handle returns with speed and fairness.',
    alternates: {
        canonical: 'https://munchtokri.com/refund',
    },
};

export default function RefundPolicyPage() {
    return <RefundClient />;
}

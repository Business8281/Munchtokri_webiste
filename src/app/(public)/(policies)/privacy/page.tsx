import React from 'react';
import { Metadata } from 'next';
import PrivacyClient from './PrivacyClient';

export const metadata: Metadata = {
    title: 'Privacy Policy | MunchTokri',
    description: 'Learn about how Hurigalu Angadi (MunchTokri) collects, uses, and protects your personal information.',
    alternates: {
        canonical: 'https://munchtokri.com/privacy',
    },
};

export default function PrivacyPolicyPage() {
    return <PrivacyClient />;
}

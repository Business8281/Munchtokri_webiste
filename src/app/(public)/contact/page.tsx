import type { Metadata } from 'next';
import ContactClient from '@/components/contact/ContactClient';

export const metadata: Metadata = {
    title: "Contact Us - Hurigalu Angadi Heritage Shop",
    description: "Get in touch with Munch Tokri. Visit our heritage shop in Malleswaram, Bangalore, or contact us for support, bulk orders, and snack inquiries.",
    alternates: {
        canonical: '/contact',
    },
};

export default function ContactPage() {
    return <ContactClient />;
}

"use client";

import React, { ReactNode } from 'react';
import { CartProvider } from '@/contexts/CartContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { FirebaseProvider } from '@/contexts/FirebaseContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import FloatingCart from '@/components/ui/FloatingCart/FloatingCart';

export default function Providers({ children }: { children: ReactNode }) {
    return (
        <ErrorBoundary>
            <FirebaseProvider>
                <NotificationProvider>
                    <CartProvider>
                        {children}
                        <FloatingCart />
                    </CartProvider>
                </NotificationProvider>
            </FirebaseProvider>
        </ErrorBoundary>
    );
}

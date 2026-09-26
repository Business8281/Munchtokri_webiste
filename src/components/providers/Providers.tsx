"use client";

import React, { ReactNode, Suspense } from 'react';
import { CartProvider } from '@/contexts/CartContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { FirebaseProvider } from '@/contexts/FirebaseContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import FloatingCart from '@/components/ui/FloatingCart/FloatingCart';
import { AnalyticsProvider } from '@/components/analytics/AnalyticsTracker';

export default function Providers({ children }: { children: ReactNode }) {
    return (
        <ErrorBoundary>
            <FirebaseProvider>
                <NotificationProvider>
                    <CartProvider>
                        <Suspense fallback={null}>
                            <AnalyticsProvider>
                                {children}
                                <FloatingCart />
                            </AnalyticsProvider>
                        </Suspense>
                    </CartProvider>
                </NotificationProvider>
            </FirebaseProvider>
        </ErrorBoundary>
    );
}

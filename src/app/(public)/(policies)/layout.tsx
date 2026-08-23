import React from 'react';

export default function PolicyLayout({ children }: { children: React.ReactNode }) {
    return (
        <div style={{ background: '#fcfcfc' }}>
            {children}
        </div>
    );
}

import React from 'react';
import Image from 'next/image';

export default function Loading() {
    return (
        <div className="loadingWrapper">
            <div className="loadingLogo">
                <Image
                    src="/logo.png"
                    alt="Loading..."
                    fill
                    style={{ objectFit: 'contain' }}
                    priority
                />
            </div>
            <p className="loadingText">
                Authentic Karnataka Snacks Since 1961
            </p>
            <div className="loadingBarContainer">
                <div className="loadingBar"></div>
            </div>
        </div>
    );
}

"use client";
import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import styles from './AnnouncementBar.module.css';

export default function AnnouncementBar() {
    const [isVisible, setIsVisible] = useState(false);
    const [texts, setTexts] = useState<string[]>([]);
    const [speed, setSpeed] = useState<number>(53);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docRef = doc(db, 'settings', 'store');
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.enableAnnouncementBar) {
                        const fetchedTexts = [
                            data.announcementText1,
                            data.announcementText2,
                            data.announcementText3,
                            data.announcementText4
                        ].filter(Boolean) as string[];
                        
                        if (fetchedTexts.length > 0) {
                            setTexts(fetchedTexts);
                            if (data.announcementSpeed) {
                                setSpeed(Number(data.announcementSpeed) || 53);
                            }
                            setIsVisible(true);
                        }
                    }
                }
            } catch (error) {
                console.error("Error fetching announcement settings:", error);
            }
        };

        fetchSettings();
    }, []);

    if (!isVisible || texts.length === 0) return null;

    const getColorClass = (index: number) => {
        const classes = [styles.color0, styles.color1, styles.color2, styles.color3];
        return classes[index % classes.length];
    };

    return (
        <div className={styles.announcementBar}>
            <div className={styles.marquee}>
                <div className={styles.marqueeContent} style={{ animationDuration: `${speed}s` }}>
                    {texts.map((t, i) => <span key={`a1-${i}`} className={getColorClass(i)}>{t}</span>)}
                    {texts.map((t, i) => <span key={`a2-${i}`} className={getColorClass(i)}>{t}</span>)}
                    {texts.map((t, i) => <span key={`a3-${i}`} className={getColorClass(i)}>{t}</span>)}
                </div>
                <div className={styles.marqueeContent} aria-hidden="true" style={{ animationDuration: `${speed}s` }}>
                    {texts.map((t, i) => <span key={`b1-${i}`} className={getColorClass(i)}>{t}</span>)}
                    {texts.map((t, i) => <span key={`b2-${i}`} className={getColorClass(i)}>{t}</span>)}
                    {texts.map((t, i) => <span key={`b3-${i}`} className={getColorClass(i)}>{t}</span>)}
                </div>
            </div>
        </div>
    );
}

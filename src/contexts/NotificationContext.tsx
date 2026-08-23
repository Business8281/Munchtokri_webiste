"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface NotificationOptions {
    title?: string;
    duration?: number;
}

interface NotificationContextType {
    showNotification: (message: string, type?: NotificationType, options?: NotificationOptions) => void;
    showConfirm: (message: string, onConfirm: () => void, options?: NotificationOptions) => void;
    hideNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [notification, setNotification] = useState<{
        message: string;
        type: NotificationType;
        title?: string;
        isVisible: boolean;
        isConfirm?: boolean;
        onConfirm?: () => void;
    }>({
        message: '',
        type: 'info',
        isVisible: false
    });

    const hideNotification = useCallback(() => {
        setNotification(prev => ({ ...prev, isVisible: false }));
    }, []);

    const showNotification = useCallback((message: string, type: NotificationType = 'info', options: NotificationOptions = {}) => {
        const { title, duration = 5000 } = options;
        setNotification({
            message,
            type,
            title,
            isVisible: true
        });

        if (duration > 0) {
            setTimeout(() => {
                hideNotification();
            }, duration);
        }
    }, [hideNotification]);

    const showConfirm = useCallback((message: string, onConfirm: () => void, options: NotificationOptions = {}) => {
        const { title } = options;
        setNotification({
            message,
            type: 'warning',
            title: title || 'Confirmation Required',
            isVisible: true,
            isConfirm: true,
            onConfirm
        });
    }, []);

    return (
        <NotificationContext.Provider value={{ showNotification, showConfirm, hideNotification }}>
            {children}
            {notification.isVisible && (
                <NotificationOverlay 
                    message={notification.message} 
                    type={notification.type} 
                    title={notification.title} 
                    isConfirm={notification.isConfirm}
                    onConfirm={() => {
                        notification.onConfirm?.();
                        hideNotification();
                    }}
                    onClose={hideNotification} 
                />
            )}
        </NotificationContext.Provider>
    );
}

export function useNotification() {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
}

// Internal Notification Component
import styles from './Notification.module.css';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

function NotificationOverlay({ message, type, title, isConfirm, onConfirm, onClose }: { 
    message: string; 
    type: NotificationType; 
    title?: string;
    isConfirm?: boolean;
    onConfirm?: () => void;
    onClose: () => void;
}) {
    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle className={styles.iconSuccess} />;
            case 'error': return <XCircle className={styles.iconError} />;
            case 'warning': return <AlertTriangle className={styles.iconWarning} />;
            default: return <Info className={styles.iconInfo} />;
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={`${styles.container} ${styles[type]}`} onClick={e => e.stopPropagation()}>
                <div className={styles.iconWrapper}>
                    {getIcon()}
                </div>
                <div className={styles.content}>
                    {title && <h4 className={styles.title}>{title}</h4>}
                    <p className={styles.message}>{message}</p>
                    
                    {isConfirm && (
                        <div className={styles.actionRow}>
                            <button className={styles.cancelBtn} onClick={onClose}>
                                Cancel
                            </button>
                            <button className={styles.confirmBtn} onClick={onConfirm}>
                                Confirm Action
                            </button>
                        </div>
                    )}
                </div>
                {!isConfirm && (
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={18} />
                    </button>
                )}
            </div>
        </div>
    );
}

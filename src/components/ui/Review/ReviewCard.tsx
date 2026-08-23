import React from 'react';
import StarRating from '../StarRating/StarRating';
import styles from './ReviewCard.module.css';

interface Review {
    id: string;
    userName: string;
    userPhoto: string;
    rating: number;
    comment: string;
    createdAt: any;
}

const ReviewCard: React.FC<{ review: Review }> = ({ review }) => {
    const formatDate = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return new Intl.DateTimeFormat('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        }).format(date);
    };

    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <div className={styles.userInfo}>
                    {review.userPhoto ? (
                        <img src={review.userPhoto} alt={review.userName} className={styles.avatar} />
                    ) : (
                        <div className={styles.avatarPlaceholder}>
                            {review.userName.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div className={styles.meta}>
                        <h4 className={styles.userName}>{review.userName}</h4>
                        <span className={styles.date}>{formatDate(review.createdAt)}</span>
                    </div>
                </div>
                <StarRating rating={review.rating} size="sm" />
            </div>
            <p className={styles.comment}>{review.comment}</p>
        </div>
    );
};

export default ReviewCard;

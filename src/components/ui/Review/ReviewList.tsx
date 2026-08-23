import React from 'react';
import ReviewCard from './ReviewCard';
import styles from './ReviewCard.module.css'; // Reusing some base styles or creating list specific ones

interface Review {
    id: string;
    userName: string;
    userPhoto: string;
    rating: number;
    comment: string;
    createdAt: any;
}

interface ReviewListProps {
    reviews: Review[];
    loading: boolean;
}

const ReviewList: React.FC<ReviewListProps> = ({ reviews, loading }) => {
    if (loading) {
        return <div className={styles.loading}>Loading reviews...</div>;
    }

    if (reviews.length === 0) {
        return (
            <div className={styles.empty}>
                <p>No reviews yet. Be the first to share your thoughts!</p>
            </div>
        );
    }

    return (
        <div className={styles.list}>
            {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
            ))}
        </div>
    );
};

export default ReviewList;

import React, { useState } from 'react';
import Link from 'next/link';
import StarRating from '../StarRating/StarRating';
import Button from '../Button/Button';
import { auth } from '@/lib/firebase';
import { useNotification } from '@/contexts/NotificationContext';
import styles from './ReviewForm.module.css';

interface ReviewFormProps {
    productId: string;
    onSubmit: (review: { rating: number, comment: string }) => Promise<void>;
}

const ReviewForm: React.FC<ReviewFormProps> = ({ productId, onSubmit }) => {
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { showNotification } = useNotification();
    const user = auth.currentUser;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (rating === 0) {
            showNotification('Please select a rating', 'warning', { title: 'Rating Required' });
            return;
        }
        if (!comment.trim()) {
            showNotification('Please enter a comment', 'warning', { title: 'Comment Required' });
            return;
        }

        setIsSubmitting(true);
        try {
            await onSubmit({ rating, comment });
            setRating(0);
            setComment('');
            showNotification('Review submitted successfully!', 'success', { title: 'Thank You' });
        } catch (error) {
            console.error('Error submitting review:', error);
            showNotification('Failed to submit review. Please try again.', 'error', { title: 'Error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!user) {
        return (
            <div className={styles.loginPrompt}>
                <p>Please sign in to share your experience with this product.</p>
                <Link href="/login">
                    <Button variant="outline">Sign In to Review</Button>
                </Link>
            </div>
        );
    }

    return (
        <form className={styles.form} onSubmit={handleSubmit}>
            <h3 className={styles.title}>Write a Review</h3>
            <div className={styles.ratingSection}>
                <label>Your Rating</label>
                <StarRating
                    rating={rating}
                    interactive
                    onRatingChange={setRating}
                    size="lg"
                />
            </div>
            <div className={styles.inputGroup}>
                <label htmlFor="comment">Your Comment</label>
                <textarea
                    id="comment"
                    rows={4}
                    placeholder="Tell us what you liked (or didn't like) about this snack..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    required
                />
            </div>
            <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                className={styles.submitBtn}
            >
                {isSubmitting ? 'Submitting...' : 'Submit Review'}
            </Button>
        </form>
    );
};

export default ReviewForm;

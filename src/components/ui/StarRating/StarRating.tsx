import React, { useState } from 'react';
import styles from './StarRating.module.css';

interface StarRatingProps {
    rating: number;
    maxStars?: number;
    onRatingChange?: (rating: number) => void;
    interactive?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

const StarRating: React.FC<StarRatingProps> = ({
    rating,
    maxStars = 5,
    onRatingChange,
    interactive = false,
    size = 'md'
}) => {
    const [hoverRating, setHoverRating] = useState(0);

    const handleClick = (value: number) => {
        if (interactive && onRatingChange) {
            onRatingChange(value);
        }
    };

    const handleMouseEnter = (value: number) => {
        if (interactive) {
            setHoverRating(value);
        }
    };

    const handleMouseLeave = () => {
        if (interactive) {
            setHoverRating(0);
        }
    };

    const displayRating = hoverRating || rating;

    return (
        <div className={`${styles.starRating} ${styles[size]}`}>
            {[...Array(maxStars)].map((_, index) => {
                const starValue = index + 1;
                return (
                    <span
                        key={index}
                        className={`${styles.star} ${starValue <= displayRating ? styles.filled : ''} ${interactive ? styles.interactive : ''}`}
                        onClick={() => handleClick(starValue)}
                        onMouseEnter={() => handleMouseEnter(starValue)}
                        onMouseLeave={handleMouseLeave}
                    >
                        ★
                    </span>
                );
            })}
        </div>
    );
};

export default StarRating;

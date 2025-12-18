import React, { useState, useEffect, useRef } from 'react';

/**
 * Animated counter that smoothly counts up to the target value
 */
export default function AnimatedCounter({ value, duration = 500, className = '' }) {
    const [displayValue, setDisplayValue] = useState(value);
    const previousValue = useRef(value);

    useEffect(() => {
        const startValue = previousValue.current;
        const endValue = value;

        if (startValue === endValue) return;

        const startTime = Date.now();
        const diff = endValue - startValue;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function (ease-out)
            const easeOut = 1 - Math.pow(1 - progress, 3);

            const current = Math.round(startValue + diff * easeOut);
            setDisplayValue(current);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setDisplayValue(endValue);
                previousValue.current = endValue;
            }
        };

        requestAnimationFrame(animate);

        return () => {
            previousValue.current = value;
        };
    }, [value, duration]);

    return (
        <span className={`count-animate ${className}`}>
            {displayValue}
        </span>
    );
}

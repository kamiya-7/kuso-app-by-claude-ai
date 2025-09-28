import React from 'react';

interface ConfettiProps {
  id: number;
  color: string;
  size: 'small' | 'medium' | 'large';
  left: number;
  delay: number;
}

const Confetti: React.FC<ConfettiProps> = ({ color, size, left, delay }) => {
  const sizeClasses = {
    small: 'w-2 h-3',
    medium: 'w-3 h-4',
    large: 'w-4 h-5'
  };

  return (
    <div
      className={`fixed ${color} ${sizeClasses[size]} animate-confetti pointer-events-none`}
      style={{
        left: `${left}%`,
        top: '-20px',
        animationDelay: `${delay}s`,
        zIndex: 1000
      }}
    />
  );
};

export default Confetti;
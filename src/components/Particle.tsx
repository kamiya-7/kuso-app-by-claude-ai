import React from 'react';

interface ParticleProps {
  id: number;
  color: string;
  size: 'small' | 'medium' | 'large';
  shape: 'circle' | 'star';
}

const Particle: React.FC<ParticleProps> = ({ id, color, size, shape }) => {
  const sizeClasses = {
    small: 'w-3 h-3',
    medium: 'w-4 h-4',
    large: 'w-6 h-6'
  };

  const animationClass = `animate-explode-${(id % 8) + 1}`;

  if (shape === 'star') {
    return (
      <div
        className={`absolute ${animationClass} ${color} ${sizeClasses[size]} pointer-events-none`}
        style={{
          clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)'
        }}
      />
    );
  }

  return (
    <div
      className={`absolute ${animationClass} ${color} ${sizeClasses[size]} rounded-full pointer-events-none`}
      style={{
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)'
      }}
    />
  );
};

export default Particle;
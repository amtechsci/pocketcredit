import React from 'react';

interface DisclaimerProps {
  className?: string;
}

export function Disclaimer({ className = '' }: DisclaimerProps) {
  return (
    <div className={`text-xs text-gray-500 text-center leading-relaxed ${className}`}>
      Pocketcredit operates as a platform / DLA that connects borrowers to RBI-registered NBFCs for loan transactions, with all applications being thoroughly verified, approved and sanctioned by these financial institutions.
    </div>
  );
}

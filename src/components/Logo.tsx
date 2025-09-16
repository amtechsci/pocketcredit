import logoImage from '../assets/d19c321ca25a6fed5e84685c8670e2290d4233d4.png';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'white' | 'icon-only';
  className?: string;
  onClick?: () => void;
}

export function Logo({ 
  size = 'md', 
  variant = 'default', 
  className = '', 
  onClick 
}: LogoProps) {
  // Size configurations for the actual logo image
  const sizeConfig = {
    sm: {
      height: 'h-7', // Slightly larger for better readability
      width: 'w-auto'
    },
    md: {
      height: 'h-8 sm:h-10',
      width: 'w-auto'
    },
    lg: {
      height: 'h-14', // Slightly larger for better proportion
      width: 'w-auto'
    },
    xl: {
      height: 'h-20', // Larger for hero sections
      width: 'w-auto'
    }
  };

  const config = sizeConfig[size];

  // Filter configurations for different variants
  const filterClass = variant === 'white' 
    ? 'brightness-0 invert' // Makes the logo white
    : ''; // Default - keeps original colors

  const LogoContent = () => (
    <img 
      src={logoImage} 
      alt="Pocket Credit" 
      className={`${config.height} ${config.width} object-contain ${filterClass}`}
    />
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`flex items-center cursor-pointer transition-opacity hover:opacity-80 ${className}`}
      >
        <LogoContent />
      </button>
    );
  }

  return (
    <div className={`flex items-center ${className}`}>
      <LogoContent />
    </div>
  );
}

export default Logo;
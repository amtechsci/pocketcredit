# Pocket Credit - Digital Lending Platform

A modern, secure digital lending platform offering instant personal and business loans to salaried and self-employed individuals across India.

## Features

- 🏠 **Homepage** with hero section, eligibility checker, and EMI calculator
- 💰 **Personal Loans** up to ₹10 lakhs with instant approval
- 🏢 **Business Loans** up to ₹50 lakhs for entrepreneurs
- 📱 **Mobile-First Design** with responsive layout
- 🔐 **Secure Authentication** with mobile OTP verification
- 📋 **4-Step Application Flow**: Eligibility → KYC & Documents → Final Offer → e-Agreement
- 🎯 **Trust Signals** prominently displayed throughout
- ⚡ **Instant Disbursal** to customer accounts

## Technology Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS v4.0 with custom design system
- **UI Components**: Radix UI primitives with shadcn/ui
- **Build Tool**: Vite
- **Icons**: Lucide React
- **Notifications**: Sonner
- **Forms**: React Hook Form

## Design System

### Color Palette
- **Primary**: #0052FF (Trust & Reliability)
- **Accent/CTA**: #00C49A (Action & Success)
- **Text**: #1E2A3B (Readability)
- **Neutral**: #F0F4F8 (Background & Subtle)

### Typography
- **Headings**: Poppins (Modern & Professional)
- **Body Text**: Inter (Readable & Clean)

## Getting Started

### Prerequisites
- Node.js 18+ and npm/yarn
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd pocket-credit
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000`

### Build for Production

```bash
npm run build
# or
yarn build
```

### Preview Production Build

```bash
npm run preview
# or
yarn preview
```

## Project Structure

```
pocket-credit/
├── src/
│   └── main.tsx              # Entry point
├── components/
│   ├── ui/                   # shadcn/ui components
│   ├── pages/                # Page components
│   ├── figma/                # Figma integration utilities
│   ├── Header.tsx            # Main navigation
│   ├── Footer.tsx            # Site footer
│   ├── ApplicationFlow.tsx   # 4-step loan application
│   ├── EligibilityChecker.tsx
│   └── EMICalculator.tsx
├── styles/
│   └── globals.css           # Global styles & design tokens
├── App.tsx                   # Main app component
└── package.json
```

## Mobile Optimization

The platform is built with a mobile-first approach:

- **Touch-friendly** UI with 44px minimum touch targets
- **Responsive** layouts that work on all screen sizes
- **Mobile-optimized** forms with proper input types
- **Safe area** support for modern mobile devices
- **Performance optimized** for mobile networks

## Key Components

### ApplicationFlow
4-step loan application process:
1. **Eligibility Check** - Basic details and instant pre-approval
2. **KYC & Documents** - Personal info and document upload
3. **Final Offer** - Loan terms and approval
4. **e-Agreement** - Digital signing and NACH setup

### EligibilityChecker
Instant loan eligibility assessment with:
- PAN verification
- Income assessment
- Employment type validation
- Loan amount calculation

### EMICalculator
Interactive EMI calculation tool with:
- Loan amount slider
- Interest rate options
- Tenure selection
- Real-time EMI calculation

## Development Guidelines

- Follow the mobile-first responsive design approach
- Use the custom design system colors and typography
- Maintain accessibility standards (WCAG 2.1)
- Implement proper error handling and user feedback
- Include loading states for all async operations

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly on mobile and desktop
5. Submit a pull request

## License

This project is proprietary software for Pocket Credit platform.

---

For support or questions, contact the development team.
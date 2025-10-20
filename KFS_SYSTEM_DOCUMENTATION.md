# KFS (Key Facts Statement) System Documentation

## Overview
The KFS system generates a comprehensive 4-page regulatory document for loan applications, compliant with RBI guidelines for digital lending.

## System Architecture

### Backend Components

#### 1. KFS API Route (`src/server/routes/kfs.js`)
**Endpoint**: `GET /api/kfs/:loanId`

**Features**:
- Fetches loan application details with user information
- Integrates with centralized loan calculation system
- Calculates APR (Annual Percentage Rate)
- Generates complete KFS data structure
- Supports both applied loans (fixed days) and running loans (actual days)

**Response Structure**:
```javascript
{
  success: true,
  data: {
    company: { /* Company details */ },
    loan: { /* Loan details */ },
    borrower: { /* Borrower information */ },
    interest: { /* Interest calculations */ },
    fees: { /* Fee breakdown */ },
    calculations: { /* All calculated values */ },
    repayment: { /* Repayment schedule */ },
    penal_charges: { /* Penalty information */ },
    grievance: { /* Grievance redressal */ },
    digital_loan: { /* Digital loan specifics */ },
    additional: { /* Additional disclosures */ }
  }
}
```

### Frontend Components

#### 1. KFS Document Component (`src/admin/pages/KFSDocument.tsx`)
**Route**: `/admin/kfs/:loanId`

**Features**:
- 4-page professional document layout
- Print-optimized styling
- Real-time data fetching
- Download PDF capability (placeholder)
- Responsive design

**Page Structure**:

**Page 1 - Part A (Interest Rate & Fees)**
- Loan proposal details
- Sanctioned amount and disbursal schedule
- Loan term and instalment details
- Interest rate information
- Fee/charges breakdown (Processing fee, GST)
- APR calculation
- Contingent charges (penal charges, foreclosure)

**Page 2 - Part 2 (Qualitative Information)**
- Recovery agents clause
- Grievance redressal mechanism
- Nodal officer contact details
- Loan transfer/securitization disclosure
- Digital loan specific disclosures
- Cooling-off period
- LSP (Lending Service Provider) details

**Page 3 - Annex B (APR Computation)**
- Detailed parameter breakdown
- Sanctioned loan amount
- Loan term
- Interest rate type and rate
- Total interest amount
- Fee/charges summary
- Net disbursed amount
- Total amount payable
- APR formula and calculation
- Due date information

**Page 4 - Annex C & Part B (Repayment & Sanction)**
- Repayment schedule table
- Sanction letter
- Terms & conditions of recovery
- Recovery mechanism details
- Other regulatory disclosures

## Integration Points

### 1. Admin Panel Integration
**Location**: `src/admin/pages/UserProfileDetail.tsx`

**Action Buttons**:
- **View**: View loan application details
- **View KFS**: Opens KFS document in new tab
- **Send**: Send KFS to borrower (to be implemented)

```typescript
<button 
  onClick={() => window.open(`/admin/kfs/${loan.id}`, '_blank')}
  className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
>
  View KFS
</button>
```

### 2. Loan Calculation Integration
The KFS system uses the centralized loan calculation utilities:

```javascript
const { calculateLoanValues, calculateTotalDays } = require('../utils/loanCalculations');

// For applied loans - uses fixed plan days
let days = 30; // from plan_snapshot

// For running loans - uses actual elapsed days
if (loan.disbursed_at) {
  days = calculateTotalDays(loan.disbursed_at);
}

const calculations = calculateLoanValues(loanData, days);
```

## Key Calculations

### APR (Annual Percentage Rate)
```javascript
const totalCharges = processingFee + gst + interest;
const apr = ((totalCharges / principal) / days) * 36500;
```

### Repayment Schedule
```javascript
{
  instalment_no: 1,
  outstanding_principal: principal,
  principal: principal,
  interest: calculations.interest,
  instalment_amount: calculations.totalAmount,
  due_date: dueDate
}
```

## Styling & Print Support

### Print Stylesheet (`src/styles/print.css`)
- A4 page size optimization
- Page break controls
- Print-friendly colors
- Hidden non-printable elements
- Proper margins and padding

### CSS Classes
- `.print:hidden` - Hide elements when printing
- `.page-break-before` - Force page break before element
- `.print:shadow-none` - Remove shadows for print
- `.print:p-12` - Consistent padding for print

## Company Information

### Pocket Credit Details
```javascript
company: {
  name: 'Pocket Credit Private Limited',
  cin: 'U65999DL2024PTC123456',
  rbi_registration: 'B-14.03456',
  address: 'Plot No. 123, Sector 18, Gurugram, Haryana 122015',
  phone: '+91 9876543210',
  email: 'support@pocketcredit.in',
  website: 'www.pocketcredit.in'
}
```

### Grievance Redressal
```javascript
grievance: {
  nodal_officer: {
    name: 'Mr. Rajesh Kumar',
    phone: '+91 9876543210',
    email: 'grievance@pocketcredit.in'
  },
  escalation: {
    name: 'Ms. Priya Sharma',
    designation: 'Chief Compliance Officer',
    phone: '+91 9876543211',
    email: 'compliance@pocketcredit.in'
  }
}
```

## Regulatory Compliance

### RBI Guidelines Adherence
1. **Part A - Key Facts Statement**: Complete interest rate and fee disclosure
2. **Part B - Sanction Letter**: Formal loan sanction communication
3. **Annex A**: Detailed fee structure
4. **Annex B**: APR computation methodology
5. **Annex C**: Clear repayment schedule

### Digital Lending Guidelines
- 3-day cooling-off period
- LSP (Lending Service Provider) disclosure
- Clear penal charges structure
- Grievance redressal mechanism
- Recovery process transparency

## Usage Guide

### For Admins

1. **View KFS**:
   - Navigate to user profile → Loans tab
   - Click "View KFS" button next to any loan
   - KFS opens in new tab

2. **Print KFS**:
   - Open KFS document
   - Click "Print" button
   - Use browser print dialog (Ctrl+P)

3. **Download PDF** (Coming Soon):
   - Click "Download PDF" button
   - PDF will be generated and downloaded

### For Developers

1. **Fetch KFS Data**:
```typescript
const response = await adminApiService.getKFS(loanId);
const kfsData = response.data;
```

2. **Navigate to KFS**:
```typescript
navigate(`/admin/kfs/${loanId}`);
// or
window.open(`/admin/kfs/${loanId}`, '_blank');
```

3. **Customize Company Info**:
Edit `src/server/routes/kfs.js` → `company` object

## Future Enhancements

### Pending Features
1. **PDF Generation**: Implement server-side PDF generation using Puppeteer
2. **Email Integration**: Send KFS directly to borrower's email
3. **SMS Notification**: Send KFS link via SMS
4. **Digital Signature**: Add digital signature to KFS
5. **Version Control**: Track KFS versions and changes
6. **Multi-language**: Support for regional languages

### Loan Agreement Document
- Similar structure to KFS
- Detailed terms and conditions
- Legal clauses
- Borrower and lender signatures
- Witness information

## Testing Checklist

- [ ] KFS generates correctly for applied loans
- [ ] KFS generates correctly for running loans
- [ ] All calculations match loan calculation system
- [ ] APR calculation is accurate
- [ ] Print layout is correct (4 pages)
- [ ] All company information is correct
- [ ] Grievance contact details are accurate
- [ ] Page breaks work correctly
- [ ] Responsive design works on all devices
- [ ] Button integration works in admin panel

## API Documentation

### Get KFS Data
```http
GET /api/kfs/:loanId
Authorization: Bearer {adminToken}

Response:
{
  "success": true,
  "data": {
    // KFS data structure
  }
}
```

### Error Responses
```json
{
  "success": false,
  "message": "Loan application not found"
}
```

## Troubleshooting

### Common Issues

1. **KFS not loading**
   - Check if backend server is running
   - Verify loan ID exists
   - Check admin authentication token

2. **Calculations incorrect**
   - Verify loan_applications table has required columns
   - Check plan_snapshot data
   - Verify processing_fee_percent and interest_percent_per_day values

3. **Print layout issues**
   - Ensure print.css is imported
   - Check browser print settings
   - Verify page break classes are applied

## Support

For issues or questions:
- Technical: dev@pocketcredit.in
- Compliance: compliance@pocketcredit.in
- General: support@pocketcredit.in

---

**Version**: 1.0.0  
**Last Updated**: October 19, 2025  
**Maintained By**: Pocket Credit Development Team


# Partner Dashboard Access Guide

## Overview

Partners can access a web-based dashboard to track their leads, view statistics, and monitor payouts in real-time.

## Access URL

**Production**: `https://pocketcredit.in/partner/login`  
**Development**: `http://localhost:3000/partner/login`

## Login Credentials

Partners use the same credentials as the API:
- **Client ID**: Your partner client ID
- **Client Secret**: Your partner client secret

These are the same credentials used for API authentication.

## Dashboard Features

### 1. Statistics Overview
- **Total Leads**: All leads shared by the partner
- **Fresh Leads**: New leads (code 2005)
- **Disbursed Loans**: Number of loans successfully disbursed
- **Total Payout**: Total payout amount eligible

### 2. Leads Management
- **View All Leads**: Complete list of all shared leads
- **Filter by Status**: Filter by `fresh_lead`, `registered_user`, or `active_user`
- **Date Range Filter**: Filter leads by date range
- **Search**: Search by name, mobile number, or PAN
- **Pagination**: Navigate through large lists

### 3. Lead Details
- Click on any lead to view detailed information:
  - Lead information (name, mobile, PAN, email)
  - Dedupe status and timeline
  - Loan application status (if applied)
  - Disbursal information (date, amount)
  - Payout eligibility and amount
  - UTM tracking link

### 4. Real-time Updates
- Dashboard shows real-time data from the database
- Statistics update automatically
- Lead status changes are reflected immediately

## Navigation

- **Dashboard**: `/partner/dashboard` - Main dashboard
- **Lead Details**: `/partner/lead/:leadId` - View specific lead
- **Logout**: Click logout button in header

## Authentication Flow

1. Partner visits `/partner/login`
2. Enters Client ID and Client Secret
3. System authenticates using Partner API
4. Access token stored in browser
5. Redirected to dashboard
6. Token automatically refreshed when needed

## Security

- Access tokens expire after 15 minutes
- Tokens stored securely in browser localStorage
- All API calls use Bearer token authentication
- Logout clears all stored tokens

## Troubleshooting

### Can't Login?
- Verify your Client ID and Client Secret are correct
- Check if your partner account is active
- Contact support if credentials don't work

### Dashboard Not Loading?
- Check browser console for errors
- Verify API base URL is correct
- Ensure backend server is running

### Token Expired?
- Logout and login again
- System should auto-refresh tokens

## Support

For dashboard access issues, contact:
- Email: support@pocketcredit.in
- Check API documentation for API access methods

---

**Note**: The dashboard provides a user-friendly interface for the same data available via API endpoints. Partners can choose to use either the dashboard or integrate directly with the API.

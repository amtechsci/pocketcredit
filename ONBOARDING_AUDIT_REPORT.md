# Onboarding Flow Audit & Refactor Report

## Executive Summary

This document outlines the complete audit of the user onboarding journey and the refactoring changes made to fix broken redirect logic.

## Issues Identified

### 1. **Broken "View Status" Button Logic**
**Location**: `src/components/pages/DynamicDashboardPage.tsx` (lines 900-928)

**Problem**: 
- When clicking "View Status", the system only checked references completion
- It did NOT check earlier steps (KYC, PAN, AA consent, bank linking, employment details)
- Users were incorrectly sent to References page even when earlier steps were incomplete

**Root Cause**: 
- Hardcoded logic that only checked references
- No unified progress calculation

### 2. **Incomplete References Status Check**
**Location**: `src/hooks/useLoanApplicationStepManager.ts` (lines 288-298)

**Problem**:
- `checkReferencesStatus` function was a placeholder that always returned `false`
- References were never considered complete, causing incorrect step determination

**Root Cause**:
- Function was not implemented

### 3. **Missing Prerequisites in Step Determination**
**Location**: `src/hooks/useLoanApplicationStepManager.ts` (lines 349-377)

**Problem**:
- `determineCurrentStep` did not check:
  - PAN verification status (after KYC)
  - Account Aggregator (AA) consent status
- These are critical steps in the business flow

**Root Cause**:
- Prerequisites interface didn't include PAN and AA status
- Step determination logic was incomplete

### 4. **No Unified Progress Engine**
**Problem**:
- Multiple places determined "next step":
  - `useLoanApplicationStepManager` hook
  - `DynamicDashboardPage` View Status button
  - Individual page components
  - `StepGuard` component
- Each used different logic, causing inconsistencies

**Root Cause**:
- No single source of truth for progress calculation

### 5. **Inconsistent Step Order**
**Problem**:
- Business flow requires: KYC → PAN → AA → Bank Linking → Employment → References
- Actual implementation had different order and missing steps

## Solutions Implemented

### 1. **Created Unified Onboarding Progress Engine**
**File**: `src/utils/onboardingProgressEngine.ts`

**Features**:
- Single source of truth for step determination
- Checks ALL prerequisites in correct order:
  1. Documents needed (admin requested)
  2. KYC verification
  3. PAN verification
  4. Account Aggregator consent
  5. Credit analytics
  6. Employment details
  7. Bank statement
  8. Bank details (account linking)
  9. References
  10. Final steps

**Key Functions**:
- `checkAllPrerequisites()`: Checks all onboarding prerequisites
- `determineCurrentStep()`: Returns first incomplete step
- `getOnboardingProgress()`: Main function to get complete progress
- `getStepRoute()`: Returns route for a step with applicationId

### 2. **Fixed View Status Button**
**File**: `src/components/pages/DynamicDashboardPage.tsx`

**Changes**:
- Now uses `getOnboardingProgress()` from unified engine
- Checks ALL prerequisites, not just references
- Redirects to first incomplete step
- Falls back gracefully if engine fails

### 3. **Fixed References Status Check**
**File**: `src/hooks/useLoanApplicationStepManager.ts`

**Changes**:
- Implemented `checkReferencesStatus` to actually check:
  - At least 3 references exist
  - Alternate mobile number is provided
- Returns proper boolean instead of always `false`

### 4. **Added PAN and AA Status Checks**
**File**: `src/utils/onboardingProgressEngine.ts`

**Changes**:
- Added `panVerified` to prerequisites
- Added `aaConsentGiven` to prerequisites
- Checks PAN after KYC is verified
- Checks AA consent status via API

## Business Flow Alignment

### Correct Order (As Per Requirements):
1. **KYC verification** → `/loan-application/kyc-verification`
2. **PAN verification** → Handled on KYC page
3. **Account Aggregator consent** → `/loan-application/aa-flow`
4. **Bank account linking** → `/loan-application/bank-details`
5. **Other personal details** → `/loan-application/employment-details`
6. **References** → `/loan-application/references`
7. **Review/summary** → `/loan-application/steps`

### Implementation Notes:
- PAN verification is checked after KYC but handled on the same KYC page
- AA consent is a separate step but may be part of bank statement flow
- Credit analytics runs automatically after KYC/PAN
- Employment details come after credit analytics

## Testing Checklist

- [ ] User with incomplete KYC → Redirects to KYC page
- [ ] User with KYC but no PAN → Redirects to KYC page (PAN input shown)
- [ ] User with KYC+PAN but no AA → Redirects to AA consent page
- [ ] User with incomplete employment → Redirects to employment page
- [ ] User with incomplete bank statement → Redirects to bank statement page
- [ ] User with incomplete bank linking → Redirects to bank details page
- [ ] User with incomplete references → Redirects to references page
- [ ] User with all steps complete → Shows under review page
- [ ] "View Status" button always takes user to next pending step
- [ ] Deep linking works (user can return after days and resume)

## Files Modified

1. `src/utils/onboardingProgressEngine.ts` (NEW) - Unified progress engine
2. `src/components/pages/DynamicDashboardPage.tsx` - Fixed View Status button
3. `src/hooks/useLoanApplicationStepManager.ts` - Fixed references check

## Next Steps (Recommended)

1. **Update useLoanApplicationStepManager**: Refactor to use unified engine internally
2. **Add Step Guards**: Ensure all onboarding pages check prerequisites before rendering
3. **Update STEP_ORDER**: Align with business flow requirements
4. **Add Tests**: Unit tests for progress engine
5. **Monitor**: Track redirect accuracy in production

## Migration Notes

- The unified engine is backward compatible
- Existing code continues to work
- New code should use `getOnboardingProgress()` for consistency
- Old `determineCurrentStep` in hook still works but should be migrated

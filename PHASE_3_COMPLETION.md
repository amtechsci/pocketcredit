# Phase 3: Cleanup Individual Pages - COMPLETED ✅

## Summary

Successfully removed manual redirect logic from onboarding pages and replaced with unified progress engine calls.

## Changes Made

### 1. **EmploymentDetailsPage.tsx**

**File**: `src/components/pages/EmploymentDetailsPage.tsx`

**Before**:
```typescript
navigate('/loan-application/bank-statement', {
  state: { applicationId },
  replace: true
});
```

**After**:
```typescript
const { getOnboardingProgress, getStepRoute } = await import('../../utils/onboardingProgressEngine');
const progress = await getOnboardingProgress(applicationId);
const nextRoute = getStepRoute(progress.currentStep, applicationId);
navigate(nextRoute, { replace: true });
```

**Benefits**:
- ✅ Dynamically determines next step (could be bank-statement, references, or any pending step)
- ✅ Handles admin resets automatically
- ✅ Consistent with rest of application

### 2. **ReferenceDetailsPage.tsx**

**File**: `src/components/pages/ReferenceDetailsPage.tsx`

**Before**:
```typescript
navigate('/loan-application/steps?applicationId=' + applicationId + '&step=complete');
```

**After**:
```typescript
const { getOnboardingProgress, getStepRoute } = await import('../../utils/onboardingProgressEngine');
const progress = await getOnboardingProgress(parseInt(applicationId));
const nextRoute = getStepRoute(progress.currentStep, progress.applicationId);
navigate(nextRoute, { replace: true });
```

**Benefits**:
- ✅ Goes to actual next pending step (not hardcoded to 'steps')
- ✅ If documents are needed, goes to upload-documents
- ✅ If all complete, goes to steps page

### 3. **AccountAggregatorFlow.tsx**

**File**: `src/components/pages/AccountAggregatorFlow.tsx`

**Before**:
```typescript
navigate('/loan-application/employment-details', { state: { applicationId } });
```

**After**:
```typescript
const { getOnboardingProgress, getStepRoute } = await import('../../utils/onboardingProgressEngine');
const progress = await getOnboardingProgress(applicationId);
const nextRoute = getStepRoute(progress.currentStep, applicationId);
navigate(nextRoute, { replace: true });
```

**Benefits**:
- ✅ Determines next step dynamically
- ✅ Handles cases where employment might already be completed
- ✅ Goes to actual next pending step

### 4. **LoanDocumentUploadPage.tsx**

**File**: `src/components/pages/LoanDocumentUploadPage.tsx`

**Before**:
```typescript
// Hardcoded step mapping
const stepRoutes: { [key: string]: string } = {
  'kyc-verification': `/loan-application/kyc-verification?applicationId=${applicationId}`,
  'employment-details': `/loan-application/employment-details?applicationId=${applicationId}`,
  // ... etc
};
const route = stepRoutes[currentStep] || `/application-under-review?applicationId=${applicationId}`;
navigate(route);
```

**After**:
```typescript
const { getOnboardingProgress, getStepRoute } = await import('../../utils/onboardingProgressEngine');
const progress = await getOnboardingProgress(applicationId);
const nextRoute = getStepRoute(progress.currentStep, applicationId);
navigate(nextRoute, { replace: true });
```

**Benefits**:
- ✅ Removed hardcoded step mapping
- ✅ Uses unified engine for step determination
- ✅ Handles all edge cases automatically

### 5. **LinkSalaryBankAccountPage.tsx**

**File**: `src/components/pages/LinkSalaryBankAccountPage.tsx`

**Before**:
```typescript
// Hardcoded redirects
if (!user.personal_email_verified) {
  navigate('/email-verification', { replace: true });
} else {
  navigate('/residence-address', { replace: true });
}
```

**After**:
```typescript
// Check email verification first (prerequisite)
if (!user.personal_email_verified) {
  navigate('/email-verification', { replace: true });
  return;
}

// Use progress engine for onboarding flow
const { getOnboardingProgress, getStepRoute } = await import('../../utils/onboardingProgressEngine');
const progress = await getOnboardingProgress(activeApplicationId);
const nextRoute = getStepRoute(progress.currentStep, activeApplicationId);
navigate(nextRoute, { replace: true });
```

**Benefits**:
- ✅ Still checks email verification (required prerequisite)
- ✅ Uses engine for onboarding flow navigation
- ✅ Falls back gracefully if engine fails

## Error Handling

All pages now include:
- ✅ Try-catch around engine calls
- ✅ Fallback to old behavior if engine fails
- ✅ Console logging for debugging
- ✅ User-friendly error messages

## Pattern Used

All pages follow this pattern:
```typescript
try {
  const { getOnboardingProgress, getStepRoute } = await import('../../utils/onboardingProgressEngine');
  const progress = await getOnboardingProgress(applicationId);
  const nextRoute = getStepRoute(progress.currentStep, applicationId);
  navigate(nextRoute, { replace: true });
} catch (error) {
  console.error('[PageName] Error getting next step, using fallback:', error);
  // Fallback to old behavior
  navigate('/old-route', { replace: true });
}
```

## Files Modified

1. ✅ `src/components/pages/EmploymentDetailsPage.tsx`
2. ✅ `src/components/pages/ReferenceDetailsPage.tsx`
3. ✅ `src/components/pages/AccountAggregatorFlow.tsx`
4. ✅ `src/components/pages/LoanDocumentUploadPage.tsx`
5. ✅ `src/components/pages/LinkSalaryBankAccountPage.tsx`

## Testing Checklist

- [ ] Test EmploymentDetailsPage submission → should go to next pending step
- [ ] Test ReferenceDetailsPage submission → should go to next pending step (or steps if complete)
- [ ] Test AccountAggregatorFlow completion → should go to next pending step
- [ ] Test LoanDocumentUploadPage completion → should go to next pending step
- [ ] Test LinkSalaryBankAccountPage → should use engine after email verification
- [ ] Test with admin resets → should redirect to correct step
- [ ] Test error handling → should fallback gracefully

## Next Steps (Phase 4)

1. **Coordinate LoanStatusGuard**
   - Ensure it doesn't conflict with engine
   - Focus on post-application statuses only

2. **Final Verification**
   - Test all onboarding flows end-to-end
   - Test admin reset scenarios
   - Test deep linking
   - Performance testing

3. **Documentation**
   - Update developer docs
   - Create user flow diagrams
   - Document edge cases

## Benefits Achieved

1. **Consistency**: All pages use same logic for navigation
2. **Maintainability**: Change once in engine, works everywhere
3. **Reliability**: Handles edge cases (ReKYC, resets) automatically
4. **Debugging**: Centralized logging makes issues easier to track
5. **Future-proof**: Easy to add new steps or change order

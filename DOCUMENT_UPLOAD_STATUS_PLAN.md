# Plan: Document Upload Status Management

## Overview
When users upload documents, the application should remain in `follow_up` status (not automatically move to `under_review`). The frontend should display "Verification Pending" to users. Only admins can manually move applications from `follow_up` to `under_review` via a button.

## Current Behavior Analysis

### Backend
- ✅ Document upload endpoint (`/api/loan-documents/upload`) does NOT automatically change status (good)
- ✅ Status changes only happen through admin actions or validation routes
- ⚠️ Need to verify no other code paths auto-change status on document upload

### Frontend
- ❌ After document upload, navigates to `/application-under-review` which shows "Under Review"
- ❌ Status display shows "Info required" for `follow_up` instead of "Verification Pending"
- ❌ ApplicationUnderReviewPage always shows "Under Review" regardless of actual status

### Admin Interface
- ✅ Admins can change status via dropdown in UserProfileDetail.tsx
- ❌ No dedicated button to move from `follow_up` to `under_review`
- ✅ Status change API exists at `/api/admin/applications/:applicationId/status`

## Required Changes

### 1. Backend Changes

#### 1.1 Ensure No Auto Status Change on Document Upload
**File**: `src/server/routes/loanApplicationDocuments.js`
- ✅ Already correct - no status change on upload (line 179-181 confirms this)
- **Action**: Verify no other document upload routes change status automatically
- **Files to check**:
  - `src/server/routes/userProfile.js` (student document upload)
  - `src/server/routes/userBankStatement.js`
  - `src/server/routes/studentDocuments.js`

#### 1.2 Add Admin Endpoint for Moving to Under Review (Optional)
**File**: `src/server/routes/adminApplications.js`
- Current endpoint `/api/admin/applications/:applicationId/status` already supports this
- **Action**: Verify it works correctly for `follow_up` → `under_review` transition

### 2. Frontend User-Facing Changes

#### 2.1 Update Status Display Text
**File**: `src/components/pages/DynamicDashboardPage.tsx`
- **Line ~735**: Change `follow_up` display from "Info required" to "Verification Pending"
- **Line ~932**: Same change in second location
- **Action**: Update status badge text for `follow_up` status

#### 2.2 Update ApplicationUnderReviewPage
**File**: `src/components/pages/ApplicationUnderReviewPage.tsx`
- **Current**: Always shows "Under Review" message
- **Required**: 
  - Check actual application status
  - If status is `follow_up`, show "Verification Pending" instead of "Under Review"
  - If status is `under_review`, show "Under Review"
- **Lines to modify**: ~99, ~117

#### 2.3 Update Navigation After Document Upload
**File**: `src/components/pages/LoanDocumentUploadPage.tsx`
- **Current**: After upload, navigates to `/application-under-review` (lines 495, 503)
- **Required**: 
  - Keep navigation to status page, but ensure it shows correct message based on status
  - Status should remain `follow_up` after upload (verify backend doesn't change it)

#### 2.4 Update LoanStatusGuard
**File**: `src/components/LoanStatusGuard.tsx`
- **Line ~102**: Includes `follow_up` in review statuses
- **Action**: Verify this is correct - `follow_up` should redirect to status page but show "Verification Pending"

### 3. Admin Interface Changes

#### 3.1 Add "Move to Under Review" Button
**File**: `src/admin/pages/UserProfileDetail.tsx`
- **Location**: Near loan status dropdown (around line ~5860-5870)
- **Action**: 
  - Add button visible only when status is `follow_up`
  - Button text: "Move to Under Review"
  - On click: Call `handleLoanStatusChange(loanId, 'under_review')`
  - Show confirmation dialog before changing

#### 3.2 Update Loan Applications Queue (Optional)
**File**: `src/admin/pages/LoanApplicationsQueue.tsx`
- **Action**: Consider adding bulk action to move multiple `follow_up` applications to `under_review`
- **Priority**: Low - can be added later if needed

## Implementation Steps

### Phase 1: Backend Verification (No Code Changes Expected)
1. ✅ Verify `loanApplicationDocuments.js` doesn't change status
2. Check other document upload routes for auto status changes
3. Test that document upload keeps status as `follow_up`

### Phase 2: Frontend Status Display
1. Update `DynamicDashboardPage.tsx` to show "Verification Pending" for `follow_up`
2. Update `ApplicationUnderReviewPage.tsx` to check status and show appropriate message
3. Test user flow: upload document → see "Verification Pending"

### Phase 3: Admin Button
1. Add "Move to Under Review" button in `UserProfileDetail.tsx`
2. Add confirmation dialog
3. Test admin flow: view `follow_up` application → click button → status changes to `under_review`

### Phase 4: Testing
1. Test user document upload flow
2. Test admin status change flow
3. Verify status persistence
4. Test edge cases (multiple uploads, status transitions)

## Files to Modify

### Backend (Verification Only)
- `src/server/routes/loanApplicationDocuments.js` - Verify no status change
- `src/server/routes/userProfile.js` - Check student document upload
- `src/server/routes/userBankStatement.js` - Check bank statement upload

### Frontend User
- `src/components/pages/DynamicDashboardPage.tsx` - Update status display
- `src/components/pages/ApplicationUnderReviewPage.tsx` - Conditional message based on status
- `src/components/pages/LoanDocumentUploadPage.tsx` - Verify navigation (likely no changes)

### Frontend Admin
- `src/admin/pages/UserProfileDetail.tsx` - Add "Move to Under Review" button

## Status Display Mapping

| Status | User-Facing Text | Admin-Facing Text |
|--------|-----------------|-------------------|
| `follow_up` | **Verification Pending** | Follow Up |
| `under_review` | Under Review | Under Review |
| `submitted` | Application Submitted | Submitted |

## Testing Checklist

- [ ] User uploads document → status remains `follow_up`
- [ ] User sees "Verification Pending" on dashboard
- [ ] User sees "Verification Pending" on status page
- [ ] Admin sees "Move to Under Review" button for `follow_up` applications
- [ ] Admin clicks button → status changes to `under_review`
- [ ] User sees "Under Review" after admin changes status
- [ ] No automatic status changes occur on document upload
- [ ] Status persists correctly across page refreshes

## Notes

- The backend already correctly prevents auto status changes (good!)
- Main work is frontend display updates and admin button
- Consider adding audit log entry when admin moves to under_review
- May want to add notification to user when admin moves to under_review

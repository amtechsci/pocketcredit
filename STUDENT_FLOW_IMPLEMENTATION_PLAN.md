# Student Flow Implementation Plan

## 📊 CURRENT STATUS

### ✅ Already Implemented:
1. **Age Validation** - Students < 19 get temporary hold until 19th birthday
2. **Step 3 Form** - College name + Graduation status inputs
3. **Backend Endpoint** - `PUT /api/user/profile/student`
4. **Hold Middleware** - Applied to student route
5. **UI Placeholders** - Document upload areas (non-functional)

### ❌ Missing:
1. **Actual Document Uploads** - College ID (front/back), Marks memo
2. **Student Dashboard** - Specific view for students
3. **Graduation Upsell** - Prompt to upgrade limit after graduation
4. **Loan Limit Logic** - Different limits for graduated vs non-graduated
5. **Document Verification** - Upload to server, store in database

---

## 🎯 IMPLEMENTATION PHASES

### **Phase 1: Document Upload System** 🔴 Priority

#### **What to Build:**
1. File upload component with preview
2. Backend endpoint for document uploads
3. Database schema for documents
4. Frontend integration

#### **Technical Details:**

**Frontend:**
- Multi-file upload component
- Image preview
- File size validation (max 5MB)
- Format validation (JPG, PNG, PDF)
- Progress indicator

**Backend:**
- `POST /api/documents/upload` endpoint
- File storage (local or S3)
- Document type tracking
- User association

**Database:**
```sql
CREATE TABLE student_documents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  document_type ENUM('college_id_front', 'college_id_back', 'marks_memo') NOT NULL,
  file_name VARCHAR(255),
  file_path VARCHAR(500),
  file_size INT,
  mime_type VARCHAR(100),
  upload_status ENUM('pending', 'uploaded', 'verified', 'rejected') DEFAULT 'uploaded',
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

### **Phase 2: Student-Specific Dashboard** 🟡 Priority

#### **What to Build:**
1. Detect student users
2. Show different dashboard layout
3. Display college info
4. Show graduation status

#### **UI Differences:**

**Regular User Dashboard:**
- Loan applications
- EMI tracker
- Credit score

**Student Dashboard:**
- College info card
- Current loan status
- Graduation status badge
- Upsell card (if not graduated)

---

### **Phase 3: Graduation Upsell System** 🟢 Priority

#### **What to Build:**
1. Upsell card on student dashboard
2. "Mark as Graduated" functionality
3. Automatic loan limit increase
4. Notification system

#### **Logic:**
```
IF user.employment_type === 'student' 
   AND graduation_status === 'not_graduated':
  
  SHOW Card:
    ┌─────────────────────────────────────┐
    │ 🎓 Are you graduated?               │
    │                                     │
    │ Unlock higher loan limits!          │
    │ Not Graduated: ₹10,000              │
    │ Graduated: ₹25,000                  │
    │                                     │
    │ [Mark as Graduated]                 │
    └─────────────────────────────────────┘

IF user clicks "Mark as Graduated":
  1. Update graduation_status = 'graduated'
  2. Update loan_limit from ₹10,000 → ₹25,000
  3. Show success message
  4. Hide upsell card
  5. Show new limit badge
```

---

### **Phase 4: Loan Limit Differentiation** 🟢 Priority

#### **Current:**
```
All students: Same loan limit
```

#### **Required:**
```
Student (Not Graduated): ₹10,000
Student (Graduated): ₹25,000
```

#### **Implementation:**
- Update `employmentQuickCheck.js` to set different limits
- Check graduation_status when setting loan_limit
- Update dashboard to show correct limit

---

## 📁 FILES TO CREATE/MODIFY

### **Create:**
1. `src/components/DocumentUpload.tsx` - File upload component
2. `src/components/StudentDashboard.tsx` - Student-specific dashboard
3. `src/components/GraduationUpsellCard.tsx` - Upsell component
4. `src/server/routes/documents.js` - Document upload routes
5. `src/server/scripts/create_student_documents_table.js` - Migration

### **Modify:**
1. `src/components/pages/ProfileCompletionPageSimple.tsx` - Integrate uploads
2. `src/components/pages/DynamicDashboardPage.tsx` - Add student check
3. `src/server/routes/employmentQuickCheck.js` - Loan limit logic
4. `src/server/controllers/userController.js` - Graduation update
5. `src/services/api.ts` - Add document upload methods

---

## 🚀 IMPLEMENTATION SEQUENCE

### **Step 1: Database Setup** ✅
```bash
1. Create student_documents table
2. Verify college_name and graduation_status columns exist in users
3. Test migrations
```

### **Step 2: Document Upload Backend** ✅
```bash
1. Install multer (if not installed)
2. Create /api/documents/upload endpoint
3. Implement file storage logic
4. Add validation
5. Test with Postman
```

### **Step 3: Document Upload Frontend** ✅
```bash
1. Create DocumentUpload component
2. Add file selection
3. Add preview
4. Add upload progress
5. Integrate with Step 3 form
6. Test uploads
```

### **Step 4: Loan Limit Logic** ✅
```bash
1. Update employmentQuickCheck.js
2. Check graduation_status
3. Set loan_limit accordingly:
   - not_graduated: ₹10,000
   - graduated: ₹25,000
4. Test with both statuses
```

### **Step 5: Student Dashboard** ✅
```bash
1. Create StudentDashboard component
2. Add college info display
3. Add graduation badge
4. Integrate with DynamicDashboardPage
5. Test routing
```

### **Step 6: Graduation Upsell** ✅
```bash
1. Create GraduationUpsellCard component
2. Add "Mark as Graduated" button
3. Create backend endpoint: PUT /api/user/update-graduation
4. Update loan_limit when marked
5. Test complete flow
```

---

## 📋 DETAILED TASKS

### **Task 1: Create student_documents Table**
```sql
CREATE TABLE IF NOT EXISTS student_documents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  document_type ENUM('college_id_front', 'college_id_back', 'marks_memo', 'educational_certificate') NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT,
  mime_type VARCHAR(100),
  upload_status ENUM('pending', 'uploaded', 'verified', 'rejected') DEFAULT 'uploaded',
  verification_notes TEXT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_upload_status (upload_status)
);
```

### **Task 2: Verify User Columns**
```sql
-- Check if columns exist
SELECT COLUMN_NAME 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'users' 
AND COLUMN_NAME IN ('college_name', 'graduation_status', 'employment_type');

-- Add if missing
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS college_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS graduation_status ENUM('not_graduated', 'graduated') DEFAULT 'not_graduated';
```

### **Task 3: Install Dependencies**
```bash
cd src/server
npm install multer
```

### **Task 4: Create Document Upload Endpoint**
```javascript
// src/server/routes/documents.js
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: './uploads/student-documents/',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, req.userId + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, and PDF files are allowed'));
    }
  }
});

router.post('/upload', requireAuth, checkHoldStatus, upload.single('document'), async (req, res) => {
  // Save to database
  // Return file info
});
```

### **Task 5: Frontend Component**
```typescript
// src/components/DocumentUpload.tsx
interface DocumentUploadProps {
  documentType: 'college_id_front' | 'college_id_back' | 'marks_memo';
  label: string;
  onUploadSuccess: (fileInfo: any) => void;
}

export function DocumentUpload({ documentType, label, onUploadSuccess }: DocumentUploadProps) {
  // File selection
  // Preview
  // Upload to server
  // Progress bar
  // Success/Error handling
}
```

---

## 🧪 TESTING CHECKLIST

### **Document Upload:**
- [ ] Select file (JPG)
- [ ] Select file (PNG)
- [ ] Select file (PDF)
- [ ] Try file > 5MB (should reject)
- [ ] Try invalid format (should reject)
- [ ] Upload all 3 documents
- [ ] Verify database entries
- [ ] Verify files on server

### **Student Flow:**
- [ ] Select "Student" employment type
- [ ] Age < 19 → Hold
- [ ] Age ≥ 19 → Continue
- [ ] Fill college name
- [ ] Select "Not Graduated"
- [ ] Upload 3 documents
- [ ] Submit form
- [ ] Profile completed
- [ ] Loan limit = ₹10,000

### **Graduation Upsell:**
- [ ] Login as student (not graduated)
- [ ] See upsell card on dashboard
- [ ] Click "Mark as Graduated"
- [ ] Loan limit increases to ₹25,000
- [ ] Upsell card disappears
- [ ] Graduation badge appears

### **Student Dashboard:**
- [ ] Login as student
- [ ] Different dashboard layout
- [ ] College info visible
- [ ] Graduation status badge
- [ ] Upsell card (if not graduated)

---

## 📊 EXPECTED OUTCOMES

### **For Non-Graduated Students:**
- ✅ Age validation (19+)
- ✅ College name saved
- ✅ 3 documents uploaded
- ✅ Loan limit: ₹10,000
- ✅ Student dashboard with upsell
- ✅ Can mark as graduated later

### **For Graduated Students:**
- ✅ Age validation (19+)
- ✅ College name saved
- ✅ 3 documents uploaded
- ✅ Loan limit: ₹25,000
- ✅ Student dashboard (no upsell)
- ✅ Graduation badge displayed

---

## 🎯 IMMEDIATE NEXT STEPS

**What to start with:**
1. ✅ Create student_documents table
2. ✅ Verify users table columns
3. ✅ Install multer
4. ✅ Create document upload endpoint
5. ✅ Create document upload component
6. ✅ Integrate with Step 3 form
7. ✅ Test uploads
8. ✅ Implement loan limit logic
9. ✅ Create student dashboard
10. ✅ Add graduation upsell

**Estimated Time:** 3-4 hours total

---

**Status:** Ready to implement  
**Priority:** High (core user flow)  
**Complexity:** Medium  
**Dependencies:** Multer package, file storage setup


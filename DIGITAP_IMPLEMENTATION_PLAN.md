# Digitap API Integration Plan

## Overview
Integrate Digitap API to fetch user credit score (Experian) and pre-fill user details automatically.

---

## API Details

**Endpoint:** `https://testapis.digitap.ai/mobiletoprefill`  
**Method:** POST  
**Authentication:** Bearer Token (API Key)

**Request:**
```json
{
  "mobile": "9876543210"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "John Doe",
    "dob": "1990-01-15",
    "pan": "ABCDE1234F",
    "gender": "Male",
    "email_id": "john@example.com",
    "address": {
      "line1": "123 Main Street",
      "line2": "Apartment 4B",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001"
    },
    "experian_score": 750,
    "age": 33
  }
}
```

---

## Implementation Steps

### Step 1: Get API Credentials ⏳
- [ ] Contact Digitap for API access
- [ ] Get API Key
- [ ] Get test credentials
- [ ] Review API documentation

### Step 2: Backend Service (src/server/services/digitapService.js)
```javascript
const axios = require('axios');

const DIGITAP_API_URL = process.env.DIGITAP_API_URL || 'https://testapis.digitap.ai/mobiletoprefill';
const DIGITAP_API_KEY = process.env.DIGITAP_API_KEY;

async function fetchUserPrefillData(mobileNumber) {
  try {
    const response = await axios.post(DIGITAP_API_URL, {
      mobile: mobileNumber
    }, {
      headers: {
        'Authorization': `Bearer ${DIGITAP_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 seconds
    });
    
    return {
      success: true,
      data: response.data.data
    };
  } catch (error) {
    console.error('Digitap API error:', error);
    return {
      success: false,
      error: error.message,
      allow_manual: true
    };
  }
}

module.exports = { fetchUserPrefillData };
```

### Step 3: Backend Route (src/server/routes/digitap.js)
```javascript
const express = require('express');
const router = express.Router();
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
const { fetchUserPrefillData } = require('../services/digitapService');

// POST /api/digitap/prefill - Fetch user data from Digitap
router.post('/prefill', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    
    // Get user's mobile number
    const users = await executeQuery(
      'SELECT phone FROM users WHERE id = ?',
      [userId]
    );
    
    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const mobileNumber = users[0].phone;
    
    // Call Digitap API
    const result = await fetchUserPrefillData(mobileNumber);
    
    if (!result.success) {
      return res.json({
        success: false,
        allow_manual: true,
        message: 'Unable to fetch details automatically. Please enter manually.'
      });
    }
    
    const userData = result.data;
    
    // Store response in database
    await executeQuery(`
      INSERT INTO digitap_responses 
      (user_id, mobile_number, response_data, experian_score, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `, [userId, mobileNumber, JSON.stringify(userData), userData.experian_score || null]);
    
    // Check credit score
    if (userData.experian_score && userData.experian_score < 630) {
      // Create 60-day hold
      const holdUntil = new Date();
      holdUntil.setDate(holdUntil.getDate() + 60);
      
      await executeQuery(`
        UPDATE users 
        SET status = 'on_hold', 
            eligibility_status = 'not_eligible',
            application_hold_reason = ?,
            hold_until_date = ?,
            experian_score = ?,
            updated_at = NOW()
        WHERE id = ?
      `, [
        `Low credit score: ${userData.experian_score}`,
        holdUntil,
        userData.experian_score,
        userId
      ]);
      
      return res.json({
        success: false,
        hold_applied: true,
        credit_score: userData.experian_score,
        hold_until: holdUntil,
        message: `Your credit score (${userData.experian_score}) is below our minimum requirement. You can reapply after ${holdUntil.toLocaleDateString()}.`
      });
    }
    
    // Update user with experian score
    await executeQuery(
      'UPDATE users SET experian_score = ?, updated_at = NOW() WHERE id = ?',
      [userData.experian_score || null, userId]
    );
    
    // Return pre-fill data
    res.json({
      success: true,
      data: {
        name: userData.name,
        dob: userData.dob,
        pan: userData.pan,
        gender: userData.gender,
        email: userData.email_id,
        address: userData.address,
        credit_score: userData.experian_score,
        age: userData.age
      }
    });
    
  } catch (error) {
    console.error('Digitap prefill error:', error);
    res.status(500).json({
      success: false,
      allow_manual: true,
      message: 'Failed to fetch details'
    });
  }
});

module.exports = router;
```

### Step 4: Register Route in server.js
```javascript
const digitapRoutes = require('./routes/digitap');
app.use('/api/digitap', digitapRoutes);
```

### Step 5: Database Table
```sql
CREATE TABLE IF NOT EXISTS digitap_responses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  mobile_number VARCHAR(20),
  response_data JSON,
  experian_score INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user_id (user_id),
  INDEX idx_mobile (mobile_number)
);

-- Add experian_score to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS experian_score INT AFTER loan_limit;
```

### Step 6: Frontend API Service (src/services/api.ts)
```typescript
async fetchDigitapPrefill(): Promise<ApiResponse<any>> {
  return this.handleRequest<any>('/api/digitap/prefill', {
    method: 'POST'
  });
}
```

### Step 7: Frontend Component (Add to ProfileCompletionPageSimple.tsx)
After DOB is entered and validated, trigger Digitap API call:

```typescript
// Add state
const [digitapData, setDigitapData] = useState<any>(null);
const [showPrefillConfirm, setShowPrefillConfirm] = useState(false);
const [fetchingPrefill, setFetchingPrefill] = useState(false);

// Call after DOB validation passes
const fetchDigitapData = async () => {
  setFetchingPrefill(true);
  try {
    const response = await apiService.fetchDigitapPrefill();
    
    if (response.success && response.data) {
      setDigitapData(response.data);
      setShowPrefillConfirm(true);
      toast.success('We found your details!');
    } else if (response.hold_applied) {
      toast.error(response.message);
      // Redirect to dashboard or show hold message
      setTimeout(() => navigate('/dashboard'), 2000);
    } else {
      // Allow manual entry
      toast.info('Please enter your details manually');
    }
  } catch (error) {
    console.error('Digitap fetch error:', error);
    toast.info('Please enter your details manually');
  } finally {
    setFetchingPrefill(false);
  }
};

// Add UI for confirmation
{showPrefillConfirm && digitapData && (
  <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3 mb-4">
    <div className="flex items-center gap-2">
      <CheckCircle className="w-5 h-5 text-blue-600" />
      <h4 className="font-semibold text-blue-900">We found your details automatically!</h4>
    </div>
    <div className="grid grid-cols-2 gap-2 text-sm">
      <div><strong>Name:</strong> {digitapData.name}</div>
      <div><strong>DOB:</strong> {digitapData.dob}</div>
      <div><strong>PAN:</strong> {digitapData.pan}</div>
      <div><strong>Gender:</strong> {digitapData.gender}</div>
      {digitapData.credit_score && (
        <div className="col-span-2">
          <strong>Credit Score:</strong> 
          <span className={digitapData.credit_score >= 630 ? 'text-green-600' : 'text-red-600'}>
            {' '}{digitapData.credit_score}
          </span>
        </div>
      )}
    </div>
    <p className="text-sm text-blue-800">Is this information correct?</p>
    <div className="flex gap-3">
      <Button
        onClick={() => {
          // Pre-fill form
          setBasicFormData(prev => ({
            ...prev,
            full_name: digitapData.name,
            pan_number: digitapData.pan,
            date_of_birth: digitapData.dob
          }));
          setShowPrefillConfirm(false);
          toast.success('Details filled automatically');
        }}
        className="flex-1 bg-blue-600 hover:bg-blue-700"
      >
        Yes, Correct
      </Button>
      <Button
        onClick={() => {
          setShowPrefillConfirm(false);
          toast.info('Please enter your details manually');
        }}
        variant="outline"
        className="flex-1"
      >
        No, Enter Manually
      </Button>
    </div>
  </div>
)}
```

---

## Testing Checklist

### Without API Credentials (Mock Testing):
- [ ] Test manual entry fallback
- [ ] Test UI for pre-fill confirmation
- [ ] Test credit score display
- [ ] Test hold message for low score

### With API Credentials:
- [ ] Test successful API call
- [ ] Test pre-fill functionality
- [ ] Test credit score >= 630 (pass)
- [ ] Test credit score < 630 (60-day hold)
- [ ] Test API timeout/failure
- [ ] Test with invalid mobile number
- [ ] Test data storage in digitap_responses table

---

## Environment Variables

Add to `.env`:
```
DIGITAP_API_URL=https://testapis.digitap.ai/mobiletoprefill
DIGITAP_API_KEY=your_api_key_here
```

---

## Next Steps

1. Get Digitap API credentials
2. Implement backend service
3. Create database table
4. Implement frontend integration
5. Test thoroughly
6. Deploy



# KFS Dynamic Content Management System - Architecture Plan

## Overview
A comprehensive system that allows admins to:
1. Generate PDF versions of KFS documents
2. Email KFS PDFs to borrowers
3. Edit and customize KFS content dynamically
4. Manage templates with variables
5. Preview changes before publishing

---

## 🏗️ System Architecture

### 1. PDF Generation Layer
**Technology**: Puppeteer (headless Chrome)

**Why Puppeteer?**
- Renders HTML/CSS perfectly (same as browser)
- Supports complex layouts and page breaks
- Can handle dynamic content
- Server-side generation
- High-quality PDF output

**Implementation**:
```javascript
// Backend: Generate PDF from HTML
const puppeteer = require('puppeteer');

async function generateKFSPDF(kfsData, templateHtml) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Inject data into template
  const html = renderTemplate(templateHtml, kfsData);
  await page.setContent(html);
  
  // Generate PDF with proper settings
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', bottom: '20mm' }
  });
  
  await browser.close();
  return pdf;
}
```

---

### 2. Email Integration Layer
**Technology**: Nodemailer + Email Templates

**Features**:
- Send KFS PDF as attachment
- Professional email template
- Track email status (sent, opened, failed)
- Resend capability
- BCC to admin for records

**Implementation**:
```javascript
const nodemailer = require('nodemailer');

async function sendKFSEmail(borrowerEmail, pdfBuffer, loanData) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  
  await transporter.sendMail({
    from: 'Pocket Credit <noreply@pocketcredit.in>',
    to: borrowerEmail,
    subject: `Key Facts Statement - Loan ${loanData.application_number}`,
    html: emailTemplate(loanData),
    attachments: [{
      filename: `KFS_${loanData.application_number}.pdf`,
      content: pdfBuffer
    }]
  });
}
```

---

### 3. Dynamic Template Management System

#### Database Schema

```sql
-- KFS Templates Table
CREATE TABLE kfs_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  version VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT false,
  template_type ENUM('kfs', 'loan_agreement', 'sanction_letter') DEFAULT 'kfs',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES admin_users(id)
);

-- Template Sections Table (for modular editing)
CREATE TABLE kfs_template_sections (
  id INT PRIMARY KEY AUTO_INCREMENT,
  template_id INT NOT NULL,
  section_name VARCHAR(100) NOT NULL,
  section_order INT NOT NULL,
  section_type ENUM('header', 'table', 'text', 'list', 'footer') NOT NULL,
  content TEXT NOT NULL,
  variables JSON, -- List of variables used in this section
  is_editable BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES kfs_templates(id) ON DELETE CASCADE
);

-- Template Variables Table (for documentation)
CREATE TABLE kfs_template_variables (
  id INT PRIMARY KEY AUTO_INCREMENT,
  variable_name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  data_type ENUM('string', 'number', 'date', 'currency', 'boolean') NOT NULL,
  data_source VARCHAR(255), -- e.g., 'loan.amount', 'borrower.name'
  format_rule VARCHAR(255), -- e.g., 'currency:INR', 'date:DD/MM/YYYY'
  example_value VARCHAR(255),
  category VARCHAR(100), -- 'loan', 'borrower', 'company', 'calculation'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Template Version History
CREATE TABLE kfs_template_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  template_id INT NOT NULL,
  version VARCHAR(50) NOT NULL,
  changes_summary TEXT,
  changed_by INT NOT NULL,
  template_data JSON, -- Full snapshot of template at this version
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES kfs_templates(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES admin_users(id)
);

-- Email Log Table
CREATE TABLE kfs_email_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  loan_id INT NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  status ENUM('pending', 'sent', 'failed', 'bounced') DEFAULT 'pending',
  sent_at TIMESTAMP NULL,
  opened_at TIMESTAMP NULL,
  error_message TEXT,
  pdf_generated_at TIMESTAMP NULL,
  sent_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (loan_id) REFERENCES loan_applications(id),
  FOREIGN KEY (sent_by) REFERENCES admin_users(id)
);
```

---

### 4. Variable System

#### Predefined Variables

**Loan Variables**:
- `{{loan.id}}` - Loan ID
- `{{loan.application_number}}` - Application Number
- `{{loan.amount}}` - Loan Amount
- `{{loan.sanctioned_amount}}` - Sanctioned Amount
- `{{loan.disbursed_amount}}` - Disbursed Amount
- `{{loan.term_days}}` - Loan Term in Days
- `{{loan.status}}` - Current Status
- `{{loan.applied_date}}` - Application Date
- `{{loan.due_date}}` - Due Date

**Borrower Variables**:
- `{{borrower.name}}` - Full Name
- `{{borrower.email}}` - Email Address
- `{{borrower.phone}}` - Phone Number
- `{{borrower.address}}` - Full Address
- `{{borrower.city}}` - City
- `{{borrower.state}}` - State
- `{{borrower.pincode}}` - PIN Code

**Calculation Variables**:
- `{{calc.principal}}` - Principal Amount
- `{{calc.processing_fee}}` - Processing Fee
- `{{calc.processing_fee_percent}}` - Processing Fee %
- `{{calc.gst}}` - GST Amount
- `{{calc.interest}}` - Interest Amount
- `{{calc.interest_rate}}` - Interest Rate
- `{{calc.total_repayable}}` - Total Repayable
- `{{calc.apr}}` - Annual Percentage Rate
- `{{calc.disbursed_amount}}` - Net Disbursed Amount

**Company Variables**:
- `{{company.name}}` - Company Name
- `{{company.cin}}` - CIN Number
- `{{company.rbi_registration}}` - RBI Registration
- `{{company.address}}` - Company Address
- `{{company.phone}}` - Contact Phone
- `{{company.email}}` - Contact Email

**Date Variables**:
- `{{date.today}}` - Today's Date
- `{{date.due_date}}` - Due Date
- `{{date.disbursement}}` - Disbursement Date

**Conditional Variables**:
- `{{if:loan.status==approved}}...{{endif}}`
- `{{if:calc.apr>100}}...{{else}}...{{endif}}`

---

### 5. Template Editor UI

#### Features

**1. Rich Text Editor**
- WYSIWYG editor (TinyMCE or Quill)
- Variable insertion dropdown
- Syntax highlighting for variables
- Preview mode
- Undo/Redo

**2. Section-Based Editing**
- Edit individual sections (Header, Part A, Part B, etc.)
- Drag-and-drop section reordering
- Add/remove sections
- Lock critical sections

**3. Variable Browser**
- Searchable variable list
- Category-wise organization
- Click to insert
- Shows example values
- Data type indicators

**4. Live Preview**
- Real-time preview with sample data
- Switch between edit and preview modes
- Test with actual loan data
- Mobile/print preview

**5. Version Control**
- Save as draft
- Publish version
- View history
- Rollback to previous version
- Compare versions (diff view)

---

### 6. Template Engine

#### Variable Replacement Logic

```javascript
class TemplateEngine {
  constructor(template, data) {
    this.template = template;
    this.data = data;
  }
  
  // Replace simple variables
  replaceVariables() {
    let result = this.template;
    
    // Replace {{variable.path}}
    const regex = /\{\{([^}]+)\}\}/g;
    result = result.replace(regex, (match, path) => {
      return this.getNestedValue(this.data, path.trim());
    });
    
    return result;
  }
  
  // Handle conditional blocks
  replaceConditionals() {
    let result = this.template;
    
    // {{if:condition}}...{{endif}}
    const ifRegex = /\{\{if:([^}]+)\}\}([\s\S]*?)\{\{endif\}\}/g;
    result = result.replace(ifRegex, (match, condition, content) => {
      return this.evaluateCondition(condition) ? content : '';
    });
    
    return result;
  }
  
  // Handle loops
  replaceLoops() {
    let result = this.template;
    
    // {{foreach:items}}...{{endforeach}}
    const loopRegex = /\{\{foreach:([^}]+)\}\}([\s\S]*?)\{\{endforeach\}\}/g;
    result = result.replace(loopRegex, (match, arrayPath, itemTemplate) => {
      const array = this.getNestedValue(this.data, arrayPath);
      return array.map(item => this.renderItem(itemTemplate, item)).join('');
    });
    
    return result;
  }
  
  // Format values
  formatValue(value, format) {
    if (format.startsWith('currency:')) {
      return this.formatCurrency(value, format.split(':')[1]);
    } else if (format.startsWith('date:')) {
      return this.formatDate(value, format.split(':')[1]);
    }
    return value;
  }
  
  render() {
    let result = this.template;
    result = this.replaceConditionals();
    result = this.replaceLoops();
    result = this.replaceVariables();
    return result;
  }
}
```

---

### 7. Admin Settings UI

#### Template Management Page

```
┌─────────────────────────────────────────────────────────┐
│  KFS Template Management                                │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [+ New Template]  [Import]  [Export]                   │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ Active Templates                                │    │
│  ├────────────────────────────────────────────────┤    │
│  │ ✓ Default KFS Template v2.1     [Edit] [View]  │    │
│  │   Last modified: 2 days ago                     │    │
│  │                                                  │    │
│  │   Draft KFS Template v2.2       [Edit] [View]  │    │
│  │   Last modified: 1 hour ago                     │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ Template History                                │    │
│  ├────────────────────────────────────────────────┤    │
│  │ v2.1 - Updated penal charges (Active)          │    │
│  │ v2.0 - Changed company details                 │    │
│  │ v1.9 - Updated APR calculation                 │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

#### Template Editor Page

```
┌─────────────────────────────────────────────────────────┐
│  Edit KFS Template                          [Save] [Preview] [Publish] │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┬─────────────────────────────────────┐    │
│  │ Sections │ Content Editor                       │    │
│  ├──────────┤                                       │    │
│  │ □ Header │ Company Name: {{company.name}}       │    │
│  │ ☑ Part A │ CIN: {{company.cin}}                 │    │
│  │ □ Part B │                                       │    │
│  │ □ Annex B│ Loan Amount: {{calc.principal}}      │    │
│  │ □ Annex C│ Processing Fee: {{calc.processing_fee}}│  │
│  │ □ Footer │                                       │    │
│  │          │ [Insert Variable ▼]                  │    │
│  │          │                                       │    │
│  │ Variables│ Loan Variables:                      │    │
│  │ Browser  │ • {{loan.amount}}                    │    │
│  │          │ • {{loan.term_days}}                 │    │
│  │          │ Borrower Variables:                  │    │
│  │          │ • {{borrower.name}}                  │    │
│  └──────────┴─────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

### 8. API Endpoints

```javascript
// Template Management
POST   /api/admin/kfs-templates              // Create new template
GET    /api/admin/kfs-templates              // List all templates
GET    /api/admin/kfs-templates/:id          // Get template details
PUT    /api/admin/kfs-templates/:id          // Update template
DELETE /api/admin/kfs-templates/:id          // Delete template
POST   /api/admin/kfs-templates/:id/publish  // Publish template version
GET    /api/admin/kfs-templates/:id/history  // Get version history
POST   /api/admin/kfs-templates/:id/rollback // Rollback to version

// Template Sections
GET    /api/admin/kfs-templates/:id/sections      // Get all sections
POST   /api/admin/kfs-templates/:id/sections      // Add section
PUT    /api/admin/kfs-templates/:id/sections/:sid // Update section
DELETE /api/admin/kfs-templates/:id/sections/:sid // Delete section

// Variables
GET    /api/admin/kfs-variables              // List all available variables
POST   /api/admin/kfs-variables              // Add custom variable

// PDF Generation
POST   /api/kfs/:loanId/generate-pdf         // Generate PDF
GET    /api/kfs/:loanId/download-pdf         // Download PDF
POST   /api/kfs/:loanId/email-pdf            // Email PDF to borrower

// Preview
POST   /api/admin/kfs-templates/:id/preview  // Preview with sample data
POST   /api/kfs/:loanId/preview              // Preview with actual loan data
```

---

### 9. Implementation Phases

#### Phase 1: PDF Generation (Week 1)
- [ ] Install Puppeteer
- [ ] Create PDF generation service
- [ ] Add download endpoint
- [ ] Test with current KFS template

#### Phase 2: Email Integration (Week 1)
- [ ] Setup Nodemailer
- [ ] Create email templates
- [ ] Add email sending endpoint
- [ ] Create email log table
- [ ] Add email status tracking

#### Phase 3: Database Schema (Week 2)
- [ ] Create template tables
- [ ] Create variables table
- [ ] Create history table
- [ ] Create email log table
- [ ] Seed with default template

#### Phase 4: Template Engine (Week 2-3)
- [ ] Build variable replacement engine
- [ ] Add conditional logic
- [ ] Add loop support
- [ ] Add formatting functions
- [ ] Add validation

#### Phase 5: Admin UI - Template List (Week 3)
- [ ] Create template management page
- [ ] List all templates
- [ ] Create/delete templates
- [ ] Activate/deactivate templates
- [ ] View history

#### Phase 6: Admin UI - Template Editor (Week 4)
- [ ] Build section-based editor
- [ ] Add rich text editor
- [ ] Add variable browser
- [ ] Add live preview
- [ ] Add save/publish

#### Phase 7: Testing & Optimization (Week 5)
- [ ] Test all variables
- [ ] Test PDF generation
- [ ] Test email delivery
- [ ] Performance optimization
- [ ] Security audit

---

### 10. Security Considerations

1. **Template Injection Prevention**
   - Sanitize user input
   - Whitelist allowed variables
   - Validate template syntax
   - Prevent code execution

2. **Access Control**
   - Only superadmin can edit templates
   - Audit log for all changes
   - Require approval for publishing

3. **Email Security**
   - Rate limiting
   - Spam prevention
   - Bounce handling
   - Unsubscribe option

---

### 11. Performance Optimization

1. **PDF Caching**
   - Cache generated PDFs for 24 hours
   - Invalidate on loan data change
   - Store in CDN/S3

2. **Template Caching**
   - Cache active template in Redis
   - Invalidate on template update
   - Pre-compile templates

3. **Async Processing**
   - Queue PDF generation
   - Queue email sending
   - Background workers

---

### 12. Monitoring & Analytics

1. **Track Metrics**
   - PDF generation time
   - Email delivery rate
   - Template usage
   - Error rates

2. **Alerts**
   - Failed PDF generation
   - Email bounces
   - Template errors

---

## 🚀 Quick Start Implementation

Let me start with Phase 1 & 2 (PDF + Email) which are the most critical...

Would you like me to proceed with implementing:
1. PDF generation with Puppeteer
2. Email integration with Nodemailer
3. Then move to the template management system?

Or would you prefer a different order?


